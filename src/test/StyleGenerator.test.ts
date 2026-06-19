import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STICKY_HEADING_KEY } from '../constants';

import { StyleGenerator } from '../core/style/StyleGenerator';
import { SettingType } from '../ui/components/base/types';

describe('StyleGenerator', () => {
	let mockPlugin: any;
	let mockBridge: any;
	let getSettings: () => any;
	let generator: StyleGenerator;
	let settingsStore: any;

	beforeEach(() => {
		vi.clearAllMocks();
		document.body.className = '';
		document.body.innerHTML = '';

		const oldStyle = document.getElementById('style-manager-styles');
		oldStyle?.remove();

		settingsStore = {};
		getSettings = () => settingsStore;

		mockBridge = {
			triggerEvent: vi.fn(),
			getNativeConfig: vi.fn().mockReturnValue({}),
		};

		mockPlugin = {
			settingsService: {
				styleSheetManager: {
					getCSSVar: vi.fn().mockImplementation((id) => {
						if (id === 'existing-var' || id === 'res-col') {
							return { light: '#ffffff', dark: '#000000', current: '#888888' };
						}
						return undefined;
					}),
				},
			},
		};

		generator = new StyleGenerator(mockPlugin, mockBridge, getSettings);
	});

	describe('Config Management', () => {
		it('should correctly map parsed settings to config and gradients', () => {
			const parsedSettings = [
				{
					id: 'section1',
					name: 'Section 1',
					settings: [
						{
							id: 'var1',
							type: SettingType.VARIABLE_COLOR,
							default: '#ff0000',
							format: 'hex',
							title: 'Var 1',
						},
						{
							id: 'grad1',
							type: SettingType.COLOR_GRADIENT,
							from: 'var1',
							to: '#0000ff',
							step: 100,
							pad: 2,
							format: 'hex',
							title: 'Grad 1',
						},
					],
				},
			];

			generator.setConfig(parsedSettings);

			expect(generator.config['section1']['var1'].id).toBe('var1');
			expect(generator.gradients['section1']).toBeDefined();
			expect(generator.gradients['section1'][0].id).toBe('grad1');
		});

		it('should trigger setCSSVariables after setConfig', () => {
			const spy = vi.spyOn(generator, 'setCSSVariables');
			generator.setConfig([]);
			expect(spy).toHaveBeenCalled();
		});
	});

	describe('Initialization and Cleanup', () => {
		it('should create style tag and append to document head on init', () => {
			const styleTag = document.getElementById('style-manager-styles');
			expect(styleTag).not.toBeNull();
			expect(styleTag?.parentElement).toBe(document.head);
		});

		it('should clean up stylesheets and classes on destroy', () => {
			generator.config = {
				sec: {
					toggle: {
						id: 'destroy-test',
						type: SettingType.CLASS_TOGGLE,
						default: true,
						title: 'Destroy Test',
					},
				},
			};
			generator.initClasses();
			expect(document.body.classList.contains('destroy-test')).toBe(true);

			generator.destroy();
			const styleTag = document.getElementById('style-manager-styles');
			expect(styleTag).toBeNull();
			expect(document.body.classList.contains('destroy-test')).toBe(false);
		});
	});

	describe('Class Management', () => {
		it('should add/remove classes to document body based on configuration', () => {
			generator.config = {
				sectionA: {
					toggle1: {
						id: 'class-tg-1',
						type: SettingType.CLASS_TOGGLE,
						default: true,
						title: 'Toggle Test',
					},
					select1: {
						id: 'class-sel-1',
						type: SettingType.CLASS_SELECT,
						default: 'opt-a',
						options: ['opt-a', 'opt-b'],
						title: 'Select Test',
					},
				},
			};

			generator.initClasses();
			expect(document.body.classList.contains('class-tg-1')).toBe(true);
			expect(document.body.classList.contains('opt-a')).toBe(true);

			generator.removeClasses();
			expect(document.body.classList.contains('class-tg-1')).toBe(false);
			expect(document.body.classList.contains('opt-a')).toBe(false);

			settingsStore = {
				'sectionA@@toggle1': false,
				'sectionA@@select1': 'opt-b',
			};
			generator.initClasses();
			expect(document.body.classList.contains('class-tg-1')).toBe(false);
			expect(document.body.classList.contains('opt-b')).toBe(true);
		});
	});

	describe('Color Variable Generation', () => {
		it('should generate variables for all supported color formats', () => {
			const formats: Array<{ format: any; expected: string }> = [
				{ format: 'hex', expected: '#ff0000' },
				{ format: 'rgb', expected: 'rgb(255 0 0)' },
				{ format: 'hsl', expected: 'hsl(0deg 100% 50%)' },
				{ format: 'hsl-values', expected: '0,100%,50%' },
				{ format: 'hsl-split', expected: '0' },
				{ format: 'hsl-split-decimal', expected: '0' },
				{ format: 'rgb-values', expected: '255,0,0' },
				{ format: 'rgb-split', expected: '255' },
			];

			formats.forEach(({ format, expected }) => {
				const result = (generator as any).generateColorVariables(
					'test-color',
					format,
					'#ff0000',
					false
				);
				expect(result[0].value).toBe(expected);
			});
		});

		it('should append alpha channel when opacity is true', () => {
			const result = (generator as any).generateColorVariables(
				'test-color',
				'rgb-values',
				'#ff0000',
				true
			);
			expect(result[0].value).toBe('255,0,0,1');
		});

		it('should generate additional variables for alt-formats', () => {
			const altFormats = [
				{ id: 'alt-hex', format: 'hex' },
				{ id: 'alt-rgb', format: 'rgb' },
			];
			const result = (generator as any).generateColorVariables(
				'main',
				'hsl',
				'#ff0000',
				false,
				altFormats
			);

			expect(result).toContainEqual({
				key: 'main',
				value: 'hsl(0deg 100% 50%)',
			});
			expect(result).toContainEqual({ key: 'alt-hex', value: '#ff0000' });
			expect(result).toContainEqual({ key: 'alt-rgb', value: 'rgb(255 0 0)' });
		});
	});

	describe('Color Resolution Edge Cases', () => {
		it('should handle empty or invalid values gracefully', () => {
			const config = {
				sec: {
					col: {
						id: 'res-col',
						type: SettingType.VARIABLE_COLOR,
						default: '#ffffff',
						format: 'hex',
					},
					grad: {
						id: 'grad',
						type: SettingType.COLOR_GRADIENT,
						from: 'res-col',
						to: 'native-col',
						format: 'hex',
						step: 100,
						pad: 2,
					},
				},
			};
			const gradients = { sec: [config.sec.grad as any] };
			const [vars] = generator.generateVariableArrays(
				{},
				config as any,
				gradients,
				mockBridge
			);

			const settings = { 'sec@@col': '' };
			const [varsEmpty] = generator.generateVariableArrays(
				settings,
				config as any,
				gradients,
				mockBridge
			);
			expect(varsEmpty.some((v) => v.key === 'res-col')).toBe(false);
		});

		it('should handle missing styleSheetManager gracefully', () => {
			const generatorNoSMM = new StyleGenerator(
				{} as any,
				mockBridge,
				getSettings
			);
			const config = {
				sec: {
					col: {
						id: 'res-col',
						type: SettingType.VARIABLE_COLOR,
						default: '#ffffff',
						format: 'hex',
					},
				},
			};
			const [vars] = generatorNoSMM.generateVariableArrays(
				{},
				config as any,
				{},
				mockBridge
			);

			expect(
				vars.some((v) => v.key === 'res-col' && v.value === '#ffffff')
			).toBe(true);
		});
	});

	describe('Color Resolution', () => {
		it('should resolve colors based on priority via generateVariableArrays', () => {
			const config = {
				sec: {
					col1: {
						id: 'res-col-1',
						type: SettingType.VARIABLE_THEMED_COLOR,
						'default-light': '#ff0000',
						'default-dark': '#0000ff',
						format: 'hex',
					},
					col2: {
						id: 'res-col-2',
						type: SettingType.VARIABLE_COLOR,
						default: '#00ff00',
						format: 'hex',
					},
					grad1: {
						id: 'grad-1',
						type: SettingType.COLOR_GRADIENT,
						from: 'res-col-1',
						to: 'existing-var',
						format: 'hex',
						step: 100,
						pad: 2,
					},
					grad2: {
						id: 'grad-2',
						type: SettingType.COLOR_GRADIENT,
						from: 'res-col-2',
						to: 'existing-var',
						format: 'hex',
						step: 100,
						pad: 2,
					},
				},
			};
			const gradients = {
				sec: [config.sec.grad1 as any, config.sec.grad2 as any],
			};

			const [vars, themedLight, themedDark] = generator.generateVariableArrays(
				{},
				config as any,
				gradients,
				mockBridge
			);

			// grad-1-00 should resolve to the themed values of 'res-col-1'
			expect(
				themedLight.some(
					(v) => v.key === 'grad-1-00' && v.value === 'rgb(255 0 0)'
				)
			).toBe(true);
			expect(
				themedDark.some(
					(v) => v.key === 'grad-1-00' && v.value === 'rgb(0 0 255)'
				)
			).toBe(true);

			// grad-2-00 should resolve to the base value of 'res-col-2' (#00ff00)
			expect(
				vars.some((v) => v.key === 'grad-2-00' && v.value === 'rgb(0 255 0)')
			).toBe(true);

			// 100 should resolve to existing-var (mock returns #ffffff, #000000, #888888)
			expect(
				themedLight.some(
					(v) => v.key === 'grad-1-100' && v.value === 'rgb(255 255 255)'
				)
			).toBe(true);
			expect(
				themedDark.some(
					(v) => v.key === 'grad-1-100' && v.value === 'rgb(0 0 0)'
				)
			).toBe(true);
			expect(
				vars.some(
					(v) => v.key === 'grad-2-100' && v.value === 'rgb(136 136 136)'
				)
			).toBe(true);
		});
	});

	describe('Gradient Generation', () => {
		it('should resolve gradient colors from multiple sources', () => {
			const config = {
				sec: {
					c1: {
						id: 'c1',
						type: SettingType.VARIABLE_COLOR,
						default: '#ff0000',
						format: 'hex',
					},
					c2: {
						id: 'c2',
						type: SettingType.VARIABLE_COLOR,
						default: '#0000ff',
						format: 'hex',
					},
					grad: {
						id: 'grad',
						type: SettingType.COLOR_GRADIENT,
						from: 'c1',
						to: 'c2',
						format: 'hex',
						step: 100,
						pad: 2,
					},
				},
			};
			const gradients = { sec: [config.sec.grad as any] };
			const settings = { 'sec@@c1': '#ff0000', 'sec@@c2': '#0000ff' };

			const [vars] = generator.generateVariableArrays(
				settings,
				config as any,
				gradients,
				mockBridge
			);
			expect(
				vars.some((v) => v.key === 'grad-00' && v.value === 'rgb(255 0 0)')
			).toBe(true);
			expect(
				vars.some((v) => v.key === 'grad-100' && v.value === 'rgb(0 0 255)')
			).toBe(true);
		});

		it('should resolve gradient colors from native config', () => {
			// Simulating the fallback logic cleanly by bypassing the string-return quirk of resolveColor
			const config = {
				sec: {
					c1: {
						id: 'c1',
						type: SettingType.VARIABLE_COLOR,
						default: '#ff0000',
						format: 'hex',
					},
					grad: {
						id: 'grad',
						type: SettingType.COLOR_GRADIENT,
						from: 'c1',
						to: '',
						format: 'hex',
						step: 100,
						pad: 2,
					},
				},
			};
			const gradients = { sec: [config.sec.grad as any] };
			mockBridge.getNativeConfig.mockReturnValue({
				themes: { '': { css: '#00ff00' } },
			});

			const settings = { 'sec@@c1': '#ff0000' };
			const [vars] = generator.generateVariableArrays(
				settings,
				config as any,
				gradients,
				mockBridge
			);
			expect(
				vars.some((v) => v.key === 'grad-100' && v.value === 'rgb(0 255 0)')
			).toBe(true);
		});

		it('should correctly apply step and pad parameters', () => {
			const config = {
				sec: {
					c1: {
						id: 'c1',
						type: SettingType.VARIABLE_COLOR,
						default: '#ff0000',
						format: 'hex',
					},
					c2: {
						id: 'c2',
						type: SettingType.VARIABLE_COLOR,
						default: '#0000ff',
						format: 'hex',
					},
					grad: {
						id: 'grad',
						type: SettingType.COLOR_GRADIENT,
						from: 'c1',
						to: 'c2',
						format: 'hex',
						step: 50,
						pad: 3,
					},
				},
			};
			const gradients = { sec: [config.sec.grad as any] };

			const [vars] = generator.generateVariableArrays(
				{},
				config as any,
				gradients,
				mockBridge
			);

			expect(vars.some((v) => v.key === 'grad-000')).toBe(true);
			expect(vars.some((v) => v.key === 'grad-050')).toBe(true);
			expect(vars.some((v) => v.key === 'grad-100')).toBe(true);
			expect(vars.filter((v) => v.key.startsWith('grad-')).length).toBe(3);
		});
	});

	describe('Themed Colors and Defaults', () => {
		it('should use themed defaults when no override is present', () => {
			const config = {
				sec: {
					tc: {
						id: 'themed-color',
						type: SettingType.VARIABLE_THEMED_COLOR,
						'default-light': '#ffffff',
						'default-dark': '#000000',
						format: 'hex',
					},
				},
			};

			const [, themedLight, themedDark] = generator.generateVariableArrays(
				{},
				config as any,
				{},
				mockBridge
			);
			expect(themedLight).toContainEqual({
				key: 'themed-color',
				value: '#ffffff',
			});
			expect(themedDark).toContainEqual({
				key: 'themed-color',
				value: '#000000',
			});
		});

		it('should use themed overrides when present', () => {
			const config = {
				sec: {
					tc: {
						id: 'themed-color',
						type: SettingType.VARIABLE_THEMED_COLOR,
						'default-light': '#ffffff',
						'default-dark': '#000000',
						format: 'hex',
					},
				},
			};
			const settings = {
				'sec@@tc@@light': '#eeeeee',
				'sec@@tc@@dark': '#111111',
			};

			const [, themedLight, themedDark] = generator.generateVariableArrays(
				settings,
				config as any,
				{},
				mockBridge
			);
			expect(themedLight).toContainEqual({
				key: 'themed-color',
				value: '#eeeeee',
			});
			expect(themedDark).toContainEqual({
				key: 'themed-color',
				value: '#111111',
			});
		});

		it('should handle mixed themed overrides (one mode overridden, other default)', () => {
			const config = {
				sec: {
					tc: {
						id: 'themed-color',
						type: SettingType.VARIABLE_THEMED_COLOR,
						'default-light': '#ffffff',
						'default-dark': '#000000',
						format: 'hex',
					},
				},
			};
			const settings = {
				'sec@@tc@@light': '#eeeeee',
			};

			const [, themedLight, themedDark] = generator.generateVariableArrays(
				settings,
				config as any,
				{},
				mockBridge
			);
			expect(themedLight).toContainEqual({
				key: 'themed-color',
				value: '#eeeeee',
			});
			expect(themedDark).toContainEqual({
				key: 'themed-color',
				value: '#000000',
			});
		});

		it('should always generate the sticky heading position variable', () => {
			const [vars] = generator.generateVariableArrays({}, {}, {}, mockBridge);
			expect(vars).toContainEqual({
				key: 'sm-style-heading-position',
				value: 'sticky',
			});

			settingsStore[STICKY_HEADING_KEY] = false;
			const [varsOff] = generator.generateVariableArrays(
				settingsStore,
				{},
				{},
				mockBridge
			);
			expect(varsOff).toContainEqual({
				key: 'sm-style-heading-position',
				value: 'static',
			});
		});
	});

	describe('CSS Variable Resolution for Defaults', () => {
		it('should resolve CSS variables used as default colors', () => {
			mockPlugin.settingsService.styleSheetManager.getCSSVar.mockImplementation(
				(id: string) => {
					if (id === 'my-hex')
						return { current: '#ff0000', light: '#ff0000', dark: '#00ff00' };
					if (id === 'my-hsl')
						return {
							current: 'hsl(120, 100%, 50%)',
							light: 'hsl(120, 100%, 50%)',
							dark: 'hsl(120, 100%, 50%)',
						};
					if (id === 'my-rgb')
						return {
							current: 'rgb(0, 0, 255)',
							light: 'rgb(0, 0, 255)',
							dark: 'rgb(0, 0, 255)',
						};
					return undefined;
				}
			);

			const config = {
				sec: {
					c1: {
						id: 'var-hex',
						type: SettingType.VARIABLE_COLOR,
						default: 'var(--my-hex)',
						format: 'hex',
					},
					c2: {
						id: 'var-hsl',
						type: SettingType.VARIABLE_COLOR,
						default: 'var(--my-hsl)',
						format: 'hsl',
					},
					c3: {
						id: 'var-rgb',
						type: SettingType.VARIABLE_THEMED_COLOR,
						'default-light': 'var(--my-rgb)',
						'default-dark': 'var(--my-hex)',
						format: 'rgb',
					},
					c4: {
						id: 'var-num',
						type: SettingType.VARIABLE_NUMBER,
						default: 'var(--my-num)',
					},
					c5: {
						id: 'var-text',
						type: SettingType.VARIABLE_TEXT,
						default: 'var(--my-str)',
					},
				},
			};

			const [vars, themedLight, themedDark] = generator.generateVariableArrays(
				{},
				config as any,
				{},
				mockBridge
			);

			// Check VARIABLE_COLOR
			expect(vars).toContainEqual({ key: 'var-hex', value: '#ff0000' });
			// hsl will be generated correctly since format is hsl
			expect(vars).toContainEqual({
				key: 'var-hsl',
				value: 'hsl(120deg 100% 50%)',
			});

			// Check VARIABLE_THEMED_COLOR
			expect(themedLight).toContainEqual({
				key: 'var-rgb',
				value: 'rgb(0 0 255)',
			});
			expect(themedDark).toContainEqual({
				key: 'var-rgb',
				value: 'rgb(0 255 0)',
			}); // #00ff00 converted to rgb

			// Check that non-color variables emit the var() directly
			expect(vars).toContainEqual({ key: 'var-num', value: 'var(--my-num)' });
			expect(vars).toContainEqual({ key: 'var-text', value: 'var(--my-str)' });
		});

		it('should resolve CSS variables when overridden by user', () => {
			mockPlugin.settingsService.styleSheetManager.getCSSVar.mockImplementation(
				(id: string) => {
					if (id === 'user-override')
						return { current: '#aabbcc', light: '#aabbcc', dark: '#ccbbaa' };
					return undefined;
				}
			);

			const config = {
				sec: {
					c1: {
						id: 'var-color',
						type: SettingType.VARIABLE_COLOR,
						default: '#000000',
						format: 'hex',
					},
				},
			};

			const settings = {
				'sec@@c1': 'var(--user-override)',
			};

			const [vars] = generator.generateVariableArrays(
				settings,
				config as any,
				{},
				mockBridge
			);

			expect(vars).toContainEqual({ key: 'var-color', value: '#aabbcc' });
		});
	});

	describe('Variable Text and Select', () => {
		it('should generate values for VARIABLE_TEXT without quotes', () => {
			const config = {
				sec: {
					txt: {
						id: 'text-var',
						type: SettingType.VARIABLE_TEXT,
						default: 'hello',
						quotes: false,
					},
				},
			};
			const [vars] = generator.generateVariableArrays(
				{},
				config as any,
				{},
				mockBridge
			);
			expect(vars).toContainEqual({ key: 'text-var', value: 'hello' });
		});

		it('should generate values for VARIABLE_TEXT with quotes', () => {
			const config = {
				sec: {
					txt: {
						id: 'text-var',
						type: SettingType.VARIABLE_TEXT,
						default: 'hello',
						quotes: true,
					},
				},
			};
			const [vars] = generator.generateVariableArrays(
				{},
				config as any,
				{},
				mockBridge
			);
			expect(vars).toContainEqual({ key: 'text-var', value: "'hello'" });
		});

		it('should handle empty quotes for VARIABLE_TEXT', () => {
			const config = {
				sec: {
					txt: {
						id: 'text-var',
						type: SettingType.VARIABLE_TEXT,
						default: '""',
						quotes: true,
					},
				},
			};
			const [vars] = generator.generateVariableArrays(
				{},
				config as any,
				{},
				mockBridge
			);
			expect(vars).toContainEqual({ key: 'text-var', value: '' });
		});

		it('should generate values for VARIABLE_SELECT', () => {
			const config = {
				sec: {
					sel: {
						id: 'select-var',
						type: SettingType.VARIABLE_SELECT,
						default: 'option1',
					},
				},
			};
			const [vars] = generator.generateVariableArrays(
				{},
				config as any,
				{},
				mockBridge
			);
			expect(vars).toContainEqual({ key: 'select-var', value: 'option1' });
		});
	});

	describe('Variable Number Formats', () => {
		it('should append format to VARIABLE_NUMBER', () => {
			const config = {
				sec: {
					num: {
						id: 'num-var',
						type: SettingType.VARIABLE_NUMBER,
						default: 16,
						format: 'px',
					},
				},
			};
			const [vars] = generator.generateVariableArrays(
				{},
				config as any,
				{},
				mockBridge
			);
			expect(vars).toContainEqual({ key: 'num-var', value: '16px' });
		});
	});

	describe('Advanced Color Resolution Parsing', () => {
		it('should resolve colors using various ID formats via styleSheetManager', () => {
			const config = {
				sec: {
					col: {
						id: 'res-col',
						type: SettingType.VARIABLE_COLOR,
						default: '#ffffff',
						format: 'hex',
					},
				},
			};
			const gradients = {
				sec: [
					{
						id: 'grad-var',
						type: SettingType.COLOR_GRADIENT,
						from: 'res-col',
						to: 'var(--existing-var)',
						format: 'hex',
						step: 100,
						pad: 2,
						title: 'Grad Var',
					},
					{
						id: 'grad-dash',
						type: SettingType.COLOR_GRADIENT,
						from: 'res-col',
						to: '--existing-var',
						format: 'hex',
						step: 100,
						pad: 2,
						title: 'Grad Dash',
					},
					{
						id: 'grad-raw',
						type: SettingType.COLOR_GRADIENT,
						from: 'res-col',
						to: 'existing-var',
						format: 'hex',
						step: 100,
						pad: 2,
						title: 'Grad Raw',
					},
				],
			};

			const [vars] = generator.generateVariableArrays(
				{},
				config as any,
				gradients as any,
				mockBridge
			);

			// Mock returns #888888 for current -> rgb(136 136 136)
			// These are the 'to' colors (index 100)
			expect(
				vars.some(
					(v) => v.key === 'grad-var-100' && v.value === 'rgb(136 136 136)'
				)
			).toBe(true);
			expect(
				vars.some(
					(v) => v.key === 'grad-dash-100' && v.value === 'rgb(136 136 136)'
				)
			).toBe(true);
			expect(
				vars.some(
					(v) => v.key === 'grad-raw-100' && v.value === 'rgb(136 136 136)'
				)
			).toBe(true);
		});
	});

	describe('DOM Integration', () => {
		it('should inject variables and apply styles successfully', () => {
			generator.config = {
				sec: {
					num: {
						id: 'num-var',
						type: SettingType.VARIABLE_NUMBER,
						default: 12,
						title: 'Number Test',
					},
				},
			};

			generator.applyStyles();

			// Read directly from generator object to avoid strict DOM query parsing issues
			expect(generator.styleTag.textContent).toContain(
				'--num-var: 12 !important;'
			);
			expect(mockBridge.triggerEvent).toHaveBeenCalledWith('css-change', {
				source: 'style-manager',
			});
		});

		it('should minify generated CSS output', () => {
			generator.config = {
				sec: {
					num: {
						id: 'n',
						type: SettingType.VARIABLE_NUMBER,
						default: 1,
						title: 'Num',
					},
				},
			};
			generator.applyStyles();
			const styleTag = document.getElementById('style-manager-styles');
			expect(styleTag?.textContent).not.toMatch(/\n/);
			expect(styleTag?.textContent).not.toMatch(/\s{2,}/);
		});

		it('should ensure style tag is always at the end of the head', () => {
			const head = document.head;
			const dummy = document.createElement('div');
			head.appendChild(dummy);

			generator.setCSSVariables();

			expect(head.lastChild).toBe(generator.styleTag);
		});
	});
});

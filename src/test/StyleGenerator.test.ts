/*
    Style Manager - Obsidian Plugin
    Copyright (c) 2026 emarpiee

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
		
		// Clean up existing style elements
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
						if (id === 'existing-var') {
							return { light: '#ffffff', dark: '#000000', current: '#888888' };
						}
						return undefined;
					}),
				},
			},
		};

		generator = new StyleGenerator(mockPlugin, mockBridge, getSettings);
	});

	it('should create style tag and append to document head on init', () => {
		const styleTag = document.getElementById('style-manager-styles');
		expect(styleTag).not.toBeNull();
		expect(styleTag?.parentElement).toBe(document.head);
	});

	it('should add/remove classes to document body based on configuration', () => {
		generator.config = {
			sectionA: {
				toggle1: { id: 'class-tg-1', type: SettingType.CLASS_TOGGLE, default: true, title: 'Toggle Test' },
				select1: {
					id: 'class-sel-1',
					type: SettingType.CLASS_SELECT,
					default: 'opt-a',
					options: ['opt-a', 'opt-b'],
					title: 'Select Test',
				},
			},
		};

		// 1. Using defaults since settingsStore is empty
		generator.initClasses();
		expect(document.body.classList.contains('class-tg-1')).toBe(true);
		expect(document.body.classList.contains('opt-a')).toBe(true);

		// 2. Remove classes
		generator.removeClasses();
		expect(document.body.classList.contains('class-tg-1')).toBe(false);
		expect(document.body.classList.contains('opt-a')).toBe(false);

		// 3. Using specific settings overrides
		settingsStore = {
			'sectionA@@toggle1': false,
			'sectionA@@select1': 'opt-b',
		};
		generator.initClasses();
		expect(document.body.classList.contains('class-tg-1')).toBe(false);
		expect(document.body.classList.contains('opt-b')).toBe(true);
	});

	it('should generate variable arrays with color conversions', () => {
		const config = {
			sec: {
				color1: {
					id: 'c1',
					type: SettingType.VARIABLE_COLOR,
					default: '#ff0000',
					format: 'rgb',
					opacity: true,
					'alt-format': [{ id: 'c1-hex', format: 'hex' }],
				},
				num1: {
					id: 'n1',
					type: SettingType.VARIABLE_NUMBER,
					default: 1.5,
					format: 'em',
				},
				txt1: {
					id: 't1',
					type: SettingType.VARIABLE_TEXT,
					default: 'sans-serif',
					quotes: true,
				},
			},
		};

		settingsStore = {
			'sec@@color1': '#00ff00',
			'sec@@num1': 2,
		};

		const [vars] = generator.generateVariableArrays(settingsStore, config as any, {}, mockBridge);

		// Expect format rgb and hex alt format
		expect(vars).toContainEqual({ key: 'c1', value: 'rgb(0 255 0)' });
		expect(vars).toContainEqual({ key: 'c1-hex', value: '#00ff00' });
		// Expect number unit format
		expect(vars).toContainEqual({ key: 'n1', value: '2em' });
		// Expect text quotes format
		expect(vars).toContainEqual({ key: 't1', value: "'sans-serif'" });
	});

	it('should supportthemed color variables and gradients', () => {
		const config = {
			sec: {
				themedCol: {
					id: 'tc',
					type: SettingType.VARIABLE_THEMED_COLOR,
					'default-light': '#ffffff',
					'default-dark': '#000000',
					format: 'hex',
				},
			},
		};

		settingsStore = {
			'sec@@themedCol@@light': '#eeeeee',
			'sec@@themedCol@@dark': '#111111',
		};

		const gradients = {
			sec: [
				{
					id: 'grad',
					from: 'tc',
					to: 'existing-var',
					format: 'hex',
					step: 50,
					pad: 2,
				} as any,
			],
		};

		const [vars, themedLight, themedDark] = generator.generateVariableArrays(
			settingsStore,
			config as any,
			gradients,
			mockBridge
		);

		// Themed variables
		expect(themedLight).toContainEqual({ key: 'tc', value: '#eeeeee' });
		expect(themedDark).toContainEqual({ key: 'tc', value: '#111111' });

		// Gradients should resolve scale values
		// Step 50 resolves tc-00, tc-50, tc-100
		expect(themedLight.some((kv) => kv.key.startsWith('grad-00'))).toBe(true);
		expect(themedLight.some((kv) => kv.key.startsWith('grad-50'))).toBe(true);
		expect(themedLight.some((kv) => kv.key.startsWith('grad-100'))).toBe(true);
	});

	it('should inject variables and apply styles successfully', () => {
		generator.config = {
			sec: {
				num: { id: 'num-var', type: SettingType.VARIABLE_NUMBER, default: 12, title: 'Number Test' },
			},
		};

		generator.applyStyles();

		const styleTag = document.getElementById('style-manager-styles');
		expect(styleTag?.textContent).toContain('--num-var: 12 !important;');
		expect(mockBridge.triggerEvent).toHaveBeenCalledWith('css-change', { source: 'style-manager' });
	});

	it('should clean up stylesheets on destroy', () => {
		generator.destroy();
		const styleTag = document.getElementById('style-manager-styles');
		expect(styleTag).toBeNull();
	});
});

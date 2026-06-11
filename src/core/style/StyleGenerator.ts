/*
    Style Manager - Obsidian Plugin
    Copyright (c) 2023 mgmeyers
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
import chroma from 'chroma-js';

import { STICKY_HEADING_KEY } from '../../constants';
import { ObsidianBridge } from '../../infrastructure/bridge/ObsidianBridge';
import type StyleManagerPlugin from '../../main';
import {
	CSSSetting,
	ColorGradient,
	MappedSettings,
	SettingValue,
	StyleManagerSettings,
	VariableColor,
	VariableKV,
	VariableNumber,
	VariableNumberSlider,
	VariableSelect,
	VariableText,
	VariableThemedColor,
} from '../../types';
import { SettingType } from '../../ui/components/base/types';

type ColorFormat =
	| 'hex'
	| 'hsl'
	| 'hsl-values'
	| 'hsl-split'
	| 'hsl-split-decimal'
	| 'rgb'
	| 'rgb-values'
	| 'rgb-split';
type AltFormatList = Array<{ id: string; format: ColorFormat }>;

/**
 * Core Engine for generating CSS variables and managing DOM classes.
 * Extracted from SettingsService to provide a clean separation between
 * state management and visual application.
 */
export class StyleGenerator {
	public styleTag: HTMLStyleElement;
	public config: MappedSettings = {};
	public gradients: Record<string, ColorGradient[]> = {};

	constructor(
		private plugin: StyleManagerPlugin,
		private bridge: ObsidianBridge,
		private getSettings: () => StyleManagerSettings
	) {
		this.styleTag = document.createElement('style');
		this.styleTag.id = 'style-manager-styles';
		document.head.appendChild(this.styleTag);
	}

	/**
	 * Cleans up DOM elements and classes.
	 */
	public destroy(): void {
		this.styleTag?.remove();
		this.removeClasses();
	}
	/**
	 * Updates the full visual state: classes and CSS variables.
	 */
	public applyStyles(): void {
		this.removeClasses();
		this.initClasses();
		this.setCSSVariables();
	}

	/**
	 * Injects generated CSS variables into the provided style tag.
	 */
	public setCSSVariables(): void {
		const [vars, themedLight, themedDark] = this.generateVariableArrays(
			this.getSettings(),
			this.config,
			this.gradients,
			this.bridge
		);

		this.styleTag.textContent = `
			body.style-manager-css {
				${vars.reduce((combined: string, current: { key: string; value: string }) => {
					return combined + `--${current.key}: ${current.value} !important; `;
				}, '')}
			}

			body.theme-light.style-manager-css {
				${themedLight.reduce(
					(combined: string, current: { key: string; value: string }) => {
						return combined + `--${current.key}: ${current.value} !important; `;
					},
					''
				)}
			}

			body.theme-dark.style-manager-css {
				${themedDark.reduce(
					(combined: string, current: { key: string; value: string }) => {
						return combined + `--${current.key}: ${current.value} !important; `;
					},
					''
				)}
			}
			`;

		this.styleTag.textContent = this.styleTag.textContent
			.trim()
			.replace(/[\r\n\s]+/g, ' ');

		// Ensure our style tag is always at the end of the head for highest precedence
		if (this.styleTag.parentElement) {
			this.styleTag.parentElement.appendChild(this.styleTag);
		}

		this.bridge.triggerEvent('css-change', {
			source: 'style-manager',
		});
	}

	/**
	 * Applies class-based settings to the document body.
	 */
	public initClasses(): void {
		const settings = this.getSettings();
		Object.keys(this.config).forEach((section) => {
			const sectionConfig = this.config[section];

			Object.keys(sectionConfig).forEach((settingId) => {
				const setting = sectionConfig[settingId];

				if (setting.type === SettingType.CLASS_TOGGLE) {
					const value = settings[`${section}@@${settingId}`] as
						| boolean
						| undefined;
					const settingWithDefault = setting as CSSSetting & {
						default?: boolean;
					};
					if (
						value === true ||
						(value === undefined && settingWithDefault.default === true)
					) {
						document.body.classList.add(setting.id);
					}
				} else if (setting.type === SettingType.CLASS_SELECT) {
					const multiToggle = setting as CSSSetting & {
						default?: string;
						options?: Array<string | { value: string }>;
					};
					let value = settings[`${section}@@${settingId}`] as
						| string
						| undefined;

					if (value === undefined && !!multiToggle.default) {
						value = multiToggle.default;
					} else if (value === undefined) {
						value = 'none';
					}

					if (value !== 'none') {
						document.body.classList.add(value);
					}
				}
			});
		});
	}

	/**
	 * Removes all Style Manager managed classes from the document body.
	 */
	public removeClasses(): void {
		Object.keys(this.config).forEach((section) => {
			const sectionConfig = this.config[section];

			Object.keys(sectionConfig).forEach((settingId) => {
				const setting = sectionConfig[settingId];

				if (setting.type === SettingType.CLASS_TOGGLE) {
					document.body.classList.remove(setting.id);
				} else if (setting.type === SettingType.CLASS_SELECT) {
					const multiToggle = setting as CSSSetting & {
						options?: Array<string | { value: string }>;
					};
					(multiToggle.options || []).forEach((v) => {
						if (typeof v === 'string') {
							document.body.classList.remove(v);
						} else {
							document.body.classList.remove(v.value);
						}
					});
				}
			});
		});
	}

	/**
	 * Maps parsed CSS settings to internal config and triggers variable update.
	 */
	public setConfig(
		parsedSettings: import('../../types').ParsedCSSSettings[]
	): void {
		this.config = {};
		this.gradients = {};

		parsedSettings.forEach((s) => {
			this.config[s.id] = {};
			s.settings.forEach((setting: CSSSetting) => {
				this.config[s.id][setting.id] = setting;

				if (setting.type === SettingType.COLOR_GRADIENT) {
					if (!this.gradients[s.id]) this.gradients[s.id] = [];
					this.gradients[s.id].push(setting as ColorGradient);
				}
			});
		});

		this.setCSSVariables();
	}

	/**
	 * Internal logic for calculating variable values.
	 */
	public generateVariableArrays(
		settings: StyleManagerSettings,
		config: MappedSettings,
		gradients: Record<string, ColorGradient[]>,
		bridge: ObsidianBridge
	): [VariableKV, VariableKV, VariableKV] {
		const resolveColor = (
			val: string,
			mode: 'light' | 'dark' | 'current',
			candidates: Record<string, string>
		): string => {
			if (!val) return '';
			const trimmed = val.trim();
			if (candidates[trimmed]) return candidates[trimmed];
			if (chroma.valid(trimmed)) return trimmed;

			// Handle var(--id) or --id or id
			let id = trimmed;
			if (id.startsWith('var(--') && id.endsWith(')')) {
				id = id.substring(6, id.length - 1);
			} else if (id.startsWith('--')) {
				id = id.substring(2);
			}

			const styleSheetManager = (
				this.plugin as StyleManagerPlugin & {
					settingsService?: {
						styleSheetManager?: {
							getCSSVar: (
								id: string
							) => { light: string; dark: string; current: string } | undefined;
						};
					};
				}
			)?.settingsService?.styleSheetManager;
			if (styleSheetManager) {
				const res = styleSheetManager.getCSSVar(id);
				const resolved = res?.[mode];
				if (resolved && chroma.valid(resolved)) return resolved;
			}

			return trimmed;
		};

		const vars: VariableKV = [];
		const themedLight: VariableKV = [];
		const themedDark: VariableKV = [];

		const stickyHeading = settings[STICKY_HEADING_KEY] !== false;
		vars.push({
			key: 'sm-style-heading-position',
			value: stickyHeading ? 'sticky' : 'static',
		});

		const gradientCandidates: Record<string, string> = {};
		const gradientCandidatesLight: Record<string, string> = {};
		const gradientCandidatesDark: Record<string, string> = {};

		// Pass 1: Emit CSS variables for all user-saved overrides.
		for (const key in settings) {
			const [sectionId, settingId, modifier] = key.split('@@');
			const section = config[sectionId];
			if (!section) continue;

			const setting: CSSSetting = config[sectionId][settingId];
			if (!setting) continue;

			const value: SettingValue = settings[key];

			switch (setting.type) {
				case SettingType.VARIABLE_NUMBER:
				case SettingType.VARIABLE_NUMBER_SLIDER: {
					const s = setting as VariableNumber | VariableNumberSlider;
					const val = value !== undefined ? value : s.default;
					vars.push({ key: setting.id, value: `${val}${s.format || ''}` });
					continue;
				}
				case SettingType.VARIABLE_TEXT:
				case SettingType.VARIABLE_SELECT: {
					const s = setting as VariableText | VariableSelect;
					let text =
						value !== undefined ? value.toString() : s.default.toString();
					if (s.quotes) {
						text = text !== `""` ? `'${text}'` : ``;
					}
					vars.push({ key: setting.id, value: text });
					continue;
				}
				case SettingType.VARIABLE_COLOR: {
					const s = setting as VariableColor;
					const color = value !== undefined ? value.toString() : s.default;
					if (color && chroma.valid(color)) {
						vars.push(
							...this.generateColorVariables(
								setting.id,
								s.format as ColorFormat,
								color,
								s.opacity,
								s['alt-format'] as AltFormatList
							)
						);
						this.generateColorVariables(
							setting.id,
							'rgb',
							color,
							s.opacity
						).forEach((kv: { key: string; value: string }) => {
							gradientCandidates[kv.key] = kv.value;
						});
					}
					continue;
				}
				case SettingType.VARIABLE_THEMED_COLOR: {
					const s = setting as VariableThemedColor;
					const colorKey =
						modifier === 'light' ? 'default-light' : 'default-dark';
					const color =
						value !== undefined
							? value.toString()
							: (s as VariableThemedColor & Record<string, string>)[colorKey];
					if (color && chroma.valid(color)) {
						(modifier === 'light' ? themedLight : themedDark).push(
							...this.generateColorVariables(
								setting.id,
								s.format as ColorFormat,
								color,
								s.opacity,
								s['alt-format'] as AltFormatList
							)
						);
						this.generateColorVariables(
							setting.id,
							'rgb',
							color,
							s.opacity
						).forEach((kv: { key: string; value: string }) => {
							if (modifier === 'light')
								gradientCandidatesLight[kv.key] = kv.value;
							else gradientCandidatesDark[kv.key] = kv.value;
						});
					}
					continue;
				}
			}
		}

		// Build a set of "sectionId@@settingId" keys that were already emitted in Pass 1.
		// For themed colors, also track per-mode overrides ("sectionId@@settingId@@light/dark").
		const emittedIds = new Set<string>();
		const emittedThemedLight = new Set<string>();
		const emittedThemedDark = new Set<string>();
		for (const key in settings) {
			const parts = key.split('@@');
			if (parts.length >= 2 && config[parts[0]]?.[parts[1]]) {
				emittedIds.add(`${parts[0]}@@${parts[1]}`);
				if (parts[2] === 'light')
					emittedThemedLight.add(`${parts[0]}@@${parts[1]}`);
				if (parts[2] === 'dark')
					emittedThemedDark.add(`${parts[0]}@@${parts[1]}`);
			}
		}

		// Pass 2: For every setting in the schema that has no user override, emit its
		// schema default as a CSS variable. This ensures defaults are always applied
		// and CSS variables are never missing just because the user hasn't touched them.
		for (const sectionId in config) {
			const section = config[sectionId];
			for (const settingId in section) {
				const compositeKey = `${sectionId}@@${settingId}`;
				const setting: CSSSetting = section[settingId];

				switch (setting.type) {
					case SettingType.VARIABLE_NUMBER:
					case SettingType.VARIABLE_NUMBER_SLIDER: {
						if (emittedIds.has(compositeKey)) break;
						const s = setting as VariableNumber | VariableNumberSlider;
						if (s.default !== undefined) {
							vars.push({ key: s.id, value: `${s.default}${s.format || ''}` });
						}
						break;
					}
					case SettingType.VARIABLE_TEXT:
					case SettingType.VARIABLE_SELECT: {
						if (emittedIds.has(compositeKey)) break;
						const s = setting as VariableText | VariableSelect;
						if (s.default !== undefined) {
							let text = s.default.toString();
							if (s.quotes) text = text !== `""` ? `'${text}'` : ``;
							vars.push({ key: s.id, value: text });
						}
						break;
					}
					case SettingType.VARIABLE_COLOR: {
						if (emittedIds.has(compositeKey)) break;
						const s = setting as VariableColor;
						if (s.default && chroma.valid(s.default)) {
							vars.push(
								...this.generateColorVariables(
									s.id,
									s.format as ColorFormat,
									s.default,
									s.opacity,
									s['alt-format'] as AltFormatList
								)
							);
							this.generateColorVariables(
								s.id,
								'rgb',
								s.default,
								s.opacity
							).forEach((kv: { key: string; value: string }) => {
								gradientCandidates[kv.key] = kv.value;
							});
						}
						break;
					}
					case SettingType.VARIABLE_THEMED_COLOR: {
						const s = setting as VariableThemedColor;
						// Emit light default if no light override was saved
						if (
							!emittedThemedLight.has(compositeKey) &&
							s['default-light'] &&
							chroma.valid(s['default-light'])
						) {
							themedLight.push(
								...this.generateColorVariables(
									s.id,
									s.format as ColorFormat,
									s['default-light'],
									s.opacity,
									s['alt-format'] as AltFormatList
								)
							);
							this.generateColorVariables(
								s.id,
								'rgb',
								s['default-light'],
								s.opacity
							).forEach((kv: { key: string; value: string }) => {
								gradientCandidatesLight[kv.key] = kv.value;
							});
						}
						// Emit dark default if no dark override was saved
						if (
							!emittedThemedDark.has(compositeKey) &&
							s['default-dark'] &&
							chroma.valid(s['default-dark'])
						) {
							themedDark.push(
								...this.generateColorVariables(
									s.id,
									s.format as ColorFormat,
									s['default-dark'],
									s.opacity,
									s['alt-format'] as AltFormatList
								)
							);
							this.generateColorVariables(
								s.id,
								'rgb',
								s['default-dark'],
								s.opacity
							).forEach((kv: { key: string; value: string }) => {
								gradientCandidatesDark[kv.key] = kv.value;
							});
						}
						break;
					}
				}
			}
		}

		Object.keys(gradients).forEach((sectionId) => {
			const g = gradients[sectionId];
			if (!g) return;

			g.forEach((def) => {
				const { from, to, format, step, id, pad = 0 } = def;

				if (gradientCandidatesLight[from]) {
					const fromColor = gradientCandidatesLight[from];
					const toColor =
						gradientCandidatesLight[to] ||
						resolveColor(to, 'light', gradientCandidatesLight) ||
						(
							bridge.getNativeConfig('customCss') as {
								themes?: Record<string, { css?: string }>;
							}
						)?.themes?.[to]?.css;
					if (toColor && chroma.valid(fromColor) && chroma.valid(toColor)) {
						this.pushColors(
							themedLight,
							id,
							fromColor,
							toColor,
							format as 'hsl' | 'rgb' | 'hex',
							step,
							pad
						);
					}
				}

				if (gradientCandidatesDark[from]) {
					const fromColor = gradientCandidatesDark[from];
					const toColor =
						gradientCandidatesDark[to] ||
						resolveColor(to, 'dark', gradientCandidatesDark) ||
						(
							bridge.getNativeConfig('customCss') as {
								themes?: Record<string, { css?: string }>;
							}
						)?.themes?.[to]?.css;
					if (toColor && chroma.valid(fromColor) && chroma.valid(toColor)) {
						this.pushColors(
							themedDark,
							id,
							fromColor,
							toColor,
							format as 'hsl' | 'rgb' | 'hex',
							step,
							pad
						);
					}
				}

				if (gradientCandidates[from]) {
					const fromColor = gradientCandidates[from];
					const toColor =
						gradientCandidates[to] ||
						resolveColor(to, 'current', gradientCandidates) ||
						(
							bridge.getNativeConfig('customCss') as {
								themes?: Record<string, { css?: string }>;
							}
						)?.themes?.[to]?.css;
					if (toColor && chroma.valid(fromColor) && chroma.valid(toColor)) {
						this.pushColors(
							vars,
							id,
							fromColor,
							toColor,
							format as 'hsl' | 'rgb' | 'hex',
							step,
							pad
						);
					}
				}
			});
		});

		return [vars, themedLight, themedDark];
	}

	private generateColorVariables(
		key: string,
		format: ColorFormat,
		colorStr: string,
		opacity: boolean | undefined,
		altFormats: AltFormatList = []
	): VariableKV {
		const parsedColor = chroma(colorStr);
		const alts = altFormats.reduce<VariableKV>((a, alt) => {
			a.push(
				...this.generateColorVariables(alt.id, alt.format, colorStr, opacity)
			);
			return a;
		}, []);

		switch (format) {
			case 'hex':
				return [{ key, value: colorStr }, ...alts];
			case 'hsl':
				return [{ key, value: parsedColor.css('hsl') }, ...alts];
			case 'hsl-values': {
				const hsl = parsedColor.hsl();
				const alpha = opacity ? `,${parsedColor.alpha()}` : '';
				const h = isNaN(hsl[0]) ? 0 : hsl[0];
				return [
					{ key, value: `${h},${hsl[1] * 100}%,${hsl[2] * 100}%${alpha}` },
					...alts,
				];
			}
			case 'hsl-split': {
				const hsl = parsedColor.hsl();
				const h = isNaN(hsl[0]) ? 0 : hsl[0];
				const out = [
					{ key: `${key}-h`, value: h.toString() },
					{ key: `${key}-s`, value: (hsl[1] * 100).toString() + '%' },
					{ key: `${key}-l`, value: (hsl[2] * 100).toString() + '%' },
					...alts,
				];
				if (opacity)
					out.push({ key: `${key}-a`, value: parsedColor.alpha().toString() });
				return out;
			}
			case 'hsl-split-decimal': {
				const hsl = parsedColor.hsl();
				const h = isNaN(hsl[0]) ? 0 : hsl[0];
				const out = [
					{ key: `${key}-h`, value: h.toString() },
					{ key: `${key}-s`, value: hsl[1].toString() },
					{ key: `${key}-l`, value: hsl[2].toString() },
					...alts,
				];
				if (opacity)
					out.push({ key: `${key}-a`, value: parsedColor.alpha().toString() });
				return out;
			}
			case 'rgb':
				return [{ key, value: parsedColor.css() }, ...alts];
			case 'rgb-values': {
				const rgb = parsedColor.rgb();
				const alpha = opacity ? `,${parsedColor.alpha()}` : '';
				return [
					{ key, value: `${rgb[0]},${rgb[1]},${rgb[2]}${alpha}` },
					...alts,
				];
			}
			case 'rgb-split': {
				const rgb = parsedColor.rgb();
				const out = [
					{ key: `${key}-r`, value: rgb[0].toString() },
					{ key: `${key}-g`, value: rgb[1].toString() },
					{ key: `${key}-b`, value: rgb[2].toString() },
					...alts,
				];
				if (opacity)
					out.push({ key: `${key}-a`, value: parsedColor.alpha().toString() });
				return out;
			}
		}
	}

	private pushColors(
		arr: VariableKV,
		id: string,
		from: string,
		to: string,
		format: 'hsl' | 'rgb' | 'hex',
		step: number,
		pad: number
	): void {
		const scale = chroma.scale([from.trim(), to.trim()]).domain([0, 100]);
		for (let i = 0; i <= 100; i++) {
			if (i % step === 0) {
				const c = scale(i);
				arr.push(
					...this.generateColorVariables(
						`${id}-${i.toString().padStart(pad, '0')}`,
						format,
						c.css(),
						c.alpha() !== 1
					)
				);
			}
		}
	}
}

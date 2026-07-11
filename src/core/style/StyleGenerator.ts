/*
    Style Manager - Obsidian Plugin
    Copyright (c) 2026 emarpiee

		Style Settings - Obsidian Plugin
    Copyright (c) 2023 mgmeyers

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

import { PreferencesKeys } from '../../constants';
import { ObsidianBridge } from '../../infrastructure/bridge/ObsidianBridge';
import type StyleManagerPlugin from '../../main';
import {
	AltFormatList,
	CSSSetting,
	ColorFormat,
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
		document.head.insertAdjacentHTML('beforeend', '<style id="style-manager-css"></style>');
		this.styleTag = document.getElementById('style-manager-css') as HTMLStyleElement;
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
			body.css-settings-manager, body.style-manager-css {
				${vars.reduce(
					(
						combined: string,
						current: { key: string; value: string; important?: boolean }
					) => {
						return (
							combined +
							`--${current.key}: ${current.value}${current.important ? ' !important' : ''}; `
						);
					},
					''
				)}
			}

			body.theme-light.css-settings-manager, body.theme-light.style-manager-css {
				${themedLight.reduce(
					(
						combined: string,
						current: { key: string; value: string; important?: boolean }
					) => {
						return (
							combined +
							`--${current.key}: ${current.value}${current.important ? ' !important' : ''}; `
						);
					},
					''
				)}
			}

			body.theme-dark.css-settings-manager, body.theme-dark.style-manager-css {
				${themedDark.reduce(
					(
						combined: string,
						current: { key: string; value: string; important?: boolean }
					) => {
						return (
							combined +
							`--${current.key}: ${current.value}${current.important ? ' !important' : ''}; `
						);
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
			if (!Array.isArray(s.settings)) return;
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
			candidates: Record<string, { value: string; important: boolean }>
		): { value: string; important: boolean } => {
			if (!val) return { value: '', important: false };
			const trimmed = val.trim();
			if (candidates[trimmed]) return candidates[trimmed];
			if (chroma.valid(trimmed)) return { value: trimmed, important: false };

			return { value: trimmed, important: false };
		};

		const vars: VariableKV = [];
		const themedLight: VariableKV = [];
		const themedDark: VariableKV = [];

		const stickyHeading = settings[PreferencesKeys.STICKY_HEADING] !== false;
		vars.push({
			key: 'sm-style-heading-position',
			value: stickyHeading ? 'sticky' : 'static',
		});

		const gradientCandidates: Record<
			string,
			{ value: string; important: boolean }
		> = {};
		const gradientCandidatesLight: Record<
			string,
			{ value: string; important: boolean }
		> = {};
		const gradientCandidatesDark: Record<
			string,
			{ value: string; important: boolean }
		> = {};

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
					if (val !== undefined && val !== null) {
						vars.push({
							key: setting.id,
							value: `${val}${s.format || ''}`,
							important: true,
						});
					}
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
					if (text !== '') {
						vars.push({ key: setting.id, value: text, important: true });
					}
					continue;
				}
				case SettingType.VARIABLE_COLOR: {
					const s = setting as VariableColor;
					const color = value !== undefined ? value.toString() : s.default;
					const { value: resolvedColor } = resolveColor(
						color,
						'current',
						gradientCandidates
					);
					if (resolvedColor && chroma.valid(resolvedColor)) {
						vars.push(
							...this.generateColorVariables(
								setting.id,
								s.format as ColorFormat,
								resolvedColor,
								s.opacity,
								s['alt-format'] as AltFormatList,
								true
							)
						);
						this.generateColorVariables(
							setting.id,
							'rgb',
							resolvedColor,
							s.opacity,
							[],
							true
						).forEach(
							(kv: { key: string; value: string; important?: boolean }) => {
								gradientCandidates[kv.key] = {
									value: kv.value,
									important: kv.important,
								};
							}
						);
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
					const mode = modifier === 'light' ? 'light' : 'dark';
					const candidates =
						modifier === 'light'
							? gradientCandidatesLight
							: gradientCandidatesDark;
					const { value: resolvedColor } = resolveColor(
						color,
						mode,
						candidates
					);
					if (resolvedColor && chroma.valid(resolvedColor)) {
						(modifier === 'light' ? themedLight : themedDark).push(
							...this.generateColorVariables(
								setting.id,
								s.format as ColorFormat,
								resolvedColor,
								s.opacity,
								s['alt-format'] as AltFormatList,
								true
							)
						);
						this.generateColorVariables(
							setting.id,
							'rgb',
							resolvedColor,
							s.opacity,
							[],
							true
						).forEach(
							(kv: { key: string; value: string; important?: boolean }) => {
								if (modifier === 'light')
									gradientCandidatesLight[kv.key] = {
										value: kv.value,
										important: kv.important,
									};
								else
									gradientCandidatesDark[kv.key] = {
										value: kv.value,
										important: kv.important,
									};
							}
						);
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
						if (s.default !== undefined && s.default !== null) {
							vars.push({
								key: s.id,
								value: `${s.default}${s.format || ''}`,
								important: false,
							});
						}
						break;
					}
					case SettingType.VARIABLE_TEXT:
					case SettingType.VARIABLE_SELECT: {
						if (emittedIds.has(compositeKey)) break;
						const s = setting as VariableText | VariableSelect;
						if (s.default != null) {
							let text = s.default.toString();
							if (s.quotes) text = text !== `""` ? `'${text}'` : ``;
							if (text !== '') {
								vars.push({ key: s.id, value: text, important: false });
							}
						}
						break;
					}
					case SettingType.VARIABLE_COLOR: {
						if (emittedIds.has(compositeKey)) break;
						const s = setting as VariableColor;
						const { value: resolvedColor } = resolveColor(
							s.default || '',
							'current',
							gradientCandidates
						);
						if (resolvedColor && chroma.valid(resolvedColor)) {
							vars.push(
								...this.generateColorVariables(
									s.id,
									s.format as ColorFormat,
									resolvedColor,
									s.opacity,
									s['alt-format'] as AltFormatList,
									false
								)
							);
							this.generateColorVariables(
								s.id,
								'rgb',
								resolvedColor,
								s.opacity,
								[],
								false
							).forEach(
								(kv: { key: string; value: string; important?: boolean }) => {
									gradientCandidates[kv.key] = {
										value: kv.value,
										important: kv.important,
									};
								}
							);
						}
						break;
					}
					case SettingType.VARIABLE_THEMED_COLOR: {
						const s = setting as VariableThemedColor;
						// Emit light default if no light override was saved
						const { value: resolvedLight } = resolveColor(
							s['default-light'] || '',
							'light',
							gradientCandidatesLight
						);
						if (
							!emittedThemedLight.has(compositeKey) &&
							resolvedLight &&
							chroma.valid(resolvedLight)
						) {
							themedLight.push(
								...this.generateColorVariables(
									s.id,
									s.format as ColorFormat,
									resolvedLight,
									s.opacity,
									s['alt-format'] as AltFormatList,
									false
								)
							);
							this.generateColorVariables(
								s.id,
								'rgb',
								resolvedLight,
								s.opacity,
								[],
								false
							).forEach(
								(kv: { key: string; value: string; important?: boolean }) => {
									gradientCandidatesLight[kv.key] = {
										value: kv.value,
										important: kv.important,
									};
								}
							);
						}
						// Emit dark default if no dark override was saved
						const { value: resolvedDark } = resolveColor(
							s['default-dark'] || '',
							'dark',
							gradientCandidatesDark
						);
						if (
							!emittedThemedDark.has(compositeKey) &&
							resolvedDark &&
							chroma.valid(resolvedDark)
						) {
							themedDark.push(
								...this.generateColorVariables(
									s.id,
									s.format as ColorFormat,
									resolvedDark,
									s.opacity,
									s['alt-format'] as AltFormatList,
									false
								)
							);
							this.generateColorVariables(
								s.id,
								'rgb',
								resolvedDark,
								s.opacity,
								[],
								false
							).forEach(
								(kv: { key: string; value: string; important?: boolean }) => {
									gradientCandidatesDark[kv.key] = {
										value: kv.value,
										important: kv.important,
									};
								}
							);
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
					const fromCand = gradientCandidatesLight[from];
					const fromColor = fromCand.value;
					const toRes =
						gradientCandidatesLight[to] ||
						resolveColor(to, 'light', gradientCandidatesLight) ||
						(
							bridge.getNativeConfig('customCss') as {
								themes?: Record<string, { css?: string }>;
							}
						)?.themes?.[to]?.css;

					if (toRes) {
						const toColor = typeof toRes === 'string' ? toRes : toRes.value;
						const toImportant =
							typeof toRes === 'string' ? false : toRes.important;
						const important = fromCand.important || toImportant;

						if (toColor && chroma.valid(fromColor) && chroma.valid(toColor)) {
							this.pushColors(
								themedLight,
								id,
								fromColor,
								toColor,
								format as 'hsl' | 'rgb' | 'hex' | 'oklch',
								step,
								pad,
								important
							);
						}
					}
				}

				if (gradientCandidatesDark[from]) {
					const fromCand = gradientCandidatesDark[from];
					const fromColor = fromCand.value;
					const toRes =
						gradientCandidatesDark[to] ||
						resolveColor(to, 'dark', gradientCandidatesDark) ||
						(
							bridge.getNativeConfig('customCss') as {
								themes?: Record<string, { css?: string }>;
							}
						)?.themes?.[to]?.css;

					if (toRes) {
						const toColor = typeof toRes === 'string' ? toRes : toRes.value;
						const toImportant =
							typeof toRes === 'string' ? false : toRes.important;
						const important = fromCand.important || toImportant;

						if (toColor && chroma.valid(fromColor) && chroma.valid(toColor)) {
							this.pushColors(
								themedDark,
								id,
								fromColor,
								toColor,
								format as 'hsl' | 'rgb' | 'hex' | 'oklch',
								step,
								pad,
								important
							);
						}
					}
				}

				if (gradientCandidates[from]) {
					const fromCand = gradientCandidates[from];
					const fromColor = fromCand.value;
					const toRes =
						gradientCandidates[to] ||
						resolveColor(to, 'current', gradientCandidates) ||
						(
							bridge.getNativeConfig('customCss') as {
								themes?: Record<string, { css?: string }>;
							}
						)?.themes?.[to]?.css;

					if (toRes) {
						const toColor = typeof toRes === 'string' ? toRes : toRes.value;
						const toImportant =
							typeof toRes === 'string' ? false : toRes.important;
						const important = fromCand.important || toImportant;

						if (toColor && chroma.valid(fromColor) && chroma.valid(toColor)) {
							this.pushColors(
								vars,
								id,
								fromColor,
								toColor,
								format as 'hsl' | 'rgb' | 'hex' | 'oklch',
								step,
								pad,
								important
							);
						}
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
		altFormats: AltFormatList = [],
		important = false
	): VariableKV {
		const parsedColor = chroma(colorStr);
		const alts = altFormats.reduce<VariableKV>((a, alt) => {
			a.push(
				...this.generateColorVariables(
					alt.id,
					alt.format,
					colorStr,
					opacity,
					[],
					important
				)
			);
			return a;
		}, []);

		switch (format) {
			case 'oklch': {
				const oklch = parsedColor.oklch();
				const round = (n: number): number =>
					isNaN(n) ? 0 : parseFloat(n.toFixed(5));
				const l = round(oklch[0]);
				const c = round(oklch[1]);
				const h = round(oklch[2]);
				const alpha = parsedColor.alpha();
				const alphaStr = opacity && alpha !== 1 ? ` / ${round(alpha)}` : '';
				return [
					{ key, value: `oklch(${l} ${c} ${h}${alphaStr})`, important },
					...alts,
				];
			}
			case 'hex':
				return [{ key, value: colorStr, important }, ...alts];
			case 'hsl':
				return [{ key, value: parsedColor.css('hsl'), important }, ...alts];
			case 'hsl-values': {
				const hsl = parsedColor.hsl();
				const alpha = opacity ? `,${parsedColor.alpha()}` : '';
				const h = isNaN(hsl[0]) ? 0 : hsl[0];
				return [
					{
						key,
						value: `${h},${hsl[1] * 100}%,${hsl[2] * 100}%${alpha}`,
						important,
					},
					...alts,
				];
			}
			case 'hsl-split': {
				const hsl = parsedColor.hsl();
				const h = isNaN(hsl[0]) ? 0 : hsl[0];
				const out = [
					{ key: `${key}-h`, value: h.toString(), important },
					{
						key: `${key}-s`,
						value: (hsl[1] * 100).toString() + '%',
						important,
					},
					{
						key: `${key}-l`,
						value: (hsl[2] * 100).toString() + '%',
						important,
					},
					...alts,
				];
				if (opacity)
					out.push({
						key: `${key}-a`,
						value: parsedColor.alpha().toString(),
						important,
					});
				return out;
			}
			case 'hsl-split-decimal': {
				const hsl = parsedColor.hsl();
				const h = isNaN(hsl[0]) ? 0 : hsl[0];
				const out = [
					{ key: `${key}-h`, value: h.toString(), important },
					{ key: `${key}-s`, value: hsl[1].toString(), important },
					{ key: `${key}-l`, value: hsl[2].toString(), important },
					...alts,
				];
				if (opacity)
					out.push({
						key: `${key}-a`,
						value: parsedColor.alpha().toString(),
						important,
					});
				return out;
			}
			case 'rgb':
				return [{ key, value: parsedColor.css(), important }, ...alts];
			case 'rgb-values': {
				const rgb = parsedColor.rgb();
				const alpha = opacity ? `,${parsedColor.alpha()}` : '';
				return [
					{ key, value: `${rgb[0]},${rgb[1]},${rgb[2]}${alpha}`, important },
					...alts,
				];
			}
			case 'rgb-split': {
				const rgb = parsedColor.rgb();
				const out = [
					{ key: `${key}-r`, value: rgb[0].toString(), important },
					{ key: `${key}-g`, value: rgb[1].toString(), important },
					{ key: `${key}-b`, value: rgb[2].toString(), important },
					...alts,
				];
				if (opacity)
					out.push({
						key: `${key}-a`,
						value: parsedColor.alpha().toString(),
						important,
					});
				return out;
			}
		}
	}

	private pushColors(
		arr: VariableKV,
		id: string,
		from: string,
		to: string,
		format: 'hsl' | 'rgb' | 'hex' | 'oklch',
		step: number,
		pad: number,
		important = false
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
						c.alpha() !== 1,
						[],
						important
					)
				);
			}
		}
	}
}

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
import detectIndent from 'detect-indent';
import yaml from 'js-yaml';

import { ParseLogList, ParsedCSSSettings, SnippetMetadata } from '../../types';
import {
	metadataRegExp,
	nameRegExp,
	settingRegExp,
} from '../../utils/CommonUtils';

export class CSSParser {
	private static parseCache: Map<
		string,
		{ settingsList: ParsedCSSSettings[]; parseLogs: ParseLogList }
	> = new Map();

	/**
	 * Parse css settings from a CSSStyleSheet.
	 *
	 * @param sheet the CSSStyleSheet to parse
	 * @returns An object containing the list of parsed settings and any errors encountered
	 */
	public static parseCSS(sheet: CSSStyleSheet): {
		settingsList: ParsedCSSSettings[];
		parseLogs: ParseLogList;
	} {
		const text = sheet?.ownerNode?.textContent?.trim();
		if (!text) return { settingsList: [], parseLogs: [] };
		return this.parseCSSText(text);
	}

	public static parseCSSText(text: string): {
		settingsList: ParsedCSSSettings[];
		parseLogs: ParseLogList;
	} {
		if (!text) return { settingsList: [], parseLogs: [] };

		// CACHE CHECK: If we've already parsed this exact CSS content, return the cached result.
		// This significantly speeds up re-parsing when only one snippet or theme changed.
		if (this.parseCache.has(text)) {
			// LRU refresh: Delete and re-insert to move to end of map (most recently used)
			const cached = this.parseCache.get(text)!;
			this.parseCache.delete(text);
			this.parseCache.set(text, cached);

			// CACHE ISOLATION: Return a clone of the cached result to prevent mutation leaks
			return this.cloneResult(cached);
		}

		const settingsList: ParsedCSSSettings[] = [];
		const parseLogs: ParseLogList = [];

		// Reset regex lastIndex because of 'g' flag
		settingRegExp.lastIndex = 0;
		let match = settingRegExp.exec(text);

		if (match?.length) {
			do {
				const str = match[1].trim();
				const nameMatch = str.match(nameRegExp);
				const name = nameMatch ? nameMatch[1] : 'Unknown';

				try {
					const settings = this.parseCSSSettings(str, name, parseLogs);

					if (
						settings &&
						typeof settings === 'object' &&
						settings.name &&
						settings.id &&
						settings.settings &&
						settings.settings.length
					) {
						settings.raw = str;
						settingsList.push(settings);
					}
				} catch (e) {
					parseLogs.push({ name, message: `${e}`, type: 'error', timestamp: Date.now() });
				}
			} while ((match = settingRegExp.exec(text)) !== null);
		}

		const result = { settingsList, parseLogs };

		// CACHE POPULATE: Limit cache size to prevent memory leaks in extreme cases
		// LRU eviction: If cache exceeds 200, remove the oldest (first) element.
		if (this.parseCache.size >= 200) {
			const firstKey = this.parseCache.keys().next().value;
			if (firstKey !== undefined) {
				this.parseCache.delete(firstKey);
			}
		}
		this.parseCache.set(text, result);

		return this.cloneResult(result);
	}

	/**
	 * Deep clones a parse result to ensure cache isolation.
	 */
	private static cloneResult(result: {
		settingsList: ParsedCSSSettings[];
		parseLogs: ParseLogList;
	}): { settingsList: ParsedCSSSettings[]; parseLogs: ParseLogList } {
		return {
			settingsList: result.settingsList.map((s) => ({
				...s,
				settings: [...s.settings],
			})),
			parseLogs: [...result.parseLogs],
		};
	}

	/**
	 * Parse css settings from a string.
	 *
	 * @param str the stringified settings to parse
	 * @param name the name of the file
	 * @returns ParsedCSSSettings or undefined if the settings are invalid
	 */
	public static parseCSSSettings(
		str: string,
		name: string,
		parseLogs?: ParseLogList
	): ParsedCSSSettings | undefined {
		const indent = detectIndent(str);

		const settings: ParsedCSSSettings = yaml.load(
			str.replace(/\t/g, indent.type === 'space' ? indent.indent : '    '),
			{
				filename: name,
			}
		) as ParsedCSSSettings;

		if (!settings || !Array.isArray(settings.settings)) return undefined;
		settings.settings = settings.settings.filter((setting: any) => {
			if (!setting || typeof setting !== 'object' || !setting.type) return false;

			switch (setting.type) {
				case 'heading':
					if (typeof setting.level !== 'number' || setting.level < 1 || setting.level > 6) {
						const originalLevel = setting.level;
						setting.level = typeof setting.level === 'number' && !isNaN(setting.level) ? Math.max(1, Math.min(6, setting.level)) : 1;
						parseLogs?.push({ name, message: `INVALID_HEADING_LEVEL: Heading '${setting.id}' has invalid level (${originalLevel}), falling back to ${setting.level}`, type: 'warning', timestamp: Date.now() });
					}
					break;
								case 'class-multi-toggle':
					if (typeof setting.default !== 'string') {
						setting.default = '';
						parseLogs?.push({ name, message: `MISSING_DEFAULT: Class multi toggle '${setting.id}' missing default, falling back to empty string`, type: 'warning', timestamp: Date.now() });
					}
					break;
				case 'class-toggle':
					if (typeof setting.default !== 'boolean') {
						setting.default = false;
						parseLogs?.push({ name, message: `INVALID_DEFAULT: Class toggle '${setting.id}' default is not boolean, falling back to false`, type: 'warning', timestamp: Date.now() });
					}
					break;
				case 'class-select':
					if (setting.allowEmpty === undefined) {
						setting.allowEmpty = false;
						parseLogs?.push({ name, message: `MISSING_ALLOW_EMPTY: Class select '${setting.id}' missing allowEmpty, falling back to false`, type: 'warning', timestamp: Date.now() });
					}
					break;
				case 'variable-text':
					if (setting.default === undefined) {
						setting.default = "";
						parseLogs?.push({ name, message: `MISSING_DEFAULT: Variable text '${setting.id}' missing default, falling back to ""`, type: 'warning', timestamp: Date.now() });
					}
					break;
				case 'variable-number':
					if (setting.default === undefined) {
						setting.default = 0;
						parseLogs?.push({ name, message: `MISSING_DEFAULT: Variable number '${setting.id}' missing default, falling back to 0`, type: 'warning', timestamp: Date.now() });
					}
					break;
				case 'variable-number-slider': {
					if (setting.min === undefined || setting.max === undefined || setting.step === undefined) {
						setting.min = setting.min ?? 0;
						setting.max = setting.max ?? 100;
						setting.step = setting.step ?? 1;
						setting.default = setting.default ?? 0;
						parseLogs?.push({ name, message: `MISSING_SLIDER_FIELDS: Slider '${setting.id}' missing fields, using defaults`, type: 'warning', timestamp: Date.now() });
					}
					if (setting.min > setting.max) {
						const temp = setting.min;
						setting.min = setting.max;
						setting.max = temp;
						parseLogs?.push({ name, message: `INVALID_SLIDER_RANGE: Slider '${setting.id}' min > max, swapped values`, type: 'warning', timestamp: Date.now() });
					}
					if (setting.step <= 0) {
						setting.step = 1;
						parseLogs?.push({ name, message: `INVALID_SLIDER_STEP: Slider '${setting.id}' step <= 0, falling back to 1`, type: 'warning', timestamp: Date.now() });
					}
					if (setting.default === undefined || setting.default < setting.min || setting.default > setting.max) {
						const oldDefault = setting.default;
						setting.default = Math.max(setting.min, Math.min(setting.max, typeof setting.default === 'number' && !isNaN(setting.default) ? setting.default : setting.min));
						parseLogs?.push({ name, message: `INVALID_SLIDER_DEFAULT: Slider '${setting.id}' default (${oldDefault}) out of bounds, clamped to ${setting.default}`, type: 'warning', timestamp: Date.now() });
					}
					break;
				}
								case 'variable-color':
					if (!setting.format || !['hsl', 'hsl-values', 'hsl-split', 'hsl-split-decimal', 'rgb', 'rgb-values', 'rgb-split', 'hex'].includes(setting.format)) {
						const issue = !setting.format ? 'MISSING_COLOR_FORMAT' : 'UNSUPPORTED_COLOR_FORMAT';
						setting.format = 'hex';
						parseLogs?.push({ name, message: `${issue}: Color '${setting.id}' format invalid, falling back to 'hex'`, type: 'warning', timestamp: Date.now() });
					}
					if (typeof setting.default !== 'string') {
						setting.default = '#';
						parseLogs?.push({ name, message: `MISSING_DEFAULT: Variable color '${setting.id}' missing default value, falling back to '#'`, type: 'warning', timestamp: Date.now() });
					}
					break;
				case 'variable-themed-color':
					if (!setting['default-light'] || !setting['default-dark']) {
						setting['default-light'] = setting['default-light'] || '#';
						setting['default-dark'] = setting['default-dark'] || '#';
						parseLogs?.push({ name, message: `MISSING_THEMED_COLOR_FIELDS: Themed color '${setting.id}' missing defaults, falling back to '#'`, type: 'warning', timestamp: Date.now() });
					}
					break;
				case 'variable-select':
					if (setting.default === undefined) {
						setting.default = "";
						parseLogs?.push({ name, message: `MISSING_DEFAULT: Variable select '${setting.id}' missing default, falling back to ""`, type: 'warning', timestamp: Date.now() });
					}
					break;
				case 'color-gradient':
					if (!setting.from || !setting.to || !setting.format || setting.step === undefined) {
						setting.from = setting.from || "";
						setting.to = setting.to || "";
						setting.format = setting.format || "hex";
						setting.step = setting.step === undefined ? 1 : setting.step;
						parseLogs?.push({ name, message: `MISSING_GRADIENT_FIELDS: Gradient '${setting.id}' missing fields, using fallbacks`, type: 'warning', timestamp: Date.now() });
					}
					if (setting.step <= 0) {
						setting.step = 1;
						parseLogs?.push({ name, message: `INVALID_GRADIENT_STEP: Gradient '${setting.id}' step <= 0, falling back to 1`, type: 'warning', timestamp: Date.now() });
					}
					break;
			}
			return true;
		});
		return settings;
	}

	/**
	 * Parse snippet metadata from a string.
	 *
	 * @param text the CSS content to parse for metadata
	 * @returns SnippetMetadata or undefined if no metadata is found
	 */
	public static parseMetadata(text: string): SnippetMetadata | undefined {
		const match = text.match(metadataRegExp);
		if (!match) return undefined;

		const str = match[1].trim();
		const indent = detectIndent(str);

		try {
			return yaml.load(
				str.replace(/\t/g, indent.type === 'space' ? indent.indent : '    ')
			) as SnippetMetadata;
		} catch (e) {
			console.error('Style Manager | Metadata parse error:', e);
			return undefined;
		}
	}
}

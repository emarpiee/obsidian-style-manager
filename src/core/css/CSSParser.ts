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

import { ErrorList, ParsedCSSSettings, SnippetMetadata } from '../../types';
import {
	metadataRegExp,
	nameRegExp,
	settingRegExp,
} from '../../utils/CommonUtils';

export class CSSParser {
	private static parseCache: Map<
		string,
		{ settingsList: ParsedCSSSettings[]; errorList: ErrorList }
	> = new Map();

	/**
	 * Parse css settings from a CSSStyleSheet.
	 *
	 * @param sheet the CSSStyleSheet to parse
	 * @returns An object containing the list of parsed settings and any errors encountered
	 */
	public static parseCSS(sheet: CSSStyleSheet): {
		settingsList: ParsedCSSSettings[];
		errorList: ErrorList;
	} {
		const text = sheet?.ownerNode?.textContent?.trim();
		if (!text) return { settingsList: [], errorList: [] };
		return this.parseCSSText(text);
	}

	public static parseCSSText(text: string): {
		settingsList: ParsedCSSSettings[];
		errorList: ErrorList;
	} {
		if (!text) return { settingsList: [], errorList: [] };

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
		const errorList: ErrorList = [];

		// Reset regex lastIndex because of 'g' flag
		settingRegExp.lastIndex = 0;
		let match = settingRegExp.exec(text);

		if (match?.length) {
			do {
				const str = match[1].trim();
				const nameMatch = str.match(nameRegExp);
				const name = nameMatch ? nameMatch[1] : 'Unknown';

				try {
					const settings = this.parseCSSSettings(str, name);

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
					errorList.push({ name, error: `${e}` });
				}
			} while ((match = settingRegExp.exec(text)) !== null);
		}

		const result = { settingsList, errorList };

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
		errorList: ErrorList;
	}): { settingsList: ParsedCSSSettings[]; errorList: ErrorList } {
		return {
			settingsList: result.settingsList.map((s) => ({
				...s,
				settings: [...s.settings],
			})),
			errorList: [...result.errorList],
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
		name: string
	): ParsedCSSSettings | undefined {
		const indent = detectIndent(str);

		const settings: ParsedCSSSettings = yaml.load(
			str.replace(/\t/g, indent.type === 'space' ? indent.indent : '    '),
			{
				filename: name,
			}
		) as ParsedCSSSettings;

		if (!settings || !Array.isArray(settings.settings)) return undefined;
		settings.settings = settings.settings.filter((setting) => setting);
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

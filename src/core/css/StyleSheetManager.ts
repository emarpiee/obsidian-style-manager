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
import { CSSParser } from './CSSParser';

import { ObsidianBridge } from '../../infrastructure/bridge/ObsidianBridge';
import { BridgeInternals, ParseLogList, ParsedCSSSettings } from '../../types';
import { Logger } from '../../utils/Logger';

/**
 * Manages discovery, parsing, and caching of CSS stylesheets containing @settings blocks.
 */
export class StyleSheetManager {
	private cssVarCache: Map<
		string,
		{ light: string; dark: string; current: string }
	> = new Map();
	private lightEl: HTMLElement;
	private darkEl: HTMLElement;

	constructor(private bridge: ObsidianBridge) {
		this.lightEl = activeDocument.body.createDiv(
			'theme-light style-manager-ref'
		);
		this.darkEl = activeDocument.body.createDiv('theme-dark style-manager-ref');

		// Hide these elements from view
		activeDocument.body.classList.add(
			'css-settings-manager',
			'style-manager-css'
		);
	}

	public cleanup(): void {
		this.lightEl?.remove();
		this.darkEl?.remove();
		activeDocument.body.classList.remove(
			'css-settings-manager',
			'style-manager-css'
		);
		this.cssVarCache.clear();
		this.fileCache.clear();
		this.diskMapCache.clear();
		this.textContentToSourceMap.clear();
		this.diskParseLogs = [];
	}

	public clearCache(): void {
		this.cssVarCache.clear();
	}

	/**
	 * Retrieves CSS variable values for light, dark, and current themes.
	 */
	public getCSSVar(
		id: string
	): { light: string; dark: string; current: string } | undefined {
		if (this.cssVarCache.has(id)) {
			return this.cssVarCache.get(id);
		}

		if (this.cssVarCache.size > 500) {
			this.cssVarCache.clear();
		}

		const light = getComputedStyle(this.lightEl)
			.getPropertyValue(`--${id}`)
			.trim();
		const dark = getComputedStyle(this.darkEl)
			.getPropertyValue(`--${id}`)
			.trim();
		const current = getComputedStyle(activeDocument.body)
			.getPropertyValue(`--${id}`)
			.trim();

		const result = { light, dark, current };
		this.cssVarCache.set(id, result);
		return result;
	}

	/**
	 * Retrieves the human-readable display name of a style section by its ID from the disk map.
	 */
	public getSectionName(id: string): string | undefined {
		const candidates = this.diskMapCache.get(id);
		if (candidates && candidates.length > 0) {
			return candidates[0].sectionName;
		}
		return undefined;
	}

	private fileCache: Map<
		string,
		{
			mtime: number;
			sections: {
				id: string;
				sourceType: string;
				sourceId: string;
				name: string;
			}[];
			errors: ParseLogList;
		}
	> = new Map();
	private diskMapCache: Map<
		string,
		{ sourceType: string; sourceId: string; sectionName: string }[]
	> = new Map();

	private textContentToSourceMap: Map<string, { sourceType: string; sourceId: string }> = new Map();

	private diskParseLogs: ParseLogList = [];

	private getStableActiveTheme(): string {
		const customCss = (this.bridge as unknown as BridgeInternals).app.customCss;
		if (customCss?.theme) return customCss.theme;
		return this.bridge.getActiveTheme() || 'default';
	}

	public async buildDiskMap(): Promise<void> {
		this.diskMapCache.clear();
		this.textContentToSourceMap.clear();
		this.diskParseLogs = [];

		const adapter = (this.bridge as unknown as BridgeInternals).app.vault
			.adapter;
		const promises: Promise<void>[] = [];

		const processFile = async (
			path: string,
			sourceType: string,
			sourceId: string
		): Promise<void> => {
			if (!(await adapter.exists(path))) return;
			const stat = await adapter.stat(path);

			// Check cache
			const cached = this.fileCache.get(path);
			if (cached && cached.mtime === stat.mtime) {
				// Use cached sections
				for (const section of cached.sections) {
					const data = {
						sourceType: section.sourceType,
						sourceId: section.sourceId,
						sectionName: section.name,
					};
					const existingId = this.diskMapCache.get(section.id) || [];
					existingId.push(data);
					this.diskMapCache.set(section.id, existingId);
				}
				// Replay cached errors
				if (cached.errors) {
					this.diskParseLogs.push(...cached.errors);
				}
				return;
			}

			// Not in cache or modified, read and parse
			const content = await adapter.read(path);

			if (content) {
				this.textContentToSourceMap.set(content.trim(), { sourceType, sourceId });
			}

			const newSections: {
				id: string;
				sourceType: string;
				sourceId: string;
				name: string;
			}[] = [];

			let fileErrors: ParseLogList = [];

		if (content && /\/\*!?\s*@settings/.test(content)) {
				const { settingsList, parseLogs: parsedErrors } = CSSParser.parseCSSText(content);
				fileErrors = parsedErrors;
				for (const s of settingsList) {
					const data = { sourceType, sourceId, sectionName: s.name };

					// ID-based fallback
					const existingId = this.diskMapCache.get(s.id) || [];
					if (
						!existingId.some(
							(e) => e.sourceId === sourceId && e.sectionName === s.name
						)
					)
						existingId.push(data);
					this.diskMapCache.set(s.id, existingId);

					// Fingerprint-based (precise)
					if (s.raw) {
						const fingerprint = s.raw.trim();
						const existingFp = this.diskMapCache.get(fingerprint) || [];
						if (
							!existingFp.some(
								(e) => e.sourceId === sourceId && e.sectionName === s.name
							)
						)
							existingFp.push(data);
						this.diskMapCache.set(fingerprint, existingFp);
					}

					newSections.push({ id: s.id, sourceType, sourceId, name: s.name });
				}

				// Collect parse errors from this file, tagged with the correct source
				for (const err of fileErrors) {
					err.sourceType = sourceType as 'Plugin' | 'Theme' | 'Snippet' | 'Unknown' | 'Style';
					err.sourceId = sourceId;
				}
				this.diskParseLogs.push(...fileErrors);
			}

			this.fileCache.set(path, { mtime: stat.mtime, sections: newSections, errors: fileErrors });
		};

		// 1. Theme
		const activeTheme = this.getStableActiveTheme();
		if (activeTheme !== 'default') {
			promises.push(
				processFile(this.bridge.getThemePath(activeTheme), 'Theme', activeTheme)
			);
		}

		// 2. Plugins — only enabled ones (have a styles.css loaded in DOM)
		const enabledPlugins = this.bridge.getEnabledPlugins();
		for (const p of enabledPlugins) {
			promises.push(processFile(this.bridge.getPluginPath(p), 'Plugin', p));
		}

		// 3. Snippets — only enabled ones
		const snippets = this.bridge
			.getEnabledSnippets()
			.map((s) => s.replace(/\.css$/, '').trim());
		for (const s of snippets) {
			promises.push(processFile(this.bridge.getSnippetPath(s), 'Snippet', s));
		}

		await Promise.all(promises);
	}

	/**
	 * Scans all activeDocument stylesheets for @settings blocks and parses them.
	 */
	public getSettingsFromStyles(): {
		settingsList: ParsedCSSSettings[];
		parseLogs: ParseLogList;
	} {
		try {
			const settingsMap = new Map<string, ParsedCSSSettings>();
			// Start with errors already collected from disk parsing (e.g. snippets loaded via <link>)
			// Deduplicate by name+message key
			const seenErrorKeys = new Set<string>();
			const parseLogs: ParseLogList = [];
			const diskSourceIds = new Set<string>();
			for (const err of this.diskParseLogs) {
				const key = `${err.name}|${err.message}`;
				if (!seenErrorKeys.has(key)) {
					seenErrorKeys.add(key);
					parseLogs.push(err);
				}
				if (err.sourceId) diskSourceIds.add(err.sourceId);
			}
			const styleSheets = activeDocument.styleSheets;
			const processedContent = new Set<string>();
			const activeTheme = this.getStableActiveTheme();

			for (let i = 0, len = styleSheets.length; i < len; i++) {
				const sheet = styleSheets.item(i);
				if (!sheet || sheet.disabled) continue;

				const node = sheet.ownerNode;
				if (!node || node.nodeType !== 1) continue;

				const text = node.textContent;
				if (!text || !/\/\*!?\s*@settings/.test(text)) continue;

				const trimmed = text.trim();
				if (processedContent.has(trimmed)) continue;
				processedContent.add(trimmed);

				const el = node as Element;
				const nodeId = el.id || '';
				const pluginId = el.getAttribute('data-plugin-id');
				const href = el.getAttribute('href') || '';

				let sourceType: 'Plugin' | 'Theme' | 'Snippet' | 'Unknown' | 'Style' =
					'Unknown';
				let sourceId: string | undefined;

				if (nodeId.startsWith('snippet-') || href.includes('snippets/')) {
					sourceType = 'Snippet';
					if (nodeId.startsWith('snippet-')) {
						sourceId = nodeId.substring(8);
					} else if (href) {
						const match = href.match(/snippets\/([^/]+)\.css(?:\?.*)?$/);
						if (match) sourceId = match[1];
					}
				} else if (
					nodeId === 'theme-css' ||
					nodeId.includes('theme') ||
					href.includes('themes/')
				) {
					sourceType = 'Theme';
					sourceId = activeTheme;
				} else if (
					pluginId ||
					nodeId.includes('plugin') ||
					href.includes('plugins/')
				) {
					sourceType = 'Plugin';
					if (pluginId) {
						sourceId = pluginId;
					} else if (href) {
						const match = href.match(/plugins\/([^/]+)\//);
						if (match) sourceId = match[1];
					} else if (nodeId && nodeId.startsWith('plugin-')) {
						sourceId = nodeId.replace('plugin-', '');
					}
				} else if (nodeId || href) {
					sourceType = 'Style';
					sourceId = nodeId || href;
				} else {
					sourceType = 'Unknown';
				}

				const { settingsList: parsed, parseLogs: errors } =
					CSSParser.parseCSS(sheet);

				for (const section of parsed) {
					// Initial attribution based on stylesheet owner
					section.sourceType = sourceType;
					section.sourceId = sourceId;

					// Bulletproof attribution: Check our fingerprint map (precise) or disk map (id-based fallback)
					const fingerprint = section.raw?.trim() || '';
					const candidates =
						this.diskMapCache.get(fingerprint) ||
						this.diskMapCache.get(section.id) ||
						[];

					const isThemeOrPlugin =
						sourceType === 'Theme' || sourceType === 'Plugin';
					const isSnippet = sourceType === 'Snippet';

					if ((isThemeOrPlugin || isSnippet) && candidates.length === 0) {
						continue;
					}

					if (isThemeOrPlugin) {
						// If it's already identified as Theme/Plugin, prioritize by name match first
						const match =
							candidates.find(
								(c) =>
									c.sourceType === sourceType && c.sectionName === section.name
							) || candidates.find((c) => c.sourceType === sourceType);
						if (match) section.sourceId = match.sourceId;
						else if (!section.sourceId) section.sourceId = section.id;
					} else if (isSnippet) {
						// If it's a snippet, find match with same name if possible
						const match =
							candidates.find(
								(c) =>
									c.sourceType === 'Snippet' &&
									c.sourceId === sourceId &&
									c.sectionName === section.name
							) ||
							candidates.find(
								(c) => c.sourceType === 'Snippet' && c.sourceId === sourceId
							);
						if (match) section.sourceId = match.sourceId;
						else if (!section.sourceId) {
							const anySnippet =
								candidates.find(
									(c) =>
										c.sourceType === 'Snippet' && c.sectionName === section.name
								) || candidates.find((c) => c.sourceType === 'Snippet');
							section.sourceId = anySnippet ? anySnippet.sourceId : section.id;
						}
					} else if (candidates.length > 0) {
						// Fallback for Unknown/Style: Heavily prioritize Name + Type match
						const best =
							candidates.find(
								(c) =>
									c.sectionName === section.name && c.sourceType === 'Theme'
							) ||
							candidates.find(
								(c) =>
									c.sectionName === section.name && c.sourceType === 'Plugin'
							) ||
							candidates.find(
								(c) =>
									c.sectionName === section.name && c.sourceType === 'Snippet'
							) ||
							candidates.find((c) => c.sectionName === section.name) ||
							candidates.find((c) => c.sourceType === 'Theme') ||
							candidates.find((c) => c.sourceType === 'Plugin') ||
							candidates.find((c) => c.sourceType === 'Snippet') ||
							candidates[0];

						section.sourceType = best.sourceType as
							| 'Plugin'
							| 'Theme'
							| 'Snippet'
							| 'Unknown'
							| 'Style';
						section.sourceId = best.sourceId;
					}

					if (!section.sourceId) {
						section.sourceId = section.id;
					}

					// Always add as a unique section to prevent unintentional merging/removal
					const sectionClone = {
						...section,
						settings: [...section.settings],
						sourceType: section.sourceType,
						sourceId: section.sourceId,
					};

					const dedupKey = `${sectionClone.id}|${sectionClone.sourceType}|${sectionClone.sourceId}`;
					settingsMap.set(dedupKey, sectionClone);
				}
				for (const err of errors) {
					// Always use this stylesheet's source info — the error came from this file
					let errSourceType: string = sourceType;
					let errSourceId: string | undefined = sourceId;

					// If this stylesheet has Unknown/missing source, look up via text content map
					if ((sourceType === 'Unknown' || !sourceId) && sheet.ownerNode) {
						const el = sheet.ownerNode as Element;
						const nodeText = el.textContent?.trim() || '';
						const mapped = nodeText ? this.textContentToSourceMap.get(nodeText) : undefined;
						if (mapped) {
							errSourceType = mapped.sourceType;
							errSourceId = mapped.sourceId;
						}
					}

						err.sourceType = (errSourceType === 'Unknown' ? 'Snippet' : errSourceType) as 'Plugin' | 'Theme' | 'Snippet' | 'Unknown' | 'Style';
					err.sourceId = errSourceId || err.name;
				}
				// Only add DOM-scan errors not already captured from disk parsing
				for (const err of errors) {
					const key = `${err.name}|${err.message}`;
					if (!seenErrorKeys.has(key)) {
						seenErrorKeys.add(key);
						parseLogs.push(err);
					}
				}
			}

			const settingsList = Array.from(settingsMap.values());

			// STABLE SORT: Themes > Plugins > Snippets > Others, then Alphabetical
			const SOURCE_PRIORITY = {
				Theme: 0,
				Plugin: 1,
				Snippet: 2,
				Style: 3,
				Unknown: 4,
			};
			settingsList.sort((a, b) => {
				const priA = SOURCE_PRIORITY[a.sourceType] ?? 99;
				const priB = SOURCE_PRIORITY[b.sourceType] ?? 99;
				if (priA !== priB) return priA - priB;
				return (a.sourceId || '').localeCompare(b.sourceId || '');
			});

			// Mark duplicate IDs
			const idCounts = new Map<string, number>();
			for (const s of settingsList) {
				idCounts.set(s.id, (idCounts.get(s.id) || 0) + 1);
			}
			for (const s of settingsList) {
				if ((idCounts.get(s.id) || 0) > 1) {
					s.isDuplicate = true;
				}
			}

			return { settingsList, parseLogs };
		} catch (e) {
			Logger.error('Style Manager | Error during CSS analysis:', e);
			return { settingsList: [], parseLogs: [] };
		}
	}
}

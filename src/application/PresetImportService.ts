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
import JSZip from 'jszip';
import { Notice } from 'obsidian';

import { SNIPPETS_KEY, THEME_KEY } from '../constants';
import StyleManagerPlugin from '../main';
import { Preset } from '../types';

export interface ImportAnalysis {
	presets: Preset[];
	snippets: { name: string; content: string }[];
	themes: { name: string; files: { filename: string; content: string }[] }[];
	conflicts: string[];
	themeConflicts: string[];
}

export class PresetImportService {
	constructor(private plugin: StyleManagerPlugin) {}

	/**
	 * Analyzes a set of preset imports (JSON or ZIP) to detect contents and conflicts.
	 */
	async analyzePresetImports(
		items: { content: string | ArrayBuffer; name?: string }[]
	): Promise<ImportAnalysis> {
		const analysis: ImportAnalysis = {
			presets: [],
			snippets: [],
			themes: [],
			conflicts: [],
			themeConflicts: [],
		};

		for (const item of items) {
			try {
				if (item.content instanceof ArrayBuffer) {
					// ZIP Bundle Analysis
					const zip = await JSZip.loadAsync(item.content);

					// VALIDATION: Reject Full Vault Backups
					if (
						zip.file('vault_manifest.json') ||
						zip.file(/vault_state\.(json|md|txt)$/i).length > 0
					) {
						throw new Error(
							'This is a FULL VAULT BACKUP. Please use the "Full Backup & Restore" section in the Preferences tab.'
						);
					}

					const bundleData = await this.plugin.bundleService.extractBundle(
						item.content
					);
					analysis.presets.push(...bundleData.presets);
					analysis.snippets.push(...bundleData.snippets);
					if (bundleData.themes) {
						analysis.themes.push(...bundleData.themes);
					}

					for (const snippet of bundleData.snippets) {
						if (
							await this.plugin.settingsService.bridge.snippetExists(
								snippet.name
							)
						) {
							if (!analysis.conflicts.includes(snippet.name)) {
								analysis.conflicts.push(snippet.name);
							}
						}
					}

					if (bundleData.themes) {
						for (const theme of bundleData.themes) {
							if (
								await this.plugin.settingsService.bridge.themeExists(theme.name)
							) {
								if (!analysis.themeConflicts.includes(theme.name)) {
									analysis.themeConflicts.push(theme.name);
								}
							}
						}
					}
				} else {
					// JSON Import
					const parsed = JSON.parse(item.content);

					if (Array.isArray(parsed)) {
						// Bulk legacy array
						parsed.forEach((p, idx) => {
							analysis.presets.push({
								id: crypto.randomUUID(),
								name: p.name || `${item.name || 'Import'} ${idx + 1}`,
								created: p.created || Date.now(),
								data: p.data || p,
								targetedPrefixes: p.targetedPrefixes,
							});
						});
					} else {
						// Single preset
						analysis.presets.push({
							id: crypto.randomUUID(),
							name: parsed.name || item.name || 'Imported Preset',
							created: parsed.created || Date.now(),
							data: parsed.data || parsed,
							targetedPrefixes: parsed.targetedPrefixes,
						});
					}
				}
			} catch (e) {
				new Notice(`Error analyzing ${item.name || 'import'}: ${e}`);
			}
		}

		return analysis;
	}

	/**
	 * Finalizes the import of presets, snippets, and themes after conflict resolution.
	 */
	async executePresetImport(
		analysis: ImportAnalysis,
		resolutions?: {
			name: string;
			action: 'overwrite' | 'rename' | 'skip';
			newName?: string;
		}[]
	): Promise<number> {
		let totalPresets = 0;

		// 1. Handle Snippets & Resolutions
		for (const snippet of analysis.snippets || []) {
			const resolution = resolutions?.find((r) => r.name === snippet.name);

			if (!resolution || resolution.action === 'overwrite') {
				await this.plugin.settingsService.bridge.writeSnippet(
					snippet.name,
					snippet.content
				);
			} else if (resolution.action === 'rename' && resolution.newName) {
				await this.plugin.settingsService.bridge.writeSnippet(
					resolution.newName,
					snippet.content
				);
				// Update preset references to the renamed snippet
				for (const preset of analysis.presets || []) {
					const snippets = (preset.data[SNIPPETS_KEY] as string[]) || [];
					const idx = snippets.indexOf(snippet.name);
					if (idx !== -1) snippets[idx] = resolution.newName;
				}
			} else if (resolution.action === 'skip') {
				// We keep the snippet reference in the preset but do not overwrite the snippet on disk.
			}
		}

		// 2. Handle Themes & Resolutions
		for (const theme of analysis.themes || []) {
			const resolution = resolutions?.find((r) => r.name === theme.name);

			if (!resolution || resolution.action === 'overwrite') {
				for (const file of theme.files) {
					await this.plugin.settingsService.bridge.writeThemeFile(
						theme.name,
						file.filename,
						file.content
					);
				}
			} else if (resolution.action === 'rename' && resolution.newName) {
				for (const file of theme.files) {
					let content = file.content;
					if (file.filename === 'manifest.json') {
						try {
							const manifestObj = JSON.parse(content);
							manifestObj.name = resolution.newName;
							content = JSON.stringify(manifestObj, null, 2);
						} catch (e) {
							console.error(
								'Style Manager | Failed to parse manifest JSON during rename:',
								e
							);
						}
					}
					await this.plugin.settingsService.bridge.writeThemeFile(
						resolution.newName,
						file.filename,
						content
					);
				}
				// Update preset references to the renamed theme
				for (const preset of analysis.presets || []) {
					const themeName = preset.data[THEME_KEY] as string | undefined;
					if (themeName === theme.name) {
						preset.data[THEME_KEY] = resolution.newName;
					}
				}
			} else if (resolution.action === 'skip') {
				// We keep the theme setting in the preset but do not import/overwrite the theme files.
			}
		}

		// 3. Refresh snippets and themes in Obsidian
		if (analysis.snippets && analysis.snippets.length > 0) {
			await this.plugin.settingsService.bridge.forceLoadSnippets();
		}
		if (analysis.themes && analysis.themes.length > 0) {
			this.plugin.settingsService.bridge.requestLoadTheme();
		}

		// 4. Add Presets to storage
		for (const preset of analysis.presets || []) {
			// Re-generate ID to be sure it's unique locally
			preset.id = crypto.randomUUID();
			this.plugin.presetService.presets.unshift(preset);
			totalPresets++;
		}

		await this.plugin.presetService.savePresets();
		return totalPresets;
	}
}

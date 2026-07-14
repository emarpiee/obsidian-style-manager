import { StorageKeys } from '../constants';
import StyleManagerPlugin from '../main';
import { ImportAnalysis } from '../types';

import { Logger } from '../utils/Logger';
import { ZipReader } from '../utils/ZipHelper';

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
					const zip = await ZipReader.loadAsync(item.content);

					// VALIDATION: Reject Full Vault Backups
					if (
						zip.file('vault_manifest.json') ||
						zip.file('shared_locker_manifest.json') ||
						zip.file(/vault_state\.(json|md|txt)$/i).length > 0 ||
						zip.file(/shared_locker_state\.(json|md|txt)$/i).length > 0
					) {
						throw new Error(
							'Invalid preset file. This file appears to be a backup or configuration file..'
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
					const parsed = JSON.parse(item.content) as
						| Record<string, unknown>
						| Array<Record<string, unknown>>;

					if (Array.isArray(parsed)) {
						// Bulk legacy array
						parsed.forEach((p, idx) => {
							analysis.presets.push({
								id: crypto.randomUUID(),
								name:
									(p.name as string) || `${item.name || 'Import'} ${idx + 1}`,
								created: (p.created as number) || Date.now(),
								data: (p.data || p) as Record<string, unknown>,
								targetedPrefixes: p.targetedPrefixes as string[] | undefined,
							});
						});
					} else if (parsed && typeof parsed === 'object') {
						// VALIDATION: Reject Full Backups
						if (
							'_manager_presets' in parsed ||
							'_manager_schedules' in parsed ||
							'__devices' in parsed ||
							'__shared_version' in parsed
						) {
							throw new Error(
								'Invalid preset file. This file appears to be a backup or configuration file..'
							);
						}

						// Single preset
						analysis.presets.push({
							id: crypto.randomUUID(),
							name: (parsed.name as string) || item.name || 'Imported Preset',
							created: (parsed.created as number) || Date.now(),
							data: ('data' in parsed ? parsed.data : parsed) as Record<
								string,
								unknown
							>,
							targetedPrefixes: (parsed as { targetedPrefixes?: string[] })
								.targetedPrefixes,
						});
					} else {
						throw new Error(
							'Invalid preset file. This file appears to be a backup or configuration file..'
						);
					}
				}
			} catch (e) {
				this.plugin.settingsService.notifications.error(
					`Error analyzing ${item.name || 'import'}. ${e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e)}`
				);
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
					const snippets =
						(preset.data[StorageKeys.SNIPPETS] as string[]) || [];
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
							const manifestObj = JSON.parse(content) as Record<
								string,
								unknown
							>;
							manifestObj.name = resolution.newName;
							content = JSON.stringify(manifestObj, null, 2);
						} catch (e) {
							Logger.error(
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
					const themeName = preset.data[StorageKeys.THEME] as
						| string
						| undefined;
					if (themeName === theme.name) {
						preset.data[StorageKeys.THEME] = resolution.newName;
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
		const currentPresets = this.plugin.presetService.presets;
		for (const preset of analysis.presets || []) {
			// Re-generate ID to be sure it's unique locally
			preset.id = crypto.randomUUID();
			currentPresets.unshift(preset);
			totalPresets++;
		}
		this.plugin.presetService.presets = currentPresets;

		await this.plugin.presetService.savePresets();
		return totalPresets;
	}
}

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
import { Notice, normalizePath } from 'obsidian';

import type StyleManagerPlugin from '../main';
import { RefreshLevel, StyleManagerSettings } from '../types';

/**
 * Service for managing full plugin backups, safety snapshots, and loop-free restores.
 */
export class BackupService {
	constructor(private plugin: StyleManagerPlugin) {}

	/**
	 * Creates a manual safety snapshot (.bak file) of the current data.json.
	 */
	async createSnapshot(): Promise<boolean> {
		const success =
			await this.plugin.settingsService.persistenceService.enqueue(
				async (): Promise<boolean> => {
					// Directly use SharedStore's backup mechanism
					return await (
						this.plugin.settingsService as unknown as {
							sharedStore: { createBackup: () => Promise<boolean> };
						}
					).sharedStore.createBackup();
				}
			);

		if (success) {
			this.plugin.settingsService.notifications.util(
				'Safety snapshot created (data.json.bak)'
			);
		} else {
			new Notice('Failed to create snapshot.');
		}
		return success;
	}

	/**
	 * Creates a Universal ZIP backup containing data.json, all snippet files,
	 * and all installed theme CSS + manifest files.
	 */
	async createUniversalBackup(): Promise<Uint8Array> {
		const zip = new JSZip();
		const settings = this.plugin.settingsService.sharedSettings;
		const preferredExtension =
			(this.plugin.settingsService.settings[
				'__style_manager_export_extension'
			] as string) || '.json';

		// 1. Add settings file (using a unique name for Shared Locker Backups)
		zip.file(
			`shared_locker_state${preferredExtension}`,
			JSON.stringify(settings, null, 2)
		);

		// 2. Add snippets folder
		const customCss = (
			this.plugin.app as unknown as {
				customCss?: {
					snippets?: string[];
					getSnippetPath?: (id: string) => string;
				};
			}
		).customCss;
		if (customCss && customCss.snippets) {
			const snippetsFolder = zip.folder('snippets');
			if (snippetsFolder) {
				for (const snippetId of customCss.snippets) {
					const path = customCss.getSnippetPath
						? customCss.getSnippetPath(snippetId)
						: normalizePath(`.obsidian/snippets/${snippetId}.css`);
					try {
						if (await this.plugin.app.vault.adapter.exists(path)) {
							const content = await this.plugin.app.vault.adapter.read(path);
							snippetsFolder.file(`${snippetId}.css`, content);
						}
					} catch (e) {
						console.error(
							`BackupService | Failed to add snippet ${snippetId} to backup:`,
							e
						);
					}
				}
			}
		}

		// 3. Add themes folder (all installed themes)
		const installedThemes = this.plugin.settingsService.bridge.getInstalledThemes();
		if (installedThemes.length > 0) {
			const themesFolder = zip.folder('themes');
			if (themesFolder) {
				for (const themeName of installedThemes) {
					try {
						const cssContent =
							await this.plugin.settingsService.bridge.readThemeCss(themeName);
						const manifestContent =
							await this.plugin.settingsService.bridge.readThemeManifest(themeName);
						if (cssContent !== null || manifestContent !== null) {
							const specificThemeFolder = themesFolder.folder(themeName);
							if (specificThemeFolder) {
								if (cssContent !== null) {
									specificThemeFolder.file('theme.css', cssContent);
								}
								if (manifestContent !== null) {
									specificThemeFolder.file('manifest.json', manifestContent);
								}
							}
						}
					} catch (e) {
						console.error(
							`BackupService | Failed to add theme "${themeName}" to backup:`,
							e
						);
					}
				}
			}
		}

		// 4. Add signature manifest
		const metadata = {
			version: this.plugin.manifest.version,
			timestamp: Date.now(),
			device: this.plugin.settingsService.deviceName || 'Unknown Device',
			type: 'style-manager-vault-backup', // Signature
			manifestVersion: 1,
		};
		zip.file('shared_locker_manifest.json', JSON.stringify(metadata, null, 2));

		return await zip.generateAsync({ type: 'uint8array' });
	}

	/**
	 * Restores a global configuration from a JSON string or ZIP bundle.
	 * Implements "Version Jumping" to ensure the restore propagates correctly in sync.
	 */
	async restoreBackup(data: string | ArrayBuffer): Promise<boolean> {
		try {
			let newSettings: StyleManagerSettings | null = null;
			const snippetsToInstall: { name: string; content: string }[] = [];
			const themesToInstall: {
				name: string;
				files: { filename: string; content: string }[];
			}[] = [];

			if (data instanceof ArrayBuffer) {
				// ZIP Bundle Handling
				const zip = await JSZip.loadAsync(data);

				// VALIDATION: Check for shared locker signature
				const manifestFile =
					zip.file('shared_locker_manifest.json') ||
					zip.file('vault_manifest.json');
				const isPresetBundle =
					zip.folder('presets') !== null ||
					zip.file(/preset\.(json|md|txt)$/i).length > 0;

				if (!manifestFile) {
					if (isPresetBundle) {
						throw new Error(
							'This is a PRESET bundle. Please import it from the Presets tab instead of the Backup section.'
						);
					}
					throw new Error(
						'Invalid Backup: The file is missing the shared_locker_manifest.json signature.'
					);
				}

				// Find settings file (shared_locker_state, vault_state, or legacy settings)
				const settingsFile =
					zip.file(/shared_locker_state\.(json|md|txt)$/i)[0] ||
					zip.file(/vault_state\.(json|md|txt)$/i)[0] ||
					zip.file(/settings\.(json|md|txt)$/i)[0];
				if (settingsFile) {
					const content = await settingsFile.async('string');
					newSettings = JSON.parse(content.trim());
				}

				// Find snippets
				const snippetsFolder = zip.folder('snippets');
				if (snippetsFolder) {
					const files = snippetsFolder.filter((path) => path.endsWith('.css'));
					for (const file of files) {
						const content = await file.async('string');
						const name =
							file.name.split('/').pop()?.replace('.css', '') ||
							'imported-snippet';
						snippetsToInstall.push({ name, content });
					}
				}

				// Find themes
				const themesFolder = zip.folder('themes');
				if (themesFolder) {
					const themeNames = new Set<string>();
					themesFolder.forEach((relativePath) => {
						const parts = relativePath.split('/');
						if (parts.length > 0 && parts[0]) {
							themeNames.add(parts[0]);
						}
					});
					for (const themeName of themeNames) {
						const themeFiles: { filename: string; content: string }[] = [];
						const cssFile = themesFolder.file(`${themeName}/theme.css`);
						const themeManifestFile = themesFolder.file(`${themeName}/manifest.json`);
						if (cssFile) {
							const content = await cssFile.async('string');
							themeFiles.push({ filename: 'theme.css', content });
						}
						if (themeManifestFile) {
							const content = await themeManifestFile.async('string');
							themeFiles.push({ filename: 'manifest.json', content });
						}
						if (themeFiles.length > 0) {
							themesToInstall.push({ name: themeName, files: themeFiles });
						}
					}
				}
			} else {
				// Raw String Handling (JSON, MD, TXT)
				const sanitized = data.trim();
				try {
					newSettings = JSON.parse(sanitized);
				} catch (e) {
					// Try to extract JSON from a markdown code block if present
					const codeBlockMatch = sanitized.match(
						/```(?:json)?\n([\s\S]*?)\n```/
					);
					if (codeBlockMatch) {
						newSettings = JSON.parse(codeBlockMatch[1].trim());
					} else {
						throw e;
					}
				}
			}

			if (!newSettings) {
				throw new Error('Could not find valid settings data in the backup.');
			}

			// SMART DETECTION: If the user is trying to restore a Preset as a Full Backup (legacy or single file),
			// we should warn them or handle it gracefully.
			if (newSettings.data && newSettings.id && newSettings.name) {
				throw new Error(
					'This file appears to be a single PRESET. To restore your entire vault, please use a Full Backup file.'
				);
			}

			// 1. Automatic Safety Snapshot
			await this.createSnapshot();

			// 2. Install Snippets
			if (snippetsToInstall.length > 0) {
				for (const snippet of snippetsToInstall) {
					await this.plugin.settingsService.bridge.writeSnippet(
						snippet.name,
						snippet.content
					);
				}
				await this.plugin.settingsService.bridge.forceLoadSnippets();
			}

			// 3. Install Themes
			if (themesToInstall.length > 0) {
				for (const theme of themesToInstall) {
					for (const file of theme.files) {
						await this.plugin.settingsService.bridge.writeThemeFile(
							theme.name,
							file.filename,
							file.content
						);
					}
				}
				this.plugin.settingsService.bridge.requestLoadTheme();
			}

			// 4. Apply Settings with Version Jumping
			// We force a new shared version so this restore "wins" on all other devices.
			const nextVersion = (
				this.plugin.settingsService.persistenceService as unknown as {
					options: {
						sharedStateService: { generateNextVersion: () => number };
					};
				}
			).options.sharedStateService.generateNextVersion();
			newSettings.__shared_version = nextVersion;

			// We use onDataLoaded instead of setSettings to ensure ALL internal state (including isolate mode)
			// is correctly initialized from the backup BEFORE the next save cycle.
			await this.plugin.settingsService.onDataLoaded(newSettings, true, true);

			// Explicitly save the restored state
			await this.plugin.settingsService.save({ force: true });

			// 5. Final Reload
			await this.plugin.settingsService.refreshService.trigger(
				RefreshLevel.SYSTEM_RELOAD,
				{ skipAdopt: true }
			);

			this.plugin.settingsService.notifications.shared(
				'Full Restore successful. Loop protection enabled.'
			);
			return true;
		} catch (e) {
			console.error('BackupService | Restore failed:', e);
			new Notice(
				`Restore failed: ${e instanceof Error ? e.message : String(e)}`
			);
			return false;
		}
	}
}

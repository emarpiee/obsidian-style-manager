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
import { App, Notice, Setting, debounce, setIcon } from 'obsidian';

import {
	EDITOR_TAB_SIZE_KEY,
	OPEN_MODAL_ON_CREATE_KEY,
	SEPARATE_BULK_PRESETS_KEY,
	SHOW_ISOLATE_NOTIFICATIONS_KEY,
	SHOW_PRESET_NOTIFICATIONS_KEY,
	SHOW_SHARED_NOTIFICATIONS_KEY,
	SHOW_SNIPPET_METADATA_KEY,
	SHOW_SNIPPET_NOTIFICATIONS_KEY,
	SHOW_STATUS_BAR_KEY,
	SHOW_UTILITY_NOTIFICATIONS_KEY,
} from '../../constants';
import StyleManagerPlugin from '../../main';
import { getFormattedTimestamp } from '../../utils/CommonUtils';
import { ExportDataConfigModal } from '../modals/ExportDataConfigModal';

/**
 * Renders the Preferences tab: export settings, UI preferences, confirmations, and file management.
 */
export class PreferencesTab {
	constructor(
		private app: App,
		private containerEl: HTMLElement,
		private plugin: StyleManagerPlugin
	) {}

	render(): void {
		this.renderUISettings();
		this.renderConfirmations();
		this.renderBackupSettings();
		this.renderExportSettings();
		this.renderDeveloperSettings();
	}

	private renderHeader(
		containerEl: HTMLElement,
		text: string,
		icon: string
	): HTMLElement {
		const headerEl = containerEl.createEl('h3', {
			cls: 'style-manager-settings-tab-title',
		});
		const iconEl = headerEl.createSpan({
			cls: 'style-manager-settings-tab-icon',
		});
		setIcon(iconEl, icon);
		headerEl.createSpan({ text: text });
		return headerEl;
	}

	private renderBackupSettings(): void {
		const { containerEl, plugin } = this;

		this.renderHeader(containerEl, 'Backup & Safety', 'shield-check');
		const backupContainer = containerEl.createDiv(
			'style-manager-settings-tab-content'
		);

		new Setting(backupContainer)
			.setName('Full Vault Backup (ZIP)')
			.setDesc(
				'Creates a complete backup containing your settings AND all your CSS snippets in a single ZIP file.'
			)
			.addButton((btn) => {
				btn
					.setButtonText('Export Universal Backup...')
					.setCta()
					.setIcon('package')
					.onClick(async () => {
						try {
							const data = await plugin.backupService.createUniversalBackup();
							const timestamp = getFormattedTimestamp(
								plugin.settingsService.settings[
									'__style_manager_export_date_format'
								] as string
							);
							const filename = `full-backup-style-manager-${timestamp}.zip`;
							await plugin.presetService.saveFileToVault(filename, data);
						} catch (e) {
							console.error('Style Manager | Backup failed:', e);
							new Notice('Backup failed. See console for details.');
						}
					});
			});

		new Setting(backupContainer)
			.setName('Basic Settings Backup')
			.setDesc(
				'Export only your data.json variables (no snippets) as a single file.'
			)
			.addButton((btn) => {
				btn
					.setButtonText('Export JSON...')
					.setIcon('upload')
					.onClick(() => {
						new ExportDataConfigModal(
							this.app,
							plugin,
							'Full Backup',
							plugin.settingsService.settings
						).open();
					});
			});

		new Setting(backupContainer)
			.setName('Restore from File')
			.setDesc(
				'Import a previously exported configuration (.json or .zip). This will create a safety snapshot before overwriting.'
			)
			.addButton((btn) => {
				btn
					.setButtonText('Import Backup...')
					.setIcon('download')
					.onClick(() => {
						const input = document.createElement('input');
						input.type = 'file';
						input.accept = '.json,.md,.txt,.zip';
						input.onchange = async (e: Event): Promise<void> => {
							const target = e.target as HTMLInputElement;
							const file = target.files?.[0];
							if (!file) return;

							const isZip = file.name.endsWith('.zip');
							const reader = new FileReader();
							reader.onload = async (e): Promise<void> => {
								const content = e.target?.result;
								if (content) {
									await plugin.backupService.restoreBackup(content);
								}
							};

							if (isZip) {
								reader.readAsArrayBuffer(file);
							} else {
								reader.readAsText(file);
							}
						};
						input.click();
					});
			});

		new Setting(backupContainer)
			.setName('Safety Rollback')
			.setDesc(
				'Restore your settings from the last automatic safety snapshot (data.json.bak).'
			)
			.addButton((btn) => {
				btn
					.setButtonText('Rollback to Snapshot')
					.setWarning()
					.setIcon('rotate-ccw')
					.onClick(async () => {
						const adapter = this.app.vault.adapter;
						const baseDir =
							(
								this.plugin
									.manifest as import('../../main').default['manifest'] & {
									dir?: string;
								}
							).dir ||
							`${this.app.vault.configDir}/plugins/${this.plugin.manifest.id}`;
						const backupPath = `${baseDir}/data.json.bak`;

						if (await adapter.exists(backupPath)) {
							const content = await adapter.read(backupPath);
							await plugin.backupService.restoreBackup(content);
						} else {
							new Notice('No safety snapshot found.');
						}
					});
			});
	}

	private renderExportSettings(): void {
		const { containerEl, plugin } = this;

		this.renderHeader(containerEl, 'Export Settings', 'download');
		const exportContainer = containerEl.createDiv(
			'style-manager-settings-tab-content'
		);

		new Setting(exportContainer)
			.setName('Default Export Location')
			.setDesc(
				'Choose the folder where presets will be saved in your vault (e.g. "Presets"). Leave empty for vault root.'
			)
			.addText((text) => {
				const currentPath =
					(plugin.settingsService.settings[
						'__style_manager_export_path'
					] as string) || '';
				text
					.setPlaceholder('Folder/Path')
					.setValue(currentPath)
					.onChange(
						debounce(async (val) => {
							await plugin.settingsService.setSettings(
								{ __style_manager_export_path: val.trim() },
								{ silentUI: true }
							);
						}, 500)
					);
				plugin.settingsService.bridge.createFolderSuggest(text.inputEl);
			});

		new Setting(exportContainer)
			.setName('Preferred Export Extension')
			.setDesc(
				'Choose the file extension for your exports. The content will remain in JSON format regardless of extension.'
			)
			.addDropdown((dropdown) => {
				dropdown
					.addOption('.json', '.json')
					.addOption('.md', '.md')
					.addOption('.txt', '.txt')
					.setValue(
						(plugin.settingsService.settings[
							'__style_manager_export_extension'
						] as string) || '.json'
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings({
							__style_manager_export_extension: val,
						});
					});
			});

		new Setting(exportContainer)
			.setName('Export Timestamp Format')
			.setDesc(
				'Customize the timestamp used in export filenames. WARNING: Avoid characters like ":", "/", or "\\" as they are invalid in filenames.'
			)
			.addText((text) => {
				text
					.setPlaceholder('YYYYMMDDHHmmss')
					.setValue(
						(plugin.settingsService.settings[
							'__style_manager_export_date_format'
						] as string) ?? 'YYYYMMDDHHmmss'
					)
					.onChange(
						debounce(async (val) => {
							const sanitized = val.replace(/[:/\\?%*|"<>]/g, '');
							await plugin.settingsService.setSettings(
								{ __style_manager_export_date_format: sanitized },
								{ silentUI: true }
							);
						}, 500)
					);
			});

		new Setting(exportContainer)
			.setName('Separate Bulk Presets')
			.setDesc(
				'When exporting multiple presets in a ZIP bundle, save each preset in its own file instead of a single bulk file.'
			)
			.addToggle((toggle) => {
				toggle
					.setValue(
						(plugin.settingsService.settings[
							SEPARATE_BULK_PRESETS_KEY
						] as boolean) || false
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [SEPARATE_BULK_PRESETS_KEY]: val },
							{ silentUI: true }
						);
					});
			});
	}

	private renderUISettings(): void {
		const { containerEl, plugin } = this;

		this.renderHeader(containerEl, 'User Interface', 'layout');
		const uiContainer = containerEl.createDiv(
			'style-manager-settings-tab-content'
		);

		new Setting(uiContainer)
			.setName('Created Date Format')
			.setDesc(
				'Customize the date format for the "Created" label in the preset list. Uses moment.js syntax (e.g. "MMM. DD, YYYY").'
			)
			.addText((text) => {
				text
					.setPlaceholder('MMM. DD, YYYY')
					.setValue(
						(plugin.settingsService.settings[
							'__style_manager_created_date_format'
						] as string) || 'MMM. DD, YYYY'
					)
					.onChange(
						debounce(async (val) => {
							await plugin.settingsService.setSettings(
								{
									__style_manager_created_date_format: val || 'MMM. DD, YYYY',
								},
								{ silentUI: true }
							);
						}, 500)
					);
			});

		new Setting(uiContainer)
			.setName('Show Status Bar Icon')
			.setDesc(
				'Show an icon in the Obsidian status bar for quick access to Style Manager status and actions. (Desktop only)'
			)
			.addToggle((toggle) => {
				toggle
					.setValue(
						(plugin.settingsService.settings[
							SHOW_STATUS_BAR_KEY
						] as boolean) !== false
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [SHOW_STATUS_BAR_KEY]: val },
							{ silentUI: true }
						);
					});
			});

		new Setting(uiContainer)
			.setName('Show Snippet Metadata')
			.setDesc(
				'Display metadata (Author, Version, etc.) for CSS snippets if provided in a /* @metadata */ block.'
			)
			.addToggle((toggle) => {
				toggle
					.setValue(
						(plugin.settingsService.settings[
							SHOW_SNIPPET_METADATA_KEY
						] as boolean) !== false
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [SHOW_SNIPPET_METADATA_KEY]: val },
							{ silentUI: true }
						);
					});
			});

		new Setting(uiContainer)
			.setName('Open Editor After Creation')
			.setDesc(
				'Automatically open the CSS editor modal when a new snippet is created.'
			)
			.addToggle((toggle) => {
				toggle
					.setValue(
						(plugin.settingsService.settings[
							OPEN_MODAL_ON_CREATE_KEY
						] as boolean) || false
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [OPEN_MODAL_ON_CREATE_KEY]: val },
							{ silentUI: true }
						);
					});
			});

		new Setting(uiContainer)
			.setName('Editor Tab Size')
			.setDesc('Set the indentation width (tab size) for the CSS editor modal.')
			.addSlider((slider) => {
				slider
					.setLimits(2, 8, 1)
					.setDynamicTooltip()
					.setValue(
						(plugin.settingsService.settings[EDITOR_TAB_SIZE_KEY] as number) ||
							4
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [EDITOR_TAB_SIZE_KEY]: val },
							{ silentUI: true }
						);
					});

				// Expose slider for reset button
				(
					this as unknown as {
						tabSizeSlider: import('obsidian').SliderComponent;
					}
				).tabSizeSlider = slider;
			})
			.addExtraButton((btn) => {
				btn
					.setIcon('rotate-ccw')
					.setTooltip('Reset to default (4)')
					.onClick(async () => {
						await plugin.settingsService.setSettings(
							{ [EDITOR_TAB_SIZE_KEY]: 4 },
							{ silentUI: true }
						);
						const slider = (
							this as unknown as {
								tabSizeSlider?: import('obsidian').SliderComponent;
							}
						).tabSizeSlider;
						if (slider) {
							slider.setValue(4);
						}
					});
			});
	}

	private renderConfirmations(): void {
		const { containerEl, plugin } = this;

		this.renderHeader(containerEl, 'Confirmations', 'check-circle');
		const confirmContainer = containerEl.createDiv(
			'style-manager-settings-tab-content'
		);

		const confirmationSettings: Array<{
			key: string;
			name: string;
			desc: string;
		}> = [
			{
				key: '__style_manager_skip_apply_confirm',
				name: 'Skip Apply Confirmation',
				desc: 'Instantly apply presets without showing the confirmation dialog.',
			},
			{
				key: '__style_manager_skip_delete_confirm',
				name: 'Skip Delete Confirmation',
				desc: 'Instantly delete presets without showing the confirmation dialog.',
			},
			{
				key: '__style_manager_skip_export_confirm',
				name: 'Skip Export Confirmation',
				desc: 'Instantly export presets without showing the confirmation dialog.',
			},
			{
				key: '__style_manager_skip_import_confirm',
				name: 'Skip Import Confirmation',
				desc: 'Instantly import presets or styles without showing the confirmation dialog.',
			},
		];

		confirmationSettings.forEach(({ key, name, desc }) => {
			new Setting(confirmContainer)
				.setName(name)
				.setDesc(desc)
				.addToggle((toggle) => {
					toggle
						.setValue(
							(plugin.settingsService.settings[key] as boolean) || false
						)
						.onChange(async (val) => {
							await plugin.settingsService.setSettings(
								{ [key]: val },
								{ silentUI: true }
							);
						});
				});
		});
	}

	private renderDeveloperSettings(): void {
		const { containerEl, plugin } = this;

		this.renderHeader(containerEl, 'Developer Options', 'code');
		const developerContainer = containerEl.createDiv(
			'style-manager-settings-tab-content'
		);

		const notificationSettings = [
			{
				key: SHOW_SHARED_NOTIFICATIONS_KEY,
				name: 'Shared Notifications',
				desc: 'Alerts when background shared changes are detected.',
			},
			{
				key: SHOW_PRESET_NOTIFICATIONS_KEY,
				name: 'Preset Notifications',
				desc: 'Alerts when saving, applying, or exporting presets.',
			},
			{
				key: SHOW_ISOLATE_NOTIFICATIONS_KEY,
				name: 'Isolate Notifications',
				desc: 'Alerts when resetting or pushing isolated settings.',
			},
			{
				key: SHOW_SNIPPET_NOTIFICATIONS_KEY,
				name: 'Snippet Notifications',
				desc: 'Alerts when managing CSS snippets (save, rename, delete).',
			},
			{
				key: SHOW_UTILITY_NOTIFICATIONS_KEY,
				name: 'Utility Notifications',
				desc: 'Minor UI feedback like "Copied to clipboard".',
			},
		];

		notificationSettings.forEach(({ key, name, desc }) => {
			new Setting(developerContainer)
				.setName(`Show ${name}`)
				.setDesc(desc)
				.addToggle((toggle) => {
					toggle
						// For SHOW_SHARED_NOTIFICATIONS_KEY we default to false, for others we default to true (unless explicitly false)
						.setValue(plugin.settingsService.settings[key] !== false)
						.onChange(async (val) => {
							await plugin.settingsService.setSettings(
								{ [key]: val },
								{ silentUI: true }
							);
						});
				});
		});

		new Setting(developerContainer)
			.setName('Current Shared Version')
			.setDesc(
				'The internal version timestamp of your settings. Devices are in shared state when this number matches.'
			)
			.addText((text) => {
				const version =
					plugin.settingsService.sharedSettings.__shared_version || '0';
				text
					.setPlaceholder('No shared version')
					.setValue(version.toString())
					.setDisabled(true);
				text.inputEl.addClass('style-manager-debug-input');
			});
	}
}

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
import { App, Setting, debounce, setIcon } from 'obsidian';

import {
	BACKUP_DATE_FORMAT_KEY,
	BACKUP_PATH_KEY,
	CREATED_DATE_FORMAT_KEY,
	EDITOR_TAB_SIZE_KEY,
	ENABLE_CONSOLE_LOGGING_KEY,
	EXPORT_DATE_FORMAT_KEY,
	EXPORT_EXTENSION_KEY,
	EXPORT_PATH_KEY,
	OPEN_MODAL_ON_CREATE_KEY,
	SEPARATE_BULK_PRESETS_KEY,
	SHOW_ISOLATE_NOTIFICATIONS_KEY,
	SHOW_PRESET_NOTIFICATIONS_KEY,
	SHOW_SHARED_NOTIFICATIONS_KEY,
	SHOW_SNIPPET_METADATA_KEY,
	SHOW_SNIPPET_NOTIFICATIONS_KEY,
	SHOW_STATUS_BAR_KEY,
	SHOW_UTILITY_NOTIFICATIONS_KEY,
	SKIP_APPLY_CONFIRM_KEY,
	SKIP_DELETE_CONFIRM_KEY,
	SKIP_EXPORT_CONFIRM_KEY,
	SKIP_IMPORT_CONFIRM_KEY,
	STICKY_HEADING_KEY,
} from '../../constants';
import StyleManagerPlugin from '../../main';
import { getFormattedTimestamp } from '../../utils/CommonUtils';
import { ConfirmModal } from '../modals/ConfirmModal';
import { ExportDataConfigModal } from '../modals/ExportDataConfigModal';

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
	): void {
		const setting = new Setting(containerEl)
			.setName(text)
			.setHeading()
			.setClass('style-manager-settings-tab-title');
		const iconEl = setting.nameEl.createSpan({
			cls: 'style-manager-settings-tab-icon',
		});
		setIcon(iconEl, icon);
		setting.nameEl.prepend(iconEl);
	}

	private renderBackupSettings(): void {
		const { containerEl, plugin } = this;

		this.renderHeader(containerEl, 'Backup & safety', 'shield-check');
		const backupContainer = containerEl.createDiv(
			'style-manager-settings-tab-content'
		);

		new Setting(backupContainer)
			.setName('Backup location')
			.setDesc(
				'Choose the folder where full vault backup ZIPs will be saved (e.g. "Backups"). Leave empty to save to the vault root.'
			)
			.addText((text) => {
				const currentPath =
					(plugin.settingsService.settings[BACKUP_PATH_KEY] as string) ?? '';
				text
					.setPlaceholder('Folder/Path (leave empty for vault root)')
					.setValue(currentPath)
					.onChange(
						debounce(async (val) => {
							await plugin.settingsService.setSettings(
								{ [BACKUP_PATH_KEY]: val.trim() },
								{ silentUI: true }
							);
						}, 500)
					);
				plugin.settingsService.bridge.createFolderSuggest(text.inputEl);
			});

		new Setting(backupContainer)
			.setName('Backup timestamp format')
			.setDesc(
				'Customize the timestamp used in backup filenames. Avoid ":", "/", or "\\" as they are invalid in filenames.'
			)
			.addText((text) => {
				text
					.setPlaceholder('YYYYMMDDHHmmss')
					.setValue(
						(plugin.settingsService.settings[
							BACKUP_DATE_FORMAT_KEY
						] as string) ?? 'YYYYMMDDHHmmss'
					)
					.onChange(
						debounce(async (val) => {
							const sanitized =
								val.replace(/[:/\\?%*|"<>]/g, '') || 'YYYYMMDDHHmmss';
							await plugin.settingsService.setSettings(
								{ [BACKUP_DATE_FORMAT_KEY]: sanitized },
								{ silentUI: true }
							);
						}, 500)
					);
			});

		new Setting(backupContainer)
			.setName('Full backup (ZIP)')
			.setDesc(
				'Creates a complete backup containing your preferences, presets, snippets and themes in a single ZIP file.'
			)
			.addButton((btn) => {
				btn
					.setButtonText('Export Universal Backup...')
					.setCta()
					.setIcon('package')
					.onClick(async () => {
						try {
							const data = await plugin.backupService.createUniversalBackup();
							const backupFormat =
								(plugin.settingsService.settings[
									BACKUP_DATE_FORMAT_KEY
								] as string) || 'YYYYMMDDHHmmss';
							const timestamp = getFormattedTimestamp(backupFormat);
							const filename = `full-backup-style-manager-${timestamp}.zip`;
							await plugin.backupService.saveBackupToVault(filename, data);
						} catch (e) {
							console.error('Style Manager | Backup failed:', e);
							plugin.settingsService.notifications.error(
								'Backup failed. See console for details.'
							);
						}
					});
			});

		new Setting(backupContainer)
			.setName('Basic backup')
			.setDesc(
				'Backup only your data.json variables (no snippets and themes) as a single file.'
			)
			.addButton((btn) => {
				btn
					.setButtonText('Export JSON...')
					.setIcon('upload')
					.onClick(() => {
						new ExportDataConfigModal(
							this.app,
							plugin,
							'Basic backup',
							plugin.settingsService.settings
						).open();
					});
			});

		new Setting(backupContainer)
			.setName('Restore backup from file')
			.setDesc(
				'Import a previously exported backup file (.json or .zip). This will create a safety snapshot for your plugin configurations before overwriting it.'
			)
			.addButton((btn) => {
				btn
					.setButtonText('Restore backup...')
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
								if (!content) return;

								new ConfirmModal(
									this.app,
									'Restore backup',
									'Importing a backup will overwrite your current settings, presets, snippets, and themes. A safety snapshot will be created automatically. Are you sure you want to proceed?',
									'Restore',
									true,
									async () => {
										await plugin.backupService.restoreBackup(content);
									}
								).open();
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
			.setName('Rollback plugin state')
			.setDesc(
				'Restore internal plugin configuration  from the last automatic safety snapshot (data.json.bak). This will overwrite your current plugin state. Snippets and themes are not affected.'
			)
			.addButton((btn) => {
				btn
					.setButtonText('Safety rollback')
					.setWarning()
					.setIcon('rotate-ccw')
					.onClick(() => {
						new ConfirmModal(
							this.app,
							'Safety rollback',
							'Restore internal plugin configuration  from the last automatic safety snapshot (data.json.bak). This will overwrite your current plugin state. Snippets and themes are not affected.',
							'Rollback',
							true,
							async () => {
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
									plugin.settingsService.notifications.util(
										'No safety snapshot found.'
									);
								}
							}
						).open();
					});
			});
	}

	private renderExportSettings(): void {
		const { containerEl, plugin } = this;

		this.renderHeader(containerEl, 'Exports', 'download');
		const exportContainer = containerEl.createDiv(
			'style-manager-settings-tab-content'
		);

		new Setting(exportContainer)
			.setName('Preset export location')
			.setDesc(
				'Choose the folder where presets will be saved in your vault (e.g. "Presets"). Leave empty for vault root.'
			)
			.addText((text) => {
				const currentPath =
					(plugin.settingsService.settings[EXPORT_PATH_KEY] as string) || '';
				text
					.setPlaceholder('Folder/Path')
					.setValue(currentPath)
					.onChange(
						debounce(async (val) => {
							await plugin.settingsService.setSettings(
								{ [EXPORT_PATH_KEY]: val.trim() },
								{ silentUI: true }
							);
						}, 500)
					);
				plugin.settingsService.bridge.createFolderSuggest(text.inputEl);
			});

		new Setting(exportContainer)
			.setName('Preferred export extension')
			.setDesc(
				'Choose the file extension for your preset exports. The content will remain in JSON format regardless of extension.'
			)
			.addDropdown((dropdown) => {
				dropdown
					.addOption('.json', '.json')
					.addOption('.md', '.md')
					.addOption('.txt', '.txt')
					.setValue(
						(plugin.settingsService.settings[EXPORT_EXTENSION_KEY] as string) ||
							'.json'
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings({
							[EXPORT_EXTENSION_KEY]: val,
							silentUI: true,
						});
					});
			});

		new Setting(exportContainer)
			.setName('Export timestamp format')
			.setDesc(
				'Customize the timestamp used in export filenames. Avoid characters like ":", "/", or "\\" as they are invalid in filenames.'
			)
			.addText((text) => {
				text
					.setPlaceholder('YYYYMMDDHHmmss')
					.setValue(
						(plugin.settingsService.settings[
							EXPORT_DATE_FORMAT_KEY
						] as string) ?? 'YYYYMMDDHHmmss'
					)
					.onChange(
						debounce(async (val) => {
							const sanitized = val.replace(/[:/\\?%*|"<>]/g, '');
							await plugin.settingsService.setSettings(
								{ [EXPORT_DATE_FORMAT_KEY]: sanitized },
								{ silentUI: true }
							);
						}, 500)
					);
			});

		new Setting(exportContainer)
			.setName('Separate bulk presets')
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

		this.renderHeader(containerEl, 'User interface', 'layout');
		const uiContainer = containerEl.createDiv(
			'style-manager-settings-tab-content'
		);

		new Setting(uiContainer)
			.setName('Created date format')
			.setDesc(
				'Customize the date format for the "Created" label in the preset list. Uses moment.js syntax (e.g. "MMM. DD, YYYY").'
			)
			.addText((text) => {
				text
					.setPlaceholder('MMM. DD, YYYY')
					.setValue(
						(plugin.settingsService.settings[
							CREATED_DATE_FORMAT_KEY
						] as string) || 'MMM. DD, YYYY'
					)
					.onChange(
						debounce(async (val) => {
							await plugin.settingsService.setSettings(
								{
									[CREATED_DATE_FORMAT_KEY]: val || 'MMM. DD, YYYY',
								},
								{ silentUI: true }
							);
						}, 500)
					);
			});

		new Setting(uiContainer)
			.setName('Show status bar icon')
			.setDesc(
				'Show an icon in the Obsidian status bar for quick access to Style Manager status and actions. (Desktop only)'
			)
			.addToggle((toggle) => {
				toggle
					.setValue(
						(plugin.settingsService.settings[
							SHOW_STATUS_BAR_KEY
						] as boolean) === true
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [SHOW_STATUS_BAR_KEY]: val },
							{ silentUI: true }
						);
					});
			});

		new Setting(uiContainer)
			.setName('Show snippet metadata')
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
			.setName('Sticky heading')
			.setDesc(
				'Enable sticky headings in the styles tab for better navigation.'
			)
			.addToggle((toggle) => {
				toggle
					.setValue(
						(plugin.settingsService.settings[STICKY_HEADING_KEY] as boolean) !==
							false
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [STICKY_HEADING_KEY]: val },
							{ silentUI: true }
						);
					});
			});

		new Setting(uiContainer)
			.setName('Open editor after creation')
			.setDesc(
				'Automatically open the CSS editor modal when a new snippet is created.'
			)
			.addToggle((toggle) => {
				toggle
					.setValue(
						(plugin.settingsService.settings[
							OPEN_MODAL_ON_CREATE_KEY
						] as boolean) !== false
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [OPEN_MODAL_ON_CREATE_KEY]: val },
							{ silentUI: true }
						);
					});
			});

		new Setting(uiContainer)
			.setName('Editor tab size')
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
				key: SKIP_APPLY_CONFIRM_KEY,
				name: 'Skip apply confirmation',
				desc: 'Instantly apply presets without showing the confirmation dialog.',
			},
			{
				key: SKIP_DELETE_CONFIRM_KEY,
				name: 'Skip delete confirmation',
				desc: 'Instantly delete presets without showing the confirmation dialog.',
			},
			{
				key: SKIP_EXPORT_CONFIRM_KEY,
				name: 'Skip export confirmation',
				desc: 'Instantly export presets without showing the confirmation dialog.',
			},
			{
				key: SKIP_IMPORT_CONFIRM_KEY,
				name: 'Skip import confirmation',
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

		this.renderHeader(containerEl, 'Developer options', 'code');
		const developerContainer = containerEl.createDiv(
			'style-manager-settings-tab-content'
		);

		const notificationSettings = [
			{
				key: SHOW_SHARED_NOTIFICATIONS_KEY,
				name: 'shared notifications',
				desc: 'Alerts when background shared changes are detected.',
			},
			{
				key: SHOW_PRESET_NOTIFICATIONS_KEY,
				name: 'preset notifications',
				desc: 'Alerts when saving, applying, or exporting presets.',
			},
			{
				key: SHOW_ISOLATE_NOTIFICATIONS_KEY,
				name: 'isolate notifications',
				desc: 'Alerts when resetting or pushing isolated configurations.',
			},
			{
				key: SHOW_SNIPPET_NOTIFICATIONS_KEY,
				name: 'snippet notifications',
				desc: 'Alerts when managing CSS snippets (save, rename, delete).',
			},
			{
				key: SHOW_UTILITY_NOTIFICATIONS_KEY,
				name: 'utility notifications',
				desc: 'Minor UI feedback like "Copied to clipboard".',
			},
		];

		notificationSettings.forEach(({ key, name, desc }) => {
			new Setting(developerContainer)
				.setName(`Show ${name}`)
				.setDesc(desc)
				.addToggle((toggle) => {
					toggle
						.setValue(
							key === SHOW_SHARED_NOTIFICATIONS_KEY
								? plugin.settingsService.settings[key] === true
								: plugin.settingsService.settings[key] !== false
						)
						.onChange(async (val) => {
							await plugin.settingsService.setSettings(
								{ [key]: val },
								{ silentUI: true }
							);
						});
				});
		});

		new Setting(developerContainer)
			.setName('Enable console logging')
			.setDesc(
				'Enable all debug, warning, and informational console logs. Errors are always displayed.'
			)
			.addToggle((toggle) => {
				toggle
					.setValue(
						(plugin.settingsService.settings[
							ENABLE_CONSOLE_LOGGING_KEY
						] as boolean) || false
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [ENABLE_CONSOLE_LOGGING_KEY]: val },
							{ silentUI: true }
						);
					});
			});

		new Setting(developerContainer)
			.setName('Current shared version')
			.setDesc(
				'The internal version timestamp. Devices are in shared state when this number matches.'
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

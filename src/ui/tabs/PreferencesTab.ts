import { App, Setting, debounce, setIcon } from 'obsidian';
import StyleManagerPlugin from '../../main';
import { getFormattedTimestamp } from '../../utils/CommonUtils';
import { ConfirmModal } from '../modals/ConfirmModal';
import { ExportDataConfigModal } from '../modals/ExportDataConfigModal';
import { BackupKeys, PreferencesKeys, ExportKeys, NotificationKeys, ConfirmKeys } from "../../constants";

export class PreferencesTab {
	private filterString: string = '';

	constructor(
		private app: App,
		private containerEl: HTMLElement,
		private plugin: StyleManagerPlugin
	) {}

	render(): void {
		const searchRow = this.containerEl.createDiv('style-manager-search-row');
		searchRow.addClass('style-manager-preferences-search-row');

		new Setting(searchRow)
			.setClass('style-manager-search-container')
			.setClass('style-manager-preferences-filter')
			.addSearch((search) => {
				search.setPlaceholder('Search preferences...').onChange(
					debounce((value) => {
						this.filterString = value.toLowerCase();
						this.applyFilter();
					}, 250)
				);
			});

		this.renderUISettings();
		this.renderConfirmations();
		this.renderBackupSettings();
		this.renderExportSettings();
		this.renderCSSEditorSettings();
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
					(plugin.settingsService.sharedSettings[BackupKeys.BACKUP_PATH] as string) ??
					'';
				text
					.setPlaceholder('Folder/Path (leave empty for vault root)')
					.setValue(currentPath)
					.onChange(
						debounce(async (val) => {
							await plugin.settingsService.setSettings(
								{ [BackupKeys.BACKUP_PATH]: val.trim() },
								{ silentUI: true, target: 'shared' }
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
						(plugin.settingsService.sharedSettings[
							BackupKeys.BACKUP_DATE_FORMAT
						] as string) ?? 'YYYYMMDDHHmmss'
					)
					.onChange(
						debounce(async (val) => {
							const sanitized =
								val.replace(/[:/\\?%*|"<>]/g, '') || 'YYYYMMDDHHmmss';
							await plugin.settingsService.setSettings(
								{ [BackupKeys.BACKUP_DATE_FORMAT]: sanitized },
								{ silentUI: true, target: 'shared' }
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
								(plugin.settingsService.sharedSettings[
									BackupKeys.BACKUP_DATE_FORMAT
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
							plugin.settingsService.sharedSettings
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
					(plugin.settingsService.sharedSettings[ExportKeys.EXPORT_PATH] as string) ||
					'';
				text
					.setPlaceholder('Folder/Path')
					.setValue(currentPath)
					.onChange(
						debounce(async (val) => {
							await plugin.settingsService.setSettings(
								{ [ExportKeys.EXPORT_PATH]: val.trim() },
								{ silentUI: true, target: 'shared' }
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
						(plugin.settingsService.sharedSettings[
							ExportKeys.EXPORT_EXTENSION
						] as string) || '.json'
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [ExportKeys.EXPORT_EXTENSION]: val },
							{ silentUI: true, target: 'shared' }
						);
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
						(plugin.settingsService.sharedSettings[
							ExportKeys.EXPORT_DATE_FORMAT
						] as string) ?? 'YYYYMMDDHHmmss'
					)
					.onChange(
						debounce(async (val) => {
							const sanitized = val.replace(/[:/\\?%*|"<>]/g, '');
							await plugin.settingsService.setSettings(
								{ [ExportKeys.EXPORT_DATE_FORMAT]: sanitized },
								{ silentUI: true, target: 'shared' }
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
						(plugin.settingsService.sharedSettings[
							PreferencesKeys.SEPARATE_BULK_PRESETS
						] as boolean) || false
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [PreferencesKeys.SEPARATE_BULK_PRESETS]: val },
							{ silentUI: true, target: 'shared' }
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
						(plugin.settingsService.sharedSettings[
							ExportKeys.CREATED_DATE_FORMAT
						] as string) || 'MMM. DD, YYYY'
					)
					.onChange(
						debounce(async (val) => {
							await plugin.settingsService.setSettings(
								{
									[ExportKeys.CREATED_DATE_FORMAT]: val || 'MMM. DD, YYYY',
								},
								{ silentUI: true, target: 'shared' }
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
						(plugin.settingsService.sharedSettings[
							PreferencesKeys.SHOW_STATUS_BAR
						] as boolean) === true
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [PreferencesKeys.SHOW_STATUS_BAR]: val },
							{ silentUI: true, target: 'shared' }
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
						(plugin.settingsService.sharedSettings[
							PreferencesKeys.SHOW_SNIPPET_METADATA
						] as boolean) !== false
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [PreferencesKeys.SHOW_SNIPPET_METADATA]: val },
							{ silentUI: true, target: 'shared' }
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
						(plugin.settingsService.sharedSettings[
							PreferencesKeys.STICKY_HEADING
						] as boolean) !== false
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [PreferencesKeys.STICKY_HEADING]: val },
							{ silentUI: true, target: 'shared' }
						);
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
				key: ConfirmKeys.SKIP_DELETE_CONFIRM,
				name: 'Skip delete confirmation',
				desc: 'Instantly delete presets without showing the confirmation dialog.',
			},
			{
				key: ConfirmKeys.SKIP_EXPORT_CONFIRM,
				name: 'Skip export confirmation',
				desc: 'Instantly export presets without showing the confirmation dialog.',
			},
			{
				key: ConfirmKeys.SKIP_IMPORT_CONFIRM,
				name: 'Skip import confirmation',
				desc: 'Instantly import presets or styles without showing the confirmation dialog.',
			},
		];

		new Setting(confirmContainer)
			.setName('Single preset apply action')
			.setDesc('Action to take when applying a single preset manually.')
			.addDropdown((dropdown) => {
				dropdown
					.addOption('ask', 'Ask (Show Modal)')
					.addOption('overwrite', 'Overwrite (reset and apply)')
					.addOption('merge', 'Merge (Apply without resetting)')
					.setValue(
						(plugin.settingsService.sharedSettings[
							PreferencesKeys.PRESET_APPLY_ACTION
						] as string) || 'ask'
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [PreferencesKeys.PRESET_APPLY_ACTION]: val },
							{ silentUI: true, target: 'shared' }
						);
					});
			});

		new Setting(confirmContainer)
			.setName('Bulk preset apply action')
			.setDesc('Action to take when applying multiple presets manually.')
			.addDropdown((dropdown) => {
				dropdown
					.addOption('ask', 'Ask (Show Modal)')
					.addOption('overwrite', 'Overwrite (reset and apply)')
					.addOption('merge', 'Merge (Apply without resetting)')
					.setValue(
						(plugin.settingsService.sharedSettings[
							PreferencesKeys.BULK_PRESET_APPLY_ACTION
						] as string) || 'ask'
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [PreferencesKeys.BULK_PRESET_APPLY_ACTION]: val },
							{ silentUI: true, target: 'shared' }
						);
					});
			});

		new Setting(confirmContainer)
			.setName('Scheduled preset apply action')
			.setDesc('Action to take when a scheduled preset triggers.')
			.addDropdown((dropdown) => {
				dropdown
					.addOption('overwrite', 'Overwrite (reset and apply)')
					.addOption('merge', 'Merge (Apply without resetting)')
					.setValue(
						(plugin.settingsService.sharedSettings[
							PreferencesKeys.SCHEDULE_APPLY_ACTION
						] as string) || 'overwrite'
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [PreferencesKeys.SCHEDULE_APPLY_ACTION]: val },
							{ silentUI: true, target: 'shared' }
						);
					});
			});

		confirmationSettings.forEach(({ key, name, desc }) => {
			new Setting(confirmContainer)
				.setName(name)
				.setDesc(desc)
				.addToggle((toggle) => {
					toggle
						.setValue(
							(plugin.settingsService.sharedSettings[key] as boolean) || false
						)
						.onChange(async (val) => {
							await plugin.settingsService.setSettings(
								{ [key]: val },
								{ silentUI: true, target: 'shared' }
							);
						});
				});
		});
	}

	private renderCSSEditorSettings(): void {
		const { containerEl, plugin } = this;

		this.renderHeader(containerEl, 'CSS Editor', 'edit');
		const editorContainer = containerEl.createDiv(
			'style-manager-settings-tab-content'
		);

		new Setting(editorContainer)
			.setName('Open editor after CSS file creation')
			.setDesc(
				'Automatically open the CSS editor modal when a new snippet is created.'
			)
			.addToggle((toggle) => {
				toggle
					.setValue(
						(plugin.settingsService.sharedSettings[
							PreferencesKeys.OPEN_MODAL_ON_CREATE
						] as boolean) !== false
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [PreferencesKeys.OPEN_MODAL_ON_CREATE]: val },
							{ silentUI: true, target: 'shared' }
						);
					});
			});

		new Setting(editorContainer)
			.setName('Open CSS files in default app')
			.setDesc(
				'Open CSS files like snippets and themes using your system default text editor instead of the built-in modal.'
			)
			.addToggle((toggle) => {
				toggle
					.setValue(localStorage.getItem(PreferencesKeys.OPEN_IN_DEFAULT_APP) === 'true')
					.onChange(async (val) => {
						localStorage.setItem(PreferencesKeys.OPEN_IN_DEFAULT_APP, String(val));
					});
			});

		new Setting(editorContainer)
			.setName('Editor tab size')
			.setDesc('Set the indentation width (tab size) for the CSS editor modal.')
			.addSlider((slider) => {
				slider
					.setLimits(2, 8, 1)
					.setDynamicTooltip()
					.setValue(
						(plugin.settingsService.sharedSettings[
							PreferencesKeys.EDITOR_TAB_SIZE
						] as number) || 4
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [PreferencesKeys.EDITOR_TAB_SIZE]: val },
							{ silentUI: true, target: 'shared' }
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
							{ [PreferencesKeys.EDITOR_TAB_SIZE]: 4 },
							{ silentUI: true, target: 'shared' }
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

		new Setting(editorContainer)
			.setName('@settings spaces before dash')
			.setDesc(
				'Set the number of spaces before the dash (-) in generated @settings blocks. Maximum 10 spaces.'
			)
			.addSlider((slider) => {
				slider
					.setLimits(0, 12, 1)
					.setDynamicTooltip()
					.setValue(
						(plugin.settingsService.sharedSettings[
							PreferencesKeys.SETTINGS_BLOCK_DASH_SPACES
						] as number) ?? 4
					)
					.onChange(async (val) => {
						let compVal =
							(plugin.settingsService.sharedSettings[
								PreferencesKeys.SETTINGS_BLOCK_COMPONENT_SPACES
							] as number) ?? 8;

						const updates: Record<string, number> = {
							[PreferencesKeys.SETTINGS_BLOCK_DASH_SPACES]: val,
						};

						if (val >= compVal) {
							compVal = val + 1;
							updates[PreferencesKeys.SETTINGS_BLOCK_COMPONENT_SPACES] = compVal;
						}

						await plugin.settingsService.setSettings(updates, {
							silentUI: true,
							target: 'shared',
						});

						const compSlider = (
							this as unknown as {
								componentSpacesSlider?: import('obsidian').SliderComponent;
							}
						).componentSpacesSlider;
						if (compSlider) {
							compSlider.setValue(compVal);
						}
					});

				// Expose slider for reset button
				(
					this as unknown as {
						dashSpacesSlider: import('obsidian').SliderComponent;
					}
				).dashSpacesSlider = slider;
			})
			.addExtraButton((btn) => {
				btn
					.setIcon('rotate-ccw')
					.setTooltip('Reset to default (4)')
					.onClick(async () => {
						const dashDefault = 4;
						let compVal =
							(plugin.settingsService.sharedSettings[
								PreferencesKeys.SETTINGS_BLOCK_COMPONENT_SPACES
							] as number) ?? 8;

						const updates: Record<string, number> = {
							[PreferencesKeys.SETTINGS_BLOCK_DASH_SPACES]: dashDefault,
						};

						if (dashDefault >= compVal) {
							compVal = dashDefault + 1;
							updates[PreferencesKeys.SETTINGS_BLOCK_COMPONENT_SPACES] = compVal;
						}

						await plugin.settingsService.setSettings(updates, {
							silentUI: true,
							target: 'shared',
						});

						const slider = (
							this as unknown as {
								dashSpacesSlider?: import('obsidian').SliderComponent;
							}
						).dashSpacesSlider;
						if (slider) {
							slider.setValue(dashDefault);
						}

						const compSlider = (
							this as unknown as {
								componentSpacesSlider?: import('obsidian').SliderComponent;
							}
						).componentSpacesSlider;
						if (compSlider) {
							compSlider.setValue(compVal);
						}
					});
			});

		new Setting(editorContainer)
			.setName('@settings spaces before components')
			.setDesc(
				'Set the number of spaces before the setting components (id, type, etc.) in generated @settings blocks. Maximum 12 spaces.'
			)
			.addSlider((slider) => {
				slider
					.setLimits(1, 10, 1)
					.setDynamicTooltip()
					.setValue(
						(plugin.settingsService.sharedSettings[
							PreferencesKeys.SETTINGS_BLOCK_COMPONENT_SPACES
						] as number) ?? 8
					)
					.onChange(async (val) => {
						const dashVal =
							(plugin.settingsService.sharedSettings[
								PreferencesKeys.SETTINGS_BLOCK_DASH_SPACES
							] as number) ?? 4;

						let finalVal = val;
						if (val <= dashVal) {
							finalVal = dashVal + 1;
						}

						await plugin.settingsService.setSettings(
							{ [PreferencesKeys.SETTINGS_BLOCK_COMPONENT_SPACES]: finalVal },
							{ silentUI: true, target: 'shared' }
						);

						if (val !== finalVal) {
							slider.setValue(finalVal);
						}
					});

				// Expose slider for reset button
				(
					this as unknown as {
						componentSpacesSlider: import('obsidian').SliderComponent;
					}
				).componentSpacesSlider = slider;
			})
			.addExtraButton((btn) => {
				btn
					.setIcon('rotate-ccw')
					.setTooltip('Reset to default (8)')
					.onClick(async () => {
						const compDefault = 8;
						const dashVal =
							(plugin.settingsService.sharedSettings[
								PreferencesKeys.SETTINGS_BLOCK_DASH_SPACES
							] as number) ?? 4;

						let finalVal = compDefault;
						if (compDefault <= dashVal) {
							finalVal = dashVal + 1;
						}

						await plugin.settingsService.setSettings(
							{ [PreferencesKeys.SETTINGS_BLOCK_COMPONENT_SPACES]: finalVal },
							{ silentUI: true, target: 'shared' }
						);

						const slider = (
							this as unknown as {
								componentSpacesSlider?: import('obsidian').SliderComponent;
							}
						).componentSpacesSlider;
						if (slider) {
							slider.setValue(finalVal);
						}
					});
			});
	}

	private renderDeveloperSettings(): void {
		const { containerEl, plugin } = this;

		this.renderHeader(containerEl, 'Developer options', 'code');
		const developerContainer = containerEl.createDiv(
			'style-manager-settings-tab-content'
		);

		new Setting(developerContainer)
			.setName('Show CSS parser logs icon')
			.setDesc('Show the "CSS parser logs" icon in the Styles tab.')
			.addToggle((toggle) => {
				toggle
					.setValue(
						(plugin.settingsService.sharedSettings[
							PreferencesKeys.SHOW_PARSE_LOGS_ICON
						] as boolean) !== false
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [PreferencesKeys.SHOW_PARSE_LOGS_ICON]: val },
							{ silentUI: true, target: 'shared' }
						);
					});
			});

		const notificationSettings = [
			{
				key: NotificationKeys.SHOW_SHARED_NOTIFICATIONS,
				name: 'shared notifications',
				desc: 'Alerts when background shared changes are detected.',
			},
			{
				key: NotificationKeys.SHOW_PRESET_NOTIFICATIONS,
				name: 'preset notifications',
				desc: 'Alerts when saving, applying, or exporting presets.',
			},
			{
				key: NotificationKeys.SHOW_ISOLATE_NOTIFICATIONS,
				name: 'isolate notifications',
				desc: 'Alerts when resetting or pushing isolated configurations.',
			},
			{
				key: NotificationKeys.SHOW_SNIPPET_NOTIFICATIONS,
				name: 'snippet notifications',
				desc: 'Alerts when managing CSS snippets (save, rename, delete).',
			},
			{
				key: NotificationKeys.SHOW_UTILITY_NOTIFICATIONS,
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
							key === NotificationKeys.SHOW_SHARED_NOTIFICATIONS
								? plugin.settingsService.sharedSettings[key] === true
								: plugin.settingsService.sharedSettings[key] !== false
						)
						.onChange(async (val) => {
							await plugin.settingsService.setSettings(
								{ [key]: val },
								{ silentUI: true, target: 'shared' }
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
						(plugin.settingsService.sharedSettings[
							PreferencesKeys.ENABLE_CONSOLE_LOGGING
						] as boolean) || false
					)
					.onChange(async (val) => {
						await plugin.settingsService.setSettings(
							{ [PreferencesKeys.ENABLE_CONSOLE_LOGGING]: val },
							{ silentUI: true, target: 'shared' }
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

	private applyFilter(): void {
		const containers = this.containerEl.querySelectorAll<HTMLElement>(
			'.style-manager-settings-tab-content'
		);

		containers.forEach((container) => {
			const settings = container.querySelectorAll<HTMLElement>('.setting-item');
			let anyVisible = false;

			settings.forEach((setting) => {
				const text = setting.textContent?.toLowerCase() || '';
				const matches = text.includes(this.filterString);
				setting.style.display = matches ? '' : 'none';
				if (matches) anyVisible = true;
			});

			container.style.display = anyVisible ? '' : 'none';

			const header = container.previousElementSibling as HTMLElement | null;
			if (
				header &&
				header.classList.contains('style-manager-settings-tab-title')
			) {
				header.style.display = anyVisible ? '' : 'none';
			}
		});
	}
}

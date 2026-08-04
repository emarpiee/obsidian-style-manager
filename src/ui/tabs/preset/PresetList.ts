import {
	ButtonComponent,
	Menu,
	Platform,
	SearchComponent,
	Setting,
	debounce,
} from 'obsidian';

import { PresetItem } from './PresetItem';
import { addApplyOptionsToMenu } from './PresetMenuHelper';

import {
	ConfirmKeys,
	ExportKeys,
	PreferencesKeys,
	StorageKeys,
} from '../../../constants';
import StyleManagerPlugin from '../../../main';
import { Preset } from '../../../types';
import { getFormattedTimestamp } from '../../../utils/CommonUtils';
import { Logger } from '../../../utils/Logger';
import {
	handleItemSelection,
	setupListKeybindings,
} from '../../../utils/UIUtils';
import { ActiveSchedulesModal } from '../../modals/ActiveSchedulesModal';
import { ConfirmModal } from '../../modals/ConfirmModal';
import { CreatePresetModal } from '../../modals/CreatePresetModal';
import { ImportPresetModal } from '../../modals/ImportPresetModal';

export class PresetList {
	private listContainer: HTMLElement;
	private filteredPresets: Preset[] = [];
	private cleanupKeybindings: (() => void) | null = null;
	private statsLeftEl: HTMLSpanElement;

	constructor(
		private containerEl: HTMLElement,
		private plugin: StyleManagerPlugin,
		private onRefresh: () => void
	) {}

	render(): void {
		const { plugin, containerEl } = this;
		const service = plugin.presetService;

		const topBtns = containerEl.createDiv('style-manager-search-row');

		new Setting(topBtns)
			.setClass('style-manager-search-container')
			.addSearch((search: SearchComponent) => {
				search.setValue(service.presetSearchQuery);
				search.setPlaceholder('Search presets...');
				search.onChange(
					debounce((val: string) => {
						service.presetSearchQuery = val.trim();
						this.renderPresetListItems();
					}, 200)
				);
			})
			.addExtraButton((btn) => {
				const updateBtn = (): void => {
					const mode = service.getEffectiveViewMode();
					if (mode === 'isolate') {
						btn.setIcon('eye');
						btn.setTooltip('Hide isolated presets');
					} else {
						btn.setIcon('eye-closed');
						btn.setTooltip('Show isolated presets');
					}
				};

				updateBtn();

				btn.onClick(() => {
					const mode = service.getEffectiveViewMode();
					service.targetView = mode === 'isolate' ? 'shared' : 'isolate';
					service.selectedPresets.clear();
					updateBtn();
					this.renderPresetListItems();
				});
			})
			.addExtraButton((btn) => {
				btn
					.setIcon('calendar-clock')
					.setTooltip('View active schedules')
					.onClick(() => {
						new ActiveSchedulesModal(plugin.app, plugin).open();
					});
			})
			.addExtraButton((btn) => {
				btn
					.setIcon('plus')
					.setTooltip('Create preset')
					.onClick(() => {
						const prefixesArr = plugin.presetService.getPrefixesMetadata();
						new CreatePresetModal(
							plugin.app,
							plugin.presetService,
							prefixesArr,
							() => {
								this.onRefresh();
							}
						).open();
					});
			})
			.addExtraButton((btn) => {
				btn
					.setIcon('download')
					.setTooltip('Import preset')
					.onClick(() => {
						new ImportPresetModal(plugin.app, plugin.presetService, () => {
							this.onRefresh();
						}).open();
					});
			});

		const presetsConfigArea = containerEl.createDiv(
			'style-manager-presets-tab-content'
		);
		if (Platform.isMobile) {
			presetsConfigArea.addClass('is-mobile');
		}

		const statsBarEl = presetsConfigArea.createDiv(
			'style-manager-snippets-stats-bar'
		);
		this.statsLeftEl = statsBarEl.createSpan('style-manager-stats-left');

		this.listContainer = presetsConfigArea.createDiv(
			'style-manager-presets-list'
		);
		this.listContainer.tabIndex = 0;

		this.cleanupKeybindings = setupListKeybindings({
			container: this.listContainer,
			getItems: () =>
				service.filterPresets(service.presets, service.presetSearchQuery),
			getId: (p) => p.id,
			selectedIds: service.selectedPresets,
			onSelectionChange: () => this.renderPresetListItems(),
		});

		this.renderPresetListItems();
	}

	/** Removes the document-level keydown listener registered by setupListKeybindings. */
	destroy(): void {
		this.cleanupKeybindings?.();
		this.cleanupKeybindings = null;
	}

	private renderPresetListItems(): void {
		const { plugin, listContainer } = this;
		if (!listContainer) return;

		const service = plugin.presetService;
		listContainer.empty();

		if (service.selectedPresets.size > 0) {
			listContainer.addClass('has-bulk-actions');
		} else {
			listContainer.removeClass('has-bulk-actions');
		}

		this.filteredPresets = service.filterPresets(
			service.presets,
			service.presetSearchQuery
		).sort((a, b) => {
			if (a.isFavorite && !b.isFavorite) return -1;
			if (!a.isFavorite && b.isFavorite) return 1;
			return b.created - a.created;
		});

		const totalPresets = service.presets.length;
		const matchCount = this.filteredPresets.length;

		if (service.presetSearchQuery) {
			const query = service.presetSearchQuery.toLowerCase();
			const themeMatch = query.match(/@theme\s+([^\s@]+)/);
			const snippetMatch = query.match(/@snippet\s+([^\s@]+)/);
			const nameMatch = query.match(/@name\s+([^\s@]+)/);
			const isLight = query.includes('@light');
			const isDark = query.includes('@dark');

			const cleanedQuery = query
				.replace(/@theme\s+[^\s@]+/g, '')
				.replace(/@snippet\s+[^\s@]+/g, '')
				.replace(/@name\s+[^\s@]+/g, '')
				.replace(/@light/g, '')
				.replace(/@dark/g, '')
				.trim();

			const modifiers: string[] = [];
			if (themeMatch) modifiers.push(`with theme "${themeMatch[1]}"`);
			if (snippetMatch) modifiers.push(`with snippet "${snippetMatch[1]}"`);
			if (nameMatch) modifiers.push(`named "${nameMatch[1]}"`);
			if (isLight) modifiers.push('in light appearance');
			if (isDark) modifiers.push('in dark appearance');
			if (cleanedQuery) modifiers.push(`matching "${cleanedQuery}"`);

			const plural = matchCount === 1 ? 'preset' : 'presets';
			let label = `${matchCount} ${plural}`;
			if (modifiers.length > 0) {
				label += ' ' + modifiers.join(' and ');
			}

			this.statsLeftEl.setText(label);
		} else {
			this.statsLeftEl.setText(
				`You have ${totalPresets} preset${totalPresets !== 1 ? 's' : ''}`
			);
		}

		if (service.presets.length === 0) {
			listContainer.createEl('p', {
				text: 'No presets saved yet.',
				cls: 'setting-item-description',
			});
			return;
		}

		if (this.filteredPresets.length === 0) {
			listContainer.createEl('p', {
				text: 'No presets found matching your search.',
				cls: 'style-manager-no-results',
			});
			return;
		}

		this.filteredPresets.forEach((preset, index) => {
			const item = new PresetItem(
				listContainer,
				preset,
				plugin,
				service.selectedPresets.has(preset.id),
				service.lastSelectedIndex ?? null,
				index,
				(e, forceToggle) => {
					this.handleSelection(e, preset, index, forceToggle);
				},
				() => this.renderPresetListItems()
			);
			item.render();
		});

		if (service.selectedPresets.size > 0) {
			this.renderBulkActions();
			this.containerEl.addClass('has-bulk-actions');
		} else {
			this.containerEl.querySelector('.style-manager-bulk-actions')?.remove();
			this.containerEl.removeClass('has-bulk-actions');
		}
	}

	private renderBulkActions(): void {
		const { plugin, containerEl } = this;
		const service = plugin.presetService;

		containerEl.querySelector('.style-manager-bulk-actions')?.remove();
		const bulkActionRow = containerEl.createDiv('style-manager-bulk-actions');

		bulkActionRow.createSpan({
			text: `${service.selectedPresets.size} selected`,
			cls: 'style-manager-bulk-count',
		});

		const actionsDiv = bulkActionRow.createDiv('style-manager-bulk-buttons');

		new ButtonComponent(actionsDiv).setButtonText('Select all').onClick(() => {
			this.filteredPresets.forEach((p) => service.selectedPresets.add(p.id));
			this.renderPresetListItems();
		});

		new ButtonComponent(actionsDiv).setButtonText('Export').onClick(() => {
			const presetsToExport = service.presets.filter((p) =>
				service.selectedPresets.has(p.id)
			);

			const preferredExtension =
				(plugin.settingsService.settings[
					ExportKeys.EXPORT_EXTENSION
				] as string) || '.json';

			const performExport = (includeSnippets = false): void => {
				void (async (): Promise<void> => {
					try {
						const extension: string = includeSnippets
							? '.zip'
							: preferredExtension;

						const timestamp = getFormattedTimestamp(
							plugin.settingsService.settings[
								ExportKeys.EXPORT_DATE_FORMAT
							] as string
						);
						const timestampPart = timestamp ? `-${timestamp}` : '';
						const filename = `bulk-export-style-manager${timestampPart}${extension}`;

						if (includeSnippets) {
							const separatePresets =
								(plugin.settingsService.settings[
									PreferencesKeys.SEPARATE_BULK_PRESETS
								] as boolean) || false;
							const data = await plugin.bundleService.createBundle(
								presetsToExport,
								preferredExtension,
								separatePresets
							);
							await service.saveFileToVault(filename, data);
						} else {
							const content = JSON.stringify(presetsToExport, null, 2);
							await service.saveFileToVault(filename, content);
						}

						service.selectedPresets.clear();
						this.renderPresetListItems();
					} catch (err) {
						Logger.error('Style Manager | Bulk export failed:', err);
						plugin.settingsService.notifications.error(
							`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`
						);
					}
				})();
			};

			const allSnippets = new Set<string>();
			const allThemes = new Set<string>();
			presetsToExport.forEach((p) => {
				const snippets = (p.data[StorageKeys.SNIPPETS] as string[]) || [];
				snippets.forEach((s) => allSnippets.add(s));
				const themeName = p.data[StorageKeys.THEME] as string | undefined;
				if (themeName && themeName !== 'default') {
					allThemes.add(themeName);
				}
			});

			if (allSnippets.size > 0 || allThemes.size > 0) {
				let description = 'The selected presets contain';
				if (allSnippets.size > 0 && allThemes.size > 0) {
					description += ` ${allSnippets.size} unique snippet(s) and ${allThemes.size} unique theme(s).`;
				} else if (allSnippets.size > 0) {
					description += ` ${allSnippets.size} unique snippet(s).`;
				} else {
					description += ` ${allThemes.size} unique theme(s).`;
				}
				description += ' Do you want to include these files in a ZIP bundle?';

				new ConfirmModal(
					plugin.app,
					'Export multiple presets',
					description,
					'Include assets (ZIP)',
					false,
					(): void => {
						void performExport(true);
					},
					`Presets only (${preferredExtension})`,
					(): void => {
						void performExport(false);
					}
				).open();
			} else {
				if (plugin.settingsService.settings[ConfirmKeys.SKIP_EXPORT_CONFIRM]) {
					performExport(false);
				} else {
					new ConfirmModal(
						plugin.app,
						'Export multiple presets',
						`Are you sure you want to export ${service.selectedPresets.size} selected presets to your vault?`,
						`Export (${preferredExtension})`,
						false,
						(): void => {
							void performExport(false);
						}
					).open();
				}
			}
		});

		new ButtonComponent(actionsDiv)
			.setButtonText('Delete')
			.setWarning()
			.onClick(() => {
				const performDelete = async (): Promise<void> => {
					const presetsToDelete = service.presets.filter((p) =>
						service.selectedPresets.has(p.id)
					);
					await service.trashPresets(presetsToDelete);

					service.presets = service.presets.filter(
						(p) => !service.selectedPresets.has(p.id)
					);
					service.selectedPresets.clear();
					await service.savePresets();
					this.onRefresh();
				};

				if (plugin.settingsService.settings[ConfirmKeys.SKIP_DELETE_CONFIRM]) {
					void performDelete();
				} else {
					new ConfirmModal(
						plugin.app,
						'Delete multiple presets',
						`Are you sure you want to delete ${service.selectedPresets.size} presets? This action cannot be undone.`,
						'Delete selected',
						true,
						(): void => {
							void performDelete();
						}
					).open();
				}
			});

		new ButtonComponent(actionsDiv)
			.setButtonText('Apply')
			.setCta()
			.onClick((e: MouseEvent | KeyboardEvent) => {
				const menu = new Menu();

				const applyAll = async (
					isolate: boolean,
					action: 'overwrite' | 'merge' = 'overwrite'
				): Promise<void> => {
					await service.applyPresets(
						Array.from(service.selectedPresets),
						isolate,
						action
					);
					service.selectedPresets.clear();
					this.onRefresh();
				};

				addApplyOptionsToMenu(
					menu,
					plugin,
					{ name: 'Bulk presets', data: {} },
					{
						skipConfirm: false,
						applyActionKey: PreferencesKeys.BULK_PRESET_APPLY_ACTION,
						onApplyShared: async (action): Promise<void> => {
							await applyAll(false, action);
						},
						onApplyIsolate: async (action): Promise<void> => {
							await applyAll(true, action);
						},
						onApplyRemote: async (deviceId: string, action): Promise<void> => {
							const selectedIds = Array.from(service.selectedPresets);
							await plugin.presetService.applyPresetsToLocker(
								deviceId,
								selectedIds,
								action
							);
							service.selectedPresets.clear();
							this.renderPresetListItems();
							plugin.settingsService.notifications.isolate(
								`Applied ${selectedIds.length} presets to device locker.`
							);
						},
					}
				);

				menu.showAtMouseEvent(e as MouseEvent);
			});

		new ButtonComponent(actionsDiv)
			.setIcon('cross')
			.setTooltip('Cancel selection')
			.onClick(() => {
				service.selectedPresets.clear();
				this.renderPresetListItems();
			});
	}

	private handleSelection(
		e: MouseEvent | KeyboardEvent,
		preset: Preset,
		index: number,
		forceToggle: boolean = false
	): void {
		const service = this.plugin.presetService;
		handleItemSelection(
			e,
			index,
			preset,
			{
				container: this.listContainer,
				getItems: () => this.filteredPresets,
				getId: (p) => p.id,
				selectedIds: service.selectedPresets,
				lastSelectedIndexGetter: () => service.lastSelectedIndex ?? null,
				lastSelectedIndexSetter: (idx) => {
					service.lastSelectedIndex = idx;
				},
				onSelectionChange: () => this.renderPresetListItems(),
			},
			forceToggle
		);
	}


}

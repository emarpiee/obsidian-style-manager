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
	APPEARANCE_KEY,
	SEPARATE_BULK_PRESETS_KEY,
	SNIPPETS_KEY,
	THEME_KEY,
} from '../../../constants';
import StyleManagerPlugin from '../../../main';
import { Preset } from '../../../types';
import { getFormattedTimestamp } from '../../../utils/CommonUtils';
import { ConfirmModal } from '../../modals/ConfirmModal';
import { CreatePresetModal } from '../../modals/CreatePresetModal';
import { ImportPresetModal } from '../../modals/ImportPresetModal';

export class PresetList {
	private listContainer: HTMLElement;
	private filteredPresets: Preset[] = [];

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
				btn
					.setIcon('plus')
					.setTooltip('Create new preset')
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
					.setIcon('layers')
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

		this.listContainer = presetsConfigArea.createDiv(
			'style-manager-presets-list'
		);
		this.listContainer.tabIndex = 0;

		this.listContainer.addEventListener('keydown', (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
				e.preventDefault();
				const filteredPresets = this.filterPresets(
					service.presets,
					service.presetSearchQuery
				);
				filteredPresets.forEach((p) => service.selectedPresets.add(p.id));
				this.renderPresetListItems();
			}
		});

		this.renderPresetListItems();
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

		this.filteredPresets = this.filterPresets(
			service.presets,
			service.presetSearchQuery
		).sort((a, b) => {
			if (a.isFavorite && !b.isFavorite) return -1;
			if (!a.isFavorite && b.isFavorite) return 1;
			return b.created - a.created;
		});

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

		bulkActionRow.createEl('span', {
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
					'__style_manager_export_extension'
				] as string) || '.json';

			const performExport = async (includeSnippets = false): Promise<void> => {
				try {
					const extension: string = includeSnippets
						? '.zip'
						: preferredExtension;

					const timestamp = getFormattedTimestamp(
						plugin.settingsService.settings[
							'__style_manager_export_date_format'
						] as string
					);
					const timestampPart = timestamp ? `-${timestamp}` : '';
					const filename = `bulk-export-style-manager${timestampPart}${extension}`;

					if (includeSnippets) {
						const separatePresets =
							(plugin.settingsService.settings[
								SEPARATE_BULK_PRESETS_KEY
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
					console.error('Style Manager | Bulk export failed:', err);
						plugin.settingsService.notifications.error(
							`Export failed: ${err instanceof Error ? err.message : String(err)}`
						);
				}
			};

			const allSnippets = new Set<string>();
			const allThemes = new Set<string>();
			presetsToExport.forEach((p) => {
				const snippets = (p.data[SNIPPETS_KEY] as string[]) || [];
				snippets.forEach((s) => allSnippets.add(s));
				const themeName = p.data[THEME_KEY] as string | undefined;
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
					() => performExport(true),
					`Presets only (${preferredExtension})`,
					() => performExport(false)
				).open();
			} else {
				if (
					plugin.settingsService.settings['__style_manager_skip_export_confirm']
				) {
					performExport(false);
				} else {
					new ConfirmModal(
						plugin.app,
						'Export multiple presets',
						`Are you sure you want to export ${service.selectedPresets.size} selected presets to your vault?`,
						`Export (${preferredExtension})`,
						false,
						() => performExport(false)
					).open();
				}
			}
		});

		new ButtonComponent(actionsDiv)
			.setButtonText('Apply')
			.setCta()
			.onClick((e: MouseEvent | KeyboardEvent) => {
				const menu = new Menu();

				const applyAll = async (isolate: boolean): Promise<void> => {
					const performApply = async (): Promise<void> => {
						for (const id of Array.from(service.selectedPresets)) {
							await service.applyPreset(id, isolate);
						}
						service.selectedPresets.clear();
						this.onRefresh();
					};

					if (
						plugin.settingsService.settings[
							'__style_manager_skip_apply_confirm'
						]
					) {
						performApply();
					} else {
						new ConfirmModal(
							plugin.app,
							isolate
								? 'Apply to this device (isolate)'
								: 'Apply to shared locker',
							isolate
								? `Are you sure you want to apply ${service.selectedPresets.size} presets sequentially to this device?`
								: `Are you sure you want to apply ${service.selectedPresets.size} presets sequentially to the shared locker?`,
							isolate ? 'Confirm' : 'Confirm',
							false,
							performApply
						).open();
					}
				};

				addApplyOptionsToMenu(
					menu,
					plugin,
					{ name: 'Bulk presets', data: {} },
					{
						skipConfirm: true,
						onApplyShared: async () => await applyAll(false),
						onApplyIsolate: async () => await applyAll(true),
						onApplyRemote: async (deviceId: string) => {
							const selectedIds = Array.from(service.selectedPresets);
							for (const id of selectedIds) {
								const preset = service.presets.find((p) => p.id === id);
								if (preset) {
									await plugin.settingsService.identity.applyPresetToLocker(
										deviceId,
										preset.data
									);
								}
							}
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

				if (
					plugin.settingsService.settings['__style_manager_skip_delete_confirm']
				) {
					performDelete();
				} else {
					new ConfirmModal(
						plugin.app,
						'Delete multiple presets',
						`Are you sure you want to delete ${service.selectedPresets.size} presets? This action cannot be undone.`,
						'Delete selected',
						true,
						performDelete
					).open();
				}
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
		const lastIndex = service.lastSelectedIndex ?? null;

		if (e.shiftKey && lastIndex !== null) {
			const start = Math.min(lastIndex, index);
			const end = Math.max(lastIndex, index);
			for (let i = start; i <= end; i++) {
				service.selectedPresets.add(this.filteredPresets[i].id);
			}
		} else if (e.ctrlKey || e.metaKey || forceToggle) {
			if (service.selectedPresets.has(preset.id)) {
				service.selectedPresets.delete(preset.id);
			} else {
				service.selectedPresets.add(preset.id);
			}
			service.lastSelectedIndex = index;
		}
		this.renderPresetListItems();
	}

	private filterPresets(presets: Preset[], query: string): Preset[] {
		if (!query) return presets;

		const lowerQuery = query.toLowerCase();

		// Extract tags
		const themeMatch = lowerQuery.match(/@theme\s+([^\s@]+)/);
		const snippetMatch = lowerQuery.match(/@snippet\s+([^\s@]+)/);
		const nameMatch = lowerQuery.match(/@name\s+([^\s@]+)/);
		const isLight = lowerQuery.includes('@light');
		const isDark = lowerQuery.includes('@dark');

		// Remove tags from query to get the "remainder" search (if any)
		const cleanedQuery = lowerQuery
			.replace(/@theme\s+[^\s@]+/g, '')
			.replace(/@snippet\s+[^\s@]+/g, '')
			.replace(/@name\s+[^\s@]+/g, '')
			.replace(/@light/g, '')
			.replace(/@dark/g, '')
			.trim();

		return presets.filter((p) => {
			// 1. Check Tags (AND logic)
			if (
				themeMatch &&
				!(p.data[THEME_KEY] as string | undefined)
					?.toLowerCase()
					.includes(themeMatch[1])
			)
				return false;

			if (isLight && p.data[APPEARANCE_KEY] !== 'light') return false;
			if (isDark && p.data[APPEARANCE_KEY] !== 'dark') return false;

			if (snippetMatch) {
				const snippets = (p.data[SNIPPETS_KEY] as string[]) || [];
				if (!snippets.some((s) => s.toLowerCase().includes(snippetMatch[1])))
					return false;
			}

			if (nameMatch && !p.name.toLowerCase().includes(nameMatch[1]))
				return false;

			// 2. Check remainder query against name
			if (cleanedQuery && !p.name.toLowerCase().includes(cleanedQuery))
				return false;

			return true;
		});
	}
}

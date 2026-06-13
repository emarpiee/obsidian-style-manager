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
import { Menu, Setting, setIcon, setTooltip } from 'obsidian';

import { addApplyOptionsToMenu } from './PresetMenuHelper';

import {
	ACCENT_COLOR_KEY,
	APPEARANCE_KEY,
	CREATED_DATE_FORMAT_KEY,
	EXPORT_DATE_FORMAT_KEY,
	EXPORT_EXTENSION_KEY,
	SKIP_DELETE_CONFIRM_KEY,
	SKIP_EXPORT_CONFIRM_KEY,
	SNIPPETS_KEY,
	THEME_KEY,
} from '../../../constants';
import StyleManagerPlugin from '../../../main';
import { Preset } from '../../../types';
import { formatPresetDate } from '../../../utils/CommonUtils';
import {
	renderAppearanceBadge,
	renderCountBadge,
	renderScheduleBadge,
	renderSnippetBadge,
	renderThemeBadge,
} from '../../components/fields/BadgeRenderer';
import { ConfirmModal } from '../../modals/ConfirmModal';
import { PresetPreviewModal } from '../../modals/PresetPreviewModal';
import { PresetScheduleModal } from '../../modals/PresetScheduleModal';
import { RenameModal } from '../../modals/RenameModal';

export class PresetItem {
	constructor(
		private containerEl: HTMLElement,
		private preset: Preset,
		private plugin: StyleManagerPlugin,
		private isSelected: boolean,
		private lastSelectedIndex: number | null,
		private index: number,
		private onSelectionChange: (
			e: MouseEvent | KeyboardEvent,
			forceToggle?: boolean
		) => void,
		private onRefresh: () => void
	) {}

	render(): void {
		const { preset, plugin, isSelected } = this;
		const count = plugin.settingsService.countModifiedEntries(preset.data);

		const row = new Setting(this.containerEl)
			.setClass('style-manager-item-row')
			.setClass('style-manager-preset-item')
			.setName(preset.name)
			.setDesc(
				`Created: ${
					preset.created
						? formatPresetDate(
								preset.created,
								plugin.settingsService.settings[
									CREATED_DATE_FORMAT_KEY
								] as string
							)
						: 'Unknown Date'
				}`
			);

		// Badges for occupancy (mobile request)
		const badgesContainer = row.nameEl.createDiv(
			'style-manager-badge-container mod-left'
		);

		// Appearance Badge
		const appearance = preset.data[APPEARANCE_KEY] as string | undefined;
		if (appearance) {
			renderAppearanceBadge(badgesContainer, appearance);
		}

		// Theme Badge
		const theme = preset.data[THEME_KEY] as string | undefined;
		if (theme) {
			renderThemeBadge(
				badgesContainer,
				plugin,
				theme,
				preset.data[ACCENT_COLOR_KEY] as string
			);
		}

		// Count Badge
		renderCountBadge(badgesContainer, count);

		// Snippets Badge
		renderSnippetBadge(
			badgesContainer,
			plugin,
			preset.data[SNIPPETS_KEY] as string[]
		);

		// Schedule Badge
		const schedule = plugin.presetScheduleService.getVisibleScheduleForPreset(
			preset.id,
			plugin.settingsService.deviceId
		);
		if (schedule) {
			const description =
				plugin.presetScheduleService.getScheduleDescription(schedule);
			renderScheduleBadge(badgesContainer, description, () => {
				new PresetScheduleModal(plugin.app, plugin, preset.id).open();
			});
		}

		const starIcon = document.createElement('div');
		starIcon.classList.add('clickable-icon', 'style-manager-preset-star-icon');
		if (preset.isFavorite) starIcon.addClass('is-favorite');
		setIcon(starIcon, preset.isFavorite ? 'star' : 'star');
		setTooltip(
			starIcon,
			preset.isFavorite ? 'Remove from favorites' : 'Add to favorites'
		);
		starIcon.onclick = async (e: MouseEvent): Promise<void> => {
			e.stopPropagation();
			preset.isFavorite = !preset.isFavorite;
			await plugin.presetService.savePresets();
			this.onRefresh();
		};
		row.settingEl.prepend(starIcon);

		row.addExtraButton((btn) => {
			btn
				.setIcon('more-vertical')
				.setTooltip('More options')
				.onClick(() => {
					const menu = new Menu();

					// Apply Options
					addApplyOptionsToMenu(menu, plugin, preset, {
						onApplied: () => this.onRefresh(),
					});

					menu.addSeparator();

					// Management Options
					menu.addItem((item) =>
						item
							.setTitle('Rename preset')
							.setIcon('pencil')
							.onClick(() => {
								new RenameModal(
									plugin.app,
									'Rename preset',
									preset.name,
									async (newName: string) => {
										preset.name = newName.trim() || preset.name;
										await plugin.presetService.savePresets();
										this.onRefresh();
									}
								).open();
							})
					);

					menu.addItem((item) =>
						item
							.setTitle('Export to vault')
							.setIcon('download')
							.onClick(() => {
								const performExport = async (
									includeSnippets = false
								): Promise<void> => {
									try {
										const preferredExtension =
											(plugin.settingsService.settings[
												EXPORT_EXTENSION_KEY
											] as string) || '.json';

										const extension: string = includeSnippets
											? '.zip'
											: preferredExtension;

										const safeName = preset.name
											.replace(/[^a-z0-9]/gi, '-')
											.toLowerCase();
										const timestamp =
											plugin.presetService.getFormattedTimestamp(
												plugin.settingsService.settings[
													EXPORT_DATE_FORMAT_KEY
												] as string
											);
										const timestampPart = timestamp ? `-${timestamp}` : '';
										const filename = `${safeName}-style-manager${timestampPart}${extension}`;

										if (includeSnippets) {
											const data = await plugin.bundleService.createBundle(
												preset,
												preferredExtension
											);
											await plugin.presetService.saveFileToVault(
												filename,
												data
											);
										} else {
											const content = JSON.stringify(preset, null, 2);
											await plugin.presetService.saveFileToVault(
												filename,
												content
											);
										}
									} catch (err) {
										console.error('Style Manager | Export failed:', err);
										plugin.settingsService.notifications.error(
											`Export failed: ${err instanceof Error ? err.message : String(err)}`
										);
									}
								};

								const preferredExtension =
									(plugin.settingsService.settings[
										EXPORT_EXTENSION_KEY
									] as string) || '.json';

								const snippetList =
									(preset.data[SNIPPETS_KEY] as string[]) || [];
								const activeTheme = preset.data[THEME_KEY] as
									| string
									| undefined;
								const hasTheme = activeTheme && activeTheme !== 'default';

								if (snippetList.length > 0 || hasTheme) {
									let description = 'This preset';
									if (snippetList.length > 0 && hasTheme) {
										description += ` has ${snippetList.length} enabled snippet(s) and uses theme "${activeTheme}".`;
									} else if (snippetList.length > 0) {
										description += ` has ${snippetList.length} enabled snippet(s).`;
									} else {
										description += ` uses theme "${activeTheme}".`;
									}
									description +=
										' Do you want to include these files in a ZIP bundle?';

									new ConfirmModal(
										plugin.app,
										'Export preset bundle',
										description,
										'Include assets (ZIP)',
										false,
										() => performExport(true),
										`Preset only (${preferredExtension})`,
										() => performExport(false)
									).open();
								} else {
									if (
										plugin.settingsService.settings[SKIP_EXPORT_CONFIRM_KEY]
									) {
										performExport(false);
									} else {
										new ConfirmModal(
											plugin.app,
											'Export preset',
											`Are you sure you want to export the preset "${preset.name}" to your vault?`,
											`Export (${preferredExtension})`,
											false,
											() => performExport(false)
										).open();
									}
								}
							})
					);

					menu.addSeparator();

					// Delete Option
					menu.addItem((item) =>
						item
							.setTitle('Delete preset')
							.setIcon('trash')
							.setWarning(true)
							.onClick(() => {
								const performDelete = async (): Promise<void> => {
									await plugin.presetService.trashPresets([preset]);

									const indexInPresets = plugin.presetService.presets.findIndex(
										(p) => p.id === preset.id
									);
									if (indexInPresets !== -1) {
										plugin.presetService.presets.splice(indexInPresets, 1);
										await plugin.presetService.savePresets();
										this.onRefresh();
									}
								};

								if (plugin.settingsService.settings[SKIP_DELETE_CONFIRM_KEY]) {
									performDelete();
								} else {
									new ConfirmModal(
										plugin.app,
										'Delete preset',
										`Are you sure you want to delete the preset "${preset.name}"? This action cannot be undone.`,
										'Delete',
										true,
										performDelete
									).open();
								}
							})
					);

					const rect = btn.extraSettingsEl.getBoundingClientRect();
					menu.showAtPosition({ x: rect.left, y: rect.bottom });
				});
		});

		const selectIcon = document.createElement('div');
		selectIcon.classList.add(
			'clickable-icon',
			'style-manager-item-select-icon'
		);

		if (isSelected) {
			row.settingEl.addClass('is-selected');
			setIcon(selectIcon, 'check-circle');
		} else {
			row.settingEl.removeClass('is-selected');
			setIcon(selectIcon, 'circle');
		}

		setTooltip(selectIcon, isSelected ? 'Deselect preset' : 'Select preset');

		selectIcon.onclick = (e: MouseEvent): void => {
			e.stopPropagation();
			this.onSelectionChange(e, true);
		};

		row.settingEl.addEventListener('click', (e) => {
			if (
				(e.target as HTMLElement).closest(
					'.setting-item-control, .style-manager-item-select-icon'
				)
			) {
				return;
			}
			if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
				new PresetPreviewModal(plugin.app, plugin, preset).open();
				return;
			}
			this.onSelectionChange(e);
		});

		row.controlEl.appendChild(selectIcon);
	}
}

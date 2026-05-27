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
import { App, Modal, Notice, Setting, setIcon } from 'obsidian';

import { PresetNamePromptModal } from './PresetNamePromptModal';

import { PresetService } from '../../application/PresetService';
import { PrefixMetadata } from '../../types';
import {
	renderAccentBadge,
	renderAppearanceBadge,
	renderSnippetBadge,
	renderThemeBadge,
} from '../components/fields/BadgeRenderer';

export class CreatePresetModal extends Modal {
	service: PresetService;
	prefixes: PrefixMetadata[];
	selectedPrefixes: Set<string>;
	onSave: () => void;

	constructor(
		app: App,
		service: PresetService,
		prefixes: PrefixMetadata[],
		onSave: () => void
	) {
		super(app);
		this.service = service;
		this.prefixes = prefixes;
		this.selectedPrefixes = new Set();
		this.onSave = onSave;

		// Auto-select theme choice by default
		if (this.prefixes.some((p) => p.id === '__theme')) {
			this.selectedPrefixes.add('__theme');
		}

		if (this.prefixes.some((p) => p.id === '__appearance')) {
			this.selectedPrefixes.add('__appearance');
		}

		if (this.prefixes.some((p) => p.id === '__snippets')) {
			this.selectedPrefixes.add('__snippets');
		}

		if (this.prefixes.some((p) => p.id === '__accentColor')) {
			this.selectedPrefixes.add('__accentColor');
		}
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-save-preset-modal');

		contentEl.createEl('h2', {
			text: 'Create New Preset',
			cls: 'style-manager-modal-title',
		});

		contentEl.createEl('h3', {
			text: 'Settings to Save',
			cls: 'style-manager-modal-subtitle',
		});
		contentEl.createEl('p', {
			text: 'Select which themes or plugins to include in this snapshot.',
			cls: 'style-manager-modal-description',
		});

		const controlsEl = contentEl.createDiv('style-manager-modal-controls');

		const selectAllBtn = controlsEl.createEl('button', {
			text: 'Select All',
			cls: 'style-manager-modal-button',
		});
		const selectModifiedBtn = controlsEl.createEl('button', {
			text: 'Select Modified',
			cls: 'style-manager-modal-button',
		});
		const deselectAllBtn = controlsEl.createEl('button', {
			text: 'Deselect All',
			cls: 'style-manager-modal-button',
		});

		const togglesContainer = contentEl.createDiv(
			'style-manager-modal-toggles-container'
		);

		selectAllBtn.onclick = (): void => {
			this.selectedPrefixes = new Set(this.prefixes.map((p) => p.id));
			this.renderToggles(togglesContainer);
		};

		selectModifiedBtn.onclick = (): void => {
			this.selectedPrefixes.clear();
			for (const p of this.prefixes) {
				if (p.count > 0) {
					this.selectedPrefixes.add(p.id);
				}
			}
			this.renderToggles(togglesContainer);
		};

		deselectAllBtn.onclick = (): void => {
			this.selectedPrefixes.clear();
			this.renderToggles(togglesContainer);
		};

		this.renderToggles(togglesContainer);

		new Setting(contentEl)
			.setClass('style-manager-modal-buttons')
			.addButton((btn) =>
				btn
					.setButtonText('Save Preset')
					.setCta()
					.onClick(async () => {
						if (this.selectedPrefixes.size === 0) {
							new Notice('You must select at least one setting to save.');
							return;
						}

						// Calculate total captured settings
						let totalSettingsCount = 0;
						for (const prefix of this.prefixes) {
							if (this.selectedPrefixes.has(prefix.id)) {
								totalSettingsCount += prefix.count;
							}
						}

						if (totalSettingsCount === 0) {
							new Notice(
								'No modified settings found in the selected categories.'
							);
							return;
						}

						const isAll = this.selectedPrefixes.size === this.prefixes.length;
						const savedPrefixes = isAll
							? ['All']
							: Array.from(this.selectedPrefixes);

						const presetName = await this.promptForName();
						if (!presetName) return;

						await this.service.saveCurrentSettingsAsPreset(
							presetName,
							savedPrefixes
						);
						this.onSave();
						this.close();
					})
			);
	}

	renderToggles(container: HTMLElement): void {
		container.empty();
		container.addClass('style-manager-reset-list');

		const themeItem = this.prefixes.find((p) => p.id === '__theme');
		const appearanceItem = this.prefixes.find((p) => p.id === '__appearance');
		const snippetItem = this.prefixes.find((p) => p.id === '__snippets');
		const accentItem = this.prefixes.find((p) => p.id === '__accentColor');
		const otherPrefixes = this.prefixes.filter(
			(p) =>
				p.id !== '__theme' &&
				p.id !== '__appearance' &&
				p.id !== '__snippets' &&
				p.id !== '__accentColor'
		);

		const sortedPrefixes = [];
		if (themeItem) sortedPrefixes.push(themeItem);
		if (appearanceItem) sortedPrefixes.push(appearanceItem);
		if (accentItem) sortedPrefixes.push(accentItem);
		if (snippetItem) sortedPrefixes.push(snippetItem);
		sortedPrefixes.push(...otherPrefixes);

		for (const prefix of sortedPrefixes) {
			const isTheme = prefix.id === '__theme';
			const isAppearance = prefix.id === '__appearance';
			const isSnippets = prefix.id === '__snippets';
			const isAccent = prefix.id === '__accentColor';
			const item = container.createDiv({
				cls: `style-manager-reset-item ${isTheme ? 'is-theme-item' : ''} ${isAppearance ? 'is-appearance-item' : ''} ${isSnippets ? 'is-snippets-item' : ''} ${isAccent ? 'is-accent-item' : ''}`,
			});

			const checkbox = item.createEl('input', { type: 'checkbox' });
			checkbox.checked = this.selectedPrefixes.has(prefix.id);

			checkbox.onchange = (): void => {
				if (checkbox.checked) {
					this.selectedPrefixes.add(prefix.id);
				} else {
					this.selectedPrefixes.delete(prefix.id);
				}
			};

			const textContainer = item.createDiv('style-manager-reset-item-text');
			const nameEl = textContainer.createSpan({
				cls: 'style-manager-reset-item-name',
				text: isTheme
					? 'Active Theme'
					: isAppearance
						? 'Appearance'
						: isSnippets
							? 'Snippets'
							: isAccent
								? 'Accent Color'
								: prefix.name,
			});

			if (isTheme) {
				const iconContainer = document.createElement('span');
				iconContainer.className = 'style-manager-theme-icon';
				setIcon(iconContainer, 'palette');
				nameEl.prepend(iconContainer);
			} else if (isAppearance) {
				const iconContainer = document.createElement('span');
				iconContainer.className = 'style-manager-appearance-icon';
				const appearance = prefix.value;
				setIcon(iconContainer, appearance === 'dark' ? 'moon' : 'sun');
				nameEl.prepend(iconContainer);
			} else if (isSnippets) {
				const iconContainer = document.createElement('span');
				iconContainer.className = 'style-manager-snippets-icon';
				setIcon(iconContainer, 'file-code');
				nameEl.prepend(iconContainer);
			} else if (isAccent) {
				const iconContainer = document.createElement('span');
				iconContainer.className = 'style-manager-accent-icon';
				// Make the bucket icon match the actual accent color
				iconContainer.style.color = prefix.value as string;
				setIcon(iconContainer, 'paint-bucket');
				nameEl.prepend(iconContainer);
			}

			const badgesContainer = textContainer.createDiv(
				'style-manager-badge-container'
			);

			if (isTheme || isAppearance || isSnippets || isAccent) {
				const accentPrefix = sortedPrefixes.find(
					(p) => p.id === '__accentColor'
				);
				const currentAccent = accentPrefix?.value as string;

				if (isTheme) {
					renderThemeBadge(
						badgesContainer,
						prefix.value as string,
						currentAccent
					);
				} else if (isAppearance) {
					renderAppearanceBadge(badgesContainer, prefix.value as string);
				} else if (isAccent) {
					renderAccentBadge(badgesContainer, prefix.value as string);
				} else if (isSnippets) {
					renderSnippetBadge(
						badgesContainer,
						this.service.plugin,
						prefix.value
					);
				}

				item.onclick = (e: MouseEvent): void => {
					if (e.target !== checkbox) {
						checkbox.click();
					}
				};
				continue;
			}

			if (prefix.isActive) {
				badgesContainer.createSpan({
					cls: 'style-manager-badge active',
					text: 'Active',
				});
			} else {
				badgesContainer.createSpan({
					cls: 'style-manager-badge inactive',
					text: 'Inactive',
				});
			}

			// Count Badge
			badgesContainer.createSpan({
				cls: 'style-manager-preset-badge count',
				text: `${prefix.count}`,
			});

			item.onclick = (e: MouseEvent): void => {
				if (e.target !== checkbox) {
					checkbox.click();
				}
			};
		}
	}

	private promptForName(): Promise<string | null> {
		return new Promise((resolve) => {
			new PresetNamePromptModal(this.app, resolve).open();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

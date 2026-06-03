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
import { App, Modal, Setting, setIcon } from 'obsidian';

import StyleManagerPlugin from '../../main';
import {
	renderAccentBadge,
	renderAppearanceBadge,
	renderSnippetBadge,
	renderThemeBadge,
} from '../components/fields/BadgeRenderer';

/**
 * A modal that presents a checklist of customized settings sections,
 * allowing the user to selectively reset them to defaults.
 */
export class ResetSettingsModal extends Modal {
	plugin: StyleManagerPlugin;
	sections: Array<{
		id: string;
		name: string;
		count: number;
		isActive: boolean;
		isIsolate: boolean;
		isShared: boolean;
		value?: string | number | string[];
		accentColor?: string;
	}>;

	onConfirm: (selectedIds: string[]) => Promise<void>;
	selectedIds: Set<string> = new Set();

	constructor(
		app: App,
		plugin: StyleManagerPlugin,
		sections: Array<{
			id: string;
			name: string;
			count: number;
			isActive: boolean;
			isIsolate: boolean;
			isShared: boolean;
			value?: string | number | string[];
		}>,
		onConfirm: (selectedIds: string[]) => Promise<void>
	) {
		super(app);
		this.plugin = plugin;
		this.sections = sections;
		this.onConfirm = onConfirm;
		this.sections.forEach((s) => this.selectedIds.add(s.id));
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;

		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-reset-modal');

		this.setTitle('Reset styles');

		if (this.sections.length === 0) {
			contentEl.createEl('p', {
				text: 'No customized styles found to reset.',
				cls: 'style-manager-modal-description',
			});
			return;
		}

		const listContainer = contentEl.createDiv('style-manager-reset-list');

		const selectAllContainer = contentEl.createDiv(
			'style-manager-reset-select-all'
		);
		const selectAllCheckbox = selectAllContainer.createEl('input', {
			type: 'checkbox',
		});
		selectAllCheckbox.checked = true;
		selectAllContainer.createEl('span', { text: 'Select All' });
		selectAllCheckbox.onchange = (): void => {
			if (selectAllCheckbox.checked) {
				this.sections.forEach((s) => this.selectedIds.add(s.id));
			} else {
				this.selectedIds.clear();
			}
			this.renderList(listContainer);
		};

		this.renderList(listContainer);

		new Setting(contentEl)
			.setClass('style-manager-modal-buttons')
			.addButton((btn) => {
				btn.setButtonText('Cancel').onClick(() => this.close());
			})
			.addButton((btn) => {
				btn
					.setButtonText('Reset selected')
					.setWarning()
					.onClick(async () => {
						if (this.selectedIds.size === 0) {
							this.plugin.settingsService.notifications.preset('Please select at least one item to reset');
							return;
						}
						await this.onConfirm(Array.from(this.selectedIds));
						this.close();
					});
			});
	}

	private renderList(container: HTMLElement): void {
		container.empty();

		const coreIds = ['__theme', '__appearance', '__accentColor', '__snippets'];
		const coreSections = this.sections
			.filter((s) => coreIds.includes(s.id))
			.sort((a, b) => coreIds.indexOf(a.id) - coreIds.indexOf(b.id));
		const otherSections = this.sections.filter((s) => !coreIds.includes(s.id));
		const sortedSections = [...coreSections, ...otherSections];

		sortedSections.forEach((section) => {
			const isTheme = section.id === '__theme';
			const isAppearance = section.id === '__appearance';
			const isAccent = section.id === '__accentColor';
			const isSnippets = section.id === '__snippets';

			const item = container.createDiv({
				cls: `style-manager-reset-item ${isTheme ? 'is-theme-item' : ''} ${isAppearance ? 'is-appearance-item' : ''} ${isAccent ? 'is-accent-item' : ''} ${isSnippets ? 'is-snippets-item' : ''}`,
			});

			const checkbox = item.createEl('input', { type: 'checkbox' });
			checkbox.checked = this.selectedIds.has(section.id);
			checkbox.onchange = (): void => {
				if (checkbox.checked) {
					this.selectedIds.add(section.id);
				} else {
					this.selectedIds.delete(section.id);
				}
			};

			const textContainer = item.createDiv('style-manager-reset-item-text');
			const nameEl = textContainer.createSpan({
				cls: 'style-manager-reset-item-name',
				text: section.name,
			});

			// Icons
			if (isTheme) {
				const iconContainer = document.createElement('span');
				iconContainer.className = 'style-manager-theme-icon';
				setIcon(iconContainer, 'palette');
				nameEl.prepend(iconContainer);
			} else if (isAppearance) {
				const iconContainer = document.createElement('span');
				iconContainer.className = 'style-manager-appearance-icon';
				const appearance = section.value;
				setIcon(iconContainer, appearance === 'dark' ? 'moon' : 'sun');
				nameEl.prepend(iconContainer);
			} else if (isAccent) {
				const iconContainer = document.createElement('span');
				iconContainer.className = 'style-manager-accent-icon';
				iconContainer.style.setProperty(
					'--sm-icon-dynamic-color',
					(section.value as string) || ''
				);
				setIcon(iconContainer, 'paint-bucket');
				nameEl.prepend(iconContainer);
			} else if (isSnippets) {
				const iconContainer = document.createElement('span');
				iconContainer.className = 'style-manager-snippets-icon';
				setIcon(iconContainer, 'file-code');
				nameEl.prepend(iconContainer);
			}

			const badgesContainer = textContainer.createDiv(
				'style-manager-badge-container'
			);

			// Identity Badges (Consistent with CreatePresetModal)
			if (isTheme || isAppearance || isAccent || isSnippets) {
				if (isTheme) {
					renderThemeBadge(
						badgesContainer,
						section.value as string,
						section.accentColor
					);
				} else if (isAppearance) {
					renderAppearanceBadge(badgesContainer, section.value as string);
				} else if (isAccent) {
					renderAccentBadge(badgesContainer, section.value as string);
				} else if (isSnippets) {
					renderSnippetBadge(badgesContainer, this.plugin, section.value);
				}

				item.onclick = (e: MouseEvent): void => {
					if (e.target !== checkbox) checkbox.click();
				};
				return;
			}

			// Traditional Row Badges
			if (section.isActive) {
				badgesContainer.createSpan({
					cls: 'style-manager-badge-secondary active',
					text: 'ACTIVE',
				});
			} else {
				badgesContainer.createSpan({
					cls: 'style-manager-badge-secondary inactive',
					text: 'INACTIVE',
				});
			}

			badgesContainer.createSpan({
				cls: 'style-manager-badge-primary count',
				text: `${section.count}`,
			});

			item.onclick = (e: MouseEvent): void => {
				if (e.target !== checkbox) checkbox.click();
			};
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

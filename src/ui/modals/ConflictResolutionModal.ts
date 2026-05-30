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
	App,
	ButtonComponent,
	DropdownComponent,
	Modal,
	Setting,
} from 'obsidian';

export interface ConflictItem {
	name: string;
	type: 'snippet' | 'theme';
}

export interface ConflictAction {
	name: string;
	type: 'snippet' | 'theme';
	action: 'rename' | 'overwrite' | 'skip';
	newName?: string;
}

/**
 * Modal to resolve filename conflicts for CSS snippets and themes during import.
 */
export class ConflictResolutionModal extends Modal {
	private resolutions: Record<string, ConflictAction> = {};
	private updaters: ((action: 'rename' | 'overwrite' | 'skip') => void)[] = [];

	constructor(
		app: App,
		private conflicts: ConflictItem[],
		private onComplete: (actions: ConflictAction[]) => void
	) {
		super(app);
		// Initialize default resolutions to rename with a suffix
		conflicts.forEach((item) => {
			this.resolutions[item.name] = {
				name: item.name,
				type: item.type,
				action: 'rename',
				newName: `${item.name}-imported`,
			};
		});
	}

	private applyBulkAction(action: 'rename' | 'overwrite' | 'skip'): void {
		this.updaters.forEach((updater) => updater(action));
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-conflict-modal');

		contentEl.createEl('h2', {
			text: 'Import Conflicts',
			cls: 'style-manager-modal-title',
		});
		contentEl.createEl('p', {
			text: 'The following snippets or themes already exist in your vault. Choose how to handle each one.',
			cls: 'style-manager-modal-description',
		});
		const bulkActionContainer = contentEl.createDiv();
		bulkActionContainer.style.display = 'flex';
		bulkActionContainer.style.gap = '8px';
		bulkActionContainer.style.marginBottom = '12px';

		new ButtonComponent(bulkActionContainer)
			.setButtonText('Rename all')
			.onClick(() => this.applyBulkAction('rename'));

		new ButtonComponent(bulkActionContainer)
			.setButtonText('Overwrite all')
			.onClick(() => this.applyBulkAction('overwrite'));

		new ButtonComponent(bulkActionContainer)
			.setButtonText('Skip all')
			.onClick(() => this.applyBulkAction('skip'));

		const scrollContainer = contentEl.createDiv(
			'style-manager-conflict-scroll'
		);

		this.updaters = [];

		this.conflicts.forEach((item) => {
			const resolution = this.resolutions[item.name];

			const container = scrollContainer.createDiv(
				'style-manager-conflict-item'
			);

			const typeLabel = item.type === 'theme' ? ' (Theme)' : ' (Snippet)';
			const placeholderText =
				item.type === 'theme'
					? 'Enter new theme name...'
					: 'Enter new snippet name...';

			let dropComponent: DropdownComponent;

			new Setting(container)
				.setName(`${item.name}${typeLabel}`)
				.setClass('style-manager-conflict-row')
				.addDropdown((drop) => {
					dropComponent = drop;
					drop
						.addOption('rename', 'Rename')
						.addOption('overwrite', 'Overwrite')
						.addOption('skip', 'Skip')
						.setValue('rename')
						.onChange((val: string) => {
							resolution.action = val as 'rename' | 'overwrite' | 'skip';
							renameInputRow.settingEl.toggleClass(
								'style-manager-hidden',
								val !== 'rename'
							);
						});
				});

			const renameInputRow = new Setting(container)
				.setName('New Name')
				.setClass('style-manager-conflict-rename-row')
				.addText((text) => {
					text
						.setValue(resolution.newName || '')
						.setPlaceholder(placeholderText)
						.onChange((val) => {
							resolution.newName = val;
						});
					text.inputEl.addClass('style-manager-conflict-input');
				});

			this.updaters.push((action) => {
				dropComponent.setValue(action);
				resolution.action = action;
				renameInputRow.settingEl.toggleClass(
					'style-manager-hidden',
					action !== 'rename'
				);
			});

			// Initial state (visible if 'rename' is the default)
			renameInputRow.settingEl.removeClass('style-manager-hidden');
		});

		const buttonSetting = new Setting(contentEl).setClass(
			'style-manager-modal-buttons'
		);

		buttonSetting.addButton((btn) =>
			btn.setButtonText('Cancel Import').onClick(() => this.close())
		);

		buttonSetting.addButton((btn) => {
			btn
				.setButtonText('Finish Import')
				.setCta()
				.onClick(() => {
					this.onComplete(Object.values(this.resolutions));
					this.close();
				});
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

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
import { App, Modal, Setting } from 'obsidian';

export class RenameModal extends Modal {
	title: string;
	newName: string;
	onSubmit: (newName: string) => void;

	constructor(
		app: App,
		title: string,
		defaultName: string,
		onSubmit: (newName: string) => void
	) {
		super(app);
		this.title = title;
		this.newName = defaultName;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('modal-style-manager');
		contentEl.createEl('h2', {
			text: this.title,
			cls: 'style-manager-modal-title',
		});

		new Setting(contentEl)
			.setClass('style-manager-modal-setting')
			.setName('New Name')
			.addText((text) => {
				text.setValue(this.newName);
				text.inputEl.addClass('style-manager-modal-input');
				text.onChange((val) => (this.newName = val));
				text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
					if (e.key === 'Enter') {
						this.onSubmit(this.newName);
						this.close();
					}
				});
			});

		new Setting(contentEl)
			.setClass('style-manager-modal-buttons')
			.addButton((btn) =>
				btn
					.setButtonText('Save')
					.setCta()
					.onClick(() => {
						this.onSubmit(this.newName);
						this.close();
					})
			);
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

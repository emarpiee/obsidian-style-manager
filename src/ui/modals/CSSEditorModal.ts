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
import { App, Modal, TextComponent } from 'obsidian';

import StyleManagerPlugin from '../../main';
import { CSSEditor } from '../components/CSSEditor';

export class CSSEditorModal extends Modal {
	private editor: CSSEditor;
	private newName: string = '';

	constructor(
		app: App,
		private plugin: StyleManagerPlugin,
		private source: { type: string; id: string; readOnly?: boolean },
		private onSaveSuccess?: (newName: string) => void
	) {
		super(app);
		this.editor = new CSSEditor();
	}

	async onOpen(): Promise<void> {
		const { contentEl, modalEl } = this;
		modalEl.addClass('style-manager-plugin');
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-editor-modal');
		this.newName = this.source.id;

		this.titleEl.empty();
		this.titleEl.addClass('style-manager-editor-title-container');

		this.titleEl.createSpan({
			text: `${this.source.readOnly ? 'Viewing' : 'Editing'}: `,
			cls: 'style-manager-editor-title-prefix',
		});

		const nameInput = new TextComponent(this.titleEl)
			.setValue(this.newName)
			.setPlaceholder('name')
			.onChange((val) => {
				this.newName = val.trim();
				this.editor.newName = this.newName;
			});

		nameInput.inputEl.addClass('style-manager-editor-title-input');
		// Ensure the input has enough space to show the name
		nameInput.inputEl.setAttribute(
			'size',
			Math.max(this.newName.length, 10).toString()
		);

		if (this.source.type !== 'Snippet') {
			nameInput.setDisabled(true);
			nameInput.inputEl.addClass('style-manager-editor-disabled-input');
		}

		nameInput.inputEl.addEventListener('keydown', (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault();
				this.editor.handleSave();
			}
		});

		await this.editor.render(contentEl, {
			plugin: this.plugin,
			source: this.source,
			isView: false,
			onOpenInTab: () => this.close(),
			onClose: () => this.close(),
			onSaveSuccess: this.onSaveSuccess,
		});
	}

	onClose(): void {
		this.editor.destroy();
		this.contentEl.empty();
	}
}

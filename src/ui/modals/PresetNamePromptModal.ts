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
import { App, Modal } from 'obsidian';

export class PresetNamePromptModal extends Modal {
	resolve: (value: string | null) => void;
	value: string | null = null;
	resolved = false;

	constructor(app: App, resolve: (value: string | null) => void) {
		super(app);
		this.resolve = resolve;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl('h3', {
			text: 'Save as Preset',
			cls: 'style-manager-modal-title',
		});
		contentEl.createEl('p', {
			text: 'Enter a name for this preset:',
			cls: 'style-manager-modal-description',
		});

		const input = contentEl.createEl('input', {
			type: 'text',
			placeholder: 'Preset name...',
			cls: 'style-manager-modal-input',
		});
		input.style.width = '100%';
		input.style.marginBottom = '20px';

		const btnBar = contentEl.createDiv({ cls: 'style-manager-export-btn-bar' });
		const saveBtn = btnBar.createEl('button', { text: 'Save', cls: 'mod-cta' });
		const cancelBtn = btnBar.createEl('button', { text: 'Cancel' });

		const submit = (): void => {
			const name = input.value.trim();
			if (name) {
				this.value = name;
				this.close();
			}
		};

		saveBtn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			submit();
		});

		cancelBtn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.close();
		});

		// Use Obsidian's scope for reliable key handling in modals
		this.scope.register([], 'Enter', (e) => {
			e.preventDefault();
			e.stopPropagation();
			submit();
			return false;
		});

		this.scope.register([], 'Escape', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.close();
			return false;
		});

		// Focus the input after a short delay to ensure it catches focus
		setTimeout(() => input.focus(), 10);
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.resolved) {
			this.resolved = true;
			this.resolve(this.value);
		}
	}
}

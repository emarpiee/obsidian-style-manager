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
import { App, Menu, Modal, Notice, Setting } from 'obsidian';

import StyleManagerPlugin from '../../main';
import { Preset } from '../../types';
import { addApplyOptionsToMenu } from '../tabs/preset/PresetMenuHelper';

export class PresetPreviewModal extends Modal {
	constructor(
		app: App,
		private plugin: StyleManagerPlugin,
		public preset: Preset
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-preview-modal');

		this.setTitle(`Viewing preset: ${this.preset.name}`);

		const pre = contentEl.createEl('pre', { cls: 'style-manager-modal-pre' });
		pre.setText(JSON.stringify(this.preset.data, null, 2));

		new Setting(contentEl)
			.setClass('style-manager-modal-buttons')
			.addButton((btn) =>
				btn.setButtonText('Copy to clipboard').onClick(async () => {
					await navigator.clipboard.writeText(
						JSON.stringify(this.preset.data, null, 2)
					);
					new Notice('Settings copied to clipboard!');
				})
			)
			.addButton((btn) =>
				btn
					.setButtonText('Apply')
					.setCta()
					.onClick((e: MouseEvent | KeyboardEvent) => {
						const menu = new Menu();

						addApplyOptionsToMenu(menu, this.plugin, this.preset, {
							onApplied: () => this.close(),
						});

						if (e instanceof MouseEvent) {
							menu.showAtMouseEvent(e);
						} else {
							const rect = (e.target as HTMLElement).getBoundingClientRect();
							menu.showAtPosition({ x: rect.left, y: rect.bottom });
						}
					})
			)
			.addButton((btn) =>
				btn.setButtonText('Close').onClick(() => {
					this.close();
				})
			);
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

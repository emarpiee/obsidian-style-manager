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
import Pickr from '@simonwep/pickr';
import { App, Modal } from 'obsidian';

import { getPickrSettings, onPickrCancel } from '../../utils/UIUtils';

export class BoxOutlineColorPromptModal extends Modal {
	resolve: (value: string | null) => void;
	value: string | null = null;
	resolved = false;
	pickr: Pickr | null = null;

	constructor(
		app: App,
		initialColor: string,
		resolve: (value: string | null) => void
	) {
		super(app);
		this.resolve = resolve;
		this.value = initialColor;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('style-manager-plugin');
		modalEl.addClass('modal-style-manager');
		this.setTitle('Box outline color');

		contentEl.createEl('p', {
			text: 'Choose the color for the box outlines:',
			cls: 'style-manager-modal-description',
		});

		const wrapper = contentEl.createDiv({
			cls: 'style-manager-color-picker-wrapper',
		});
		const pickrEl = wrapper.createDiv({ cls: 'pickr-reset' });

		this.pickr = Pickr.create(
			getPickrSettings({
				isView: false,
				el: pickrEl,
				containerEl: contentEl,
				swatches: [],
				opacity: true,
				defaultColor: this.value ?? 'red',
			})
		);

		this.pickr.on('save', (color: Pickr.HSVaColor | null, _instance: Pickr) => {
			if (color) {
				this.value = color.toHEXA().toString();
				this.close();
			}
		});

		this.pickr.on('cancel', () => onPickrCancel(this.pickr!));
	}

	onClose(): void {
		if (this.pickr) {
			this.pickr.destroyAndRemove();
			this.pickr = null;
		}
		this.contentEl.empty();
		if (!this.resolved) {
			this.resolved = true;
			this.resolve(this.value);
		}
	}
}

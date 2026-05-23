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

export class ConfirmModal extends Modal {
	title: string;
	message: string;
	onConfirm: () => void;
	ctaText: string;
	isWarning: boolean;
	secondaryCtaText?: string;
	onSecondaryConfirm?: () => void;

	constructor(
		app: App,
		title: string,
		message: string,
		ctaText: string,
		isWarning: boolean,
		onConfirm: () => void,
		secondaryCtaText?: string,
		onSecondaryConfirm?: () => void
	) {
		super(app);
		this.title = title;
		this.message = message;
		this.onConfirm = onConfirm;
		this.ctaText = ctaText;
		this.isWarning = isWarning;
		this.secondaryCtaText = secondaryCtaText;
		this.onSecondaryConfirm = onSecondaryConfirm;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-confirm-modal');

		contentEl.createEl('h2', {
			text: this.title,
			cls: 'style-manager-modal-title',
		});
		contentEl.createEl('p', {
			text: this.message,
			cls: 'style-manager-modal-description',
		});

		const buttonSetting = new Setting(contentEl).setClass(
			'style-manager-modal-buttons'
		);

		buttonSetting.addButton((btn) =>
			btn.setButtonText('Cancel').onClick(() => this.close())
		);

		if (this.secondaryCtaText && this.onSecondaryConfirm) {
			buttonSetting.addButton((btn) => {
				btn.setButtonText(this.secondaryCtaText);
				btn.onClick(() => {
					this.onSecondaryConfirm?.();
					this.close();
				});
			});
		}

		buttonSetting.addButton((btn) => {
			btn.setButtonText(this.ctaText);
			if (this.isWarning) {
				btn.setWarning();
			} else {
				btn.setCta();
			}
			btn.onClick(() => {
				this.onConfirm();
				this.close();
			});
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

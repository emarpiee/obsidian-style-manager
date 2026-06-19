import { App, Modal, Setting } from 'obsidian';

import {
	Validators,
	applyInvalidState,
	clearInvalidState,
} from '../../utils/ValidationUtils';

export class RenameModal extends Modal {
	title: string;
	newName: string;
	onSubmit: (newName: string) => void;
	private inputEl: HTMLElement | null = null;

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
		modalEl.addClass('style-manager-plugin');
		modalEl.addClass('modal-style-manager');
		this.setTitle(this.title);

		new Setting(contentEl)
			.setClass('style-manager-modal-input-container')
			.addText((text) => {
				text.setValue(this.newName);
				text.inputEl.addClass('style-manager-modal-input');
				text.onChange((val) => {
					this.newName = val;
					const error = Validators.required(val);
					if (error) {
						applyInvalidState(text.inputEl, error);
					} else {
						clearInvalidState(text.inputEl);
					}
				});
				text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
					if (e.key === 'Enter') {
						this.handleSave();
					}
				});
				this.inputEl = text.inputEl;
			});

		new Setting(contentEl)
			.setClass('style-manager-modal-buttons')
			.addButton((btn) =>
				btn.setButtonText('Cancel').onClick(() => this.close())
			)
			.addButton((btn) =>
				btn
					.setButtonText('Save')
					.setCta()
					.onClick(() => this.handleSave())
			);
	}

	private handleSave(): void {
		if (!this.inputEl) return;

		const error = Validators.required(this.newName);
		if (error) {
			applyInvalidState(this.inputEl, error);
			return;
		}
		this.onSubmit(this.newName);
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

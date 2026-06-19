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
		modalEl.addClass('style-manager-plugin');
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-confirm-modal');

		this.setTitle(this.title);
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

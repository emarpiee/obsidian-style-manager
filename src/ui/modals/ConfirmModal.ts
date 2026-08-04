import { App, Modal, Setting } from 'obsidian';

export class ConfirmModal extends Modal {
	title: string;
	message: string;
	onConfirm: () => void;
	ctaText: string;
	isWarning: boolean;
	secondaryCtaText?: string;
	onSecondaryConfirm?: () => void;
	listItems?: string[];

	constructor(
		app: App,
		title: string,
		message: string,
		ctaText: string,
		isWarning: boolean,
		onConfirm: () => void,
		secondaryCtaText?: string,
		onSecondaryConfirm?: () => void,
		listItems?: string[]
	) {
		super(app);
		this.title = title;
		this.message = message;
		this.onConfirm = onConfirm;
		this.ctaText = ctaText;
		this.isWarning = isWarning;
		this.secondaryCtaText = secondaryCtaText;
		this.onSecondaryConfirm = onSecondaryConfirm;
		this.listItems = listItems;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('style-manager-plugin');
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-confirm-modal');

		this.setTitle(this.title);
		const descEl = contentEl.createEl('p', {
			cls: 'style-manager-modal-description',
		});
		descEl.style.whiteSpace = 'pre-wrap';
		descEl.textContent = this.message;

		if (this.listItems && this.listItems.length > 0) {
			const pre = contentEl.createEl('pre', { cls: 'style-manager-modal-pre' });
			pre.setText(this.listItems.join('\n'));
		}

		const buttonSetting = new Setting(contentEl).setClass(
			'style-manager-modal-buttons'
		);

		// 1. Primary CTA (e.g. "Discard Changes") — leftmost
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

		// 2. Cancel — middle
		buttonSetting.addButton((btn) =>
			btn.setButtonText('Cancel').onClick(() => this.close())
		);

		// 3. Secondary CTA (e.g. "Save") — rightmost
		if (this.secondaryCtaText && this.onSecondaryConfirm) {
			buttonSetting.addButton((btn) => {
				btn.setButtonText(this.secondaryCtaText);
				btn.setCta();
				btn.onClick(() => {
					this.onSecondaryConfirm?.();
					this.close();
				});
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

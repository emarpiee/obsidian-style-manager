import { App, Modal, Setting } from 'obsidian';

export type SnippetOpenMode = 'modal' | 'tab' | 'default-app' | 'none';

/**
 * Prompts the user to choose how to open a newly created snippet file.
 */
export class SnippetOpenModeModal extends Modal {
	private onChoose: (mode: SnippetOpenMode) => void;

	constructor(app: App, onChoose: (mode: SnippetOpenMode) => void) {
		super(app);
		this.onChoose = onChoose;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('style-manager-plugin');
		modalEl.addClass('modal-style-manager');

		this.setTitle('Open snippet in…');

		contentEl.createEl('p', {
			cls: 'style-manager-modal-description',
			text: 'How would you like to open the newly created snippet?',
		});

		const buttons = new Setting(contentEl).setClass(
			'style-manager-modal-buttons'
		);

		buttons.addButton((btn) => {
			btn.setButtonText("Don't open").onClick(() => {
				this.onChoose('none');
				this.close();
			});
		});

		buttons.addButton((btn) => {
			btn.setButtonText('Tab view').onClick(() => {
				this.onChoose('tab');
				this.close();
			});
		});

		buttons.addButton((btn) => {
			btn.setButtonText('Default app').onClick(() => {
				this.onChoose('default-app');
				this.close();
			});
		});

		buttons.addButton((btn) => {
			btn.setButtonText('Modal')
				.setCta()
				.onClick(() => {
					this.onChoose('modal');
					this.close();
				});
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

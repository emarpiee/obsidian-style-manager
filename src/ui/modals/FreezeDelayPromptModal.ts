import { App, Modal, Setting } from 'obsidian';

import {
	applyInvalidState,
	clearInvalidState,
} from '../../utils/ValidationUtils';

export class FreezeDelayPromptModal extends Modal {
	resolve: (value: number | null) => void;
	value: number | null = null;
	resolved = false;

	constructor(app: App, resolve: (value: number | null) => void) {
		super(app);
		this.resolve = resolve;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('style-manager-plugin');
		modalEl.addClass('modal-style-manager');
		this.setTitle('Freeze Obsidian delay');
		contentEl.createEl('p', {
			text: 'Enter the delay in seconds before Obsidian freezes:',
			cls: 'style-manager-modal-description',
		});

		const input = contentEl.createEl('input', {
			type: 'number',
			placeholder: '4',
			cls: 'style-manager-modal-input',
		});
		input.step = '0.1';

		const validate = (): string | null => {
			const val = parseFloat(input.value);
			if (isNaN(val)) return 'Please enter a valid number';
			if (val <= 0) return 'Delay must be a positive number';
			return null;
		};

		input.oninput = (): void => {
			const error = validate();
			if (error) {
				applyInvalidState(input, error);
			} else {
				clearInvalidState(input);
			}
		};

		const submit = (): void => {
			const error = validate();
			if (error) {
				applyInvalidState(input, error);
				return;
			}
			const val = parseFloat(input.value);
			if (!isNaN(val)) {
				this.value = val;
				this.close();
			}
		};

		new Setting(contentEl)
			.setClass('style-manager-modal-buttons')
			.addButton((btn) =>
				btn.setButtonText('Cancel').onClick(() => this.close())
			)
			.addButton((btn) => btn.setButtonText('Save').setCta().onClick(submit));

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

		window.setTimeout(() => input.focus(), 10);
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.resolved) {
			this.resolved = true;
			this.resolve(this.value);
		}
	}
}

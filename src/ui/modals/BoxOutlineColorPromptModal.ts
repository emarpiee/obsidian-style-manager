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

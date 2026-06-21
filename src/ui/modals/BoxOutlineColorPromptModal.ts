import ColorPicker from '../../lib/colorpicker/colorpicker.min.js';
import { App, Modal } from 'obsidian';

import { getColorPickerConfig } from '../../utils/ColorUtils';

export class BoxOutlineColorPromptModal extends Modal {
	resolve: (value: string | null) => void;
	value: string | null = null;
	resolved = false;
	pickr: ColorPicker | null = null;

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
		const pickrToggle = wrapper.createEl('button', { cls: 'color-picker-reset' });

		this.pickr = new ColorPicker(
			pickrToggle,
			getColorPickerConfig({
				isView: false,
				container: contentEl,
				opacity: true,
				defaultColor: this.value ?? 'red',
			})
		);

		this.pickr.on('pick', (color) => {
			if (color) {
				this.value = color.string('hex').toUpperCase();
				this.close();
			}
		});
	}

	onClose(): void {
		if (this.pickr) {
			this.pickr.destroy();
			this.pickr = null;
		}
		this.contentEl.empty();
		if (!this.resolved) {
			this.resolved = true;
			this.resolve(this.value);
		}
	}
}

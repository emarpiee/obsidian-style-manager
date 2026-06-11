import { App, Modal } from 'obsidian';

import StyleManagerPlugin from '../../main';
import { ColorContrastChecker } from '../components/ColorContrastChecker';

export class ColorContrastCheckerModal extends Modal {
	private checker: ColorContrastChecker;

	constructor(
		app: App,
		private plugin: StyleManagerPlugin
	) {
		super(app);
		this.checker = new ColorContrastChecker();
	}

	onOpen(): void {
		this.titleEl.setText('Color contrast checker');
		this.checker.render(this.contentEl, {
			plugin: this.plugin,
			onOpenInTab: () => this.close(),
		});
	}

	onClose(): void {
		this.checker.destroy();
		this.contentEl.empty();
	}
}

import { App, Modal } from 'obsidian';

import StyleManagerPlugin from '../../main';
import { LoremIpsumGenerator } from '../components/LoremIpsumGenerator';

export class LoremIpsumModal extends Modal {
	private generator: LoremIpsumGenerator;

	constructor(
		app: App,
		private plugin: StyleManagerPlugin
	) {
		super(app);
		this.generator = new LoremIpsumGenerator();
	}

	onOpen(): void {
		this.titleEl.setText('Lorem ipsum generator');
		this.generator.render(this.contentEl, {
			plugin: this.plugin,
			onOpenInTab: () => this.close(),
		});
	}

	onClose(): void {
		this.generator.destroy();
		this.contentEl.empty();
	}
}

import { App, Component, Modal } from 'obsidian';

import StyleManagerPlugin from '../../main';
import { ReadmeComponent } from '../components/ReadmeComponent';

export class ReadmeModal extends Modal {
	private component: ReadmeComponent;

	constructor(
		app: App,
		private plugin: StyleManagerPlugin
	) {
		super(app);
		this.component = new ReadmeComponent();
	}

	async onOpen(): Promise<void> {
		this.modalEl.addClass('modal-style-manager');
		this.modalEl.addClass('style-manager-readme-modal');
		this.titleEl.setText('Style Manager README');
		await this.component.render(this.contentEl, {
			plugin: this.plugin,
			onOpenInTab: () => this.close(),
			component: this as unknown as Component,
		});
	}

	onClose(): void {
		this.component.destroy();
		this.contentEl.empty();
	}
}

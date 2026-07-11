import { Component, MarkdownRenderer, setIcon, setTooltip } from 'obsidian';

import StyleManagerPlugin from '../../main';
import { README_CONTENT } from '../views/ReadmeContent';

interface RenderOptions {
	plugin?: StyleManagerPlugin;
	onOpenInTab?: () => void;
	component?: Component;
	isModal?: boolean;
}

export class ReadmeComponent {
	private container: HTMLElement;

	async render(
		container: HTMLElement,
		options: RenderOptions = {}
	): Promise<void> {
		const { plugin, onOpenInTab, component, isModal } = options;
		this.container = container;
		this.container.empty();
		this.container.addClass('markdown-preview-view');
		if (!isModal) {
			this.container.addClass('is-readable-line-width');
		}

		const sizer = this.container.createDiv({ cls: 'markdown-preview-sizer' });
		const renderEl = sizer.createDiv({ cls: 'markdown-rendered' });

		if (plugin) {
			const openInTabBtn = sizer.createDiv({
				cls: 'clickable-icon',
			});
			setIcon(openInTabBtn, 'external-link');
			setTooltip(openInTabBtn, 'Open this tool in a tab');
			openInTabBtn.onclick = async (): Promise<void> => {
				await plugin.activateReadmeView();
				if (onOpenInTab) {
					onOpenInTab();
				}
			};
		}

		const app = plugin?.app;
		if (app) {
			await MarkdownRenderer.render(
				app,
				README_CONTENT,
				renderEl,
				app.workspace.getActiveFile()?.path || '',
				component || (plugin) || new Component()
			);
		}
	}

	destroy(): void {
		this.container.empty();
	}
}

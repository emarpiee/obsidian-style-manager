/*
    Style Manager - Obsidian Plugin
    Copyright (c) 2023 mgmeyers
    Copyright (c) 2026 emarpiee

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
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

	async render(container: HTMLElement, options: RenderOptions = {}): Promise<void> {
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

		await MarkdownRenderer.renderMarkdown(
			README_CONTENT,
			renderEl,
			plugin?.app.workspace.getActiveFile()?.path || '',
			component || (plugin?.app.workspace.getActiveFile() as unknown as Component) || {} as Component
		);
	}

	destroy(): void {
		this.container.empty();
	}
}

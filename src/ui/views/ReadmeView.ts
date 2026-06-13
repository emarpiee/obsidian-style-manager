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
import { ItemView, MarkdownRenderer, WorkspaceLeaf } from 'obsidian';

import { README_CONTENT } from './ReadmeContent';

export const readmeViewType = 'style-manager-readme-view';

export class ReadmeView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	async onload(): Promise<void> {
		this.contentEl.addClass('markdown-preview-view');
		this.contentEl.addClass('is-readable-line-width');
		const sizer = this.contentEl.createDiv({ cls: 'markdown-preview-sizer' });
		const renderEl = sizer.createDiv({ cls: 'markdown-rendered' });
		await MarkdownRenderer.renderMarkdown(
			README_CONTENT,
			renderEl,
			this.app.workspace.getActiveFile()?.path || '',
			this
		);
	}

	onunload(): void {
		this.contentEl.empty();
	}

	getViewType(): string {
		return readmeViewType;
	}

	getIcon(): string {
		return 'info';
	}

	getDisplayText(): string {
		return 'Style Manager README';
	}
}

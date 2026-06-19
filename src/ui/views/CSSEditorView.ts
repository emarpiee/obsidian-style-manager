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
import { ItemView, ViewStateResult, WorkspaceLeaf } from 'obsidian';

import StyleManagerPlugin from '../../main';
import { CSSEditor } from '../components/CSSEditor';

export const cssEditorViewType = 'style-manager-css-editor-view';

export interface CSSEditorViewState {
	source: { type: string; id: string; readOnly?: boolean };
}

export class CSSEditorView extends ItemView {
	private editor: CSSEditor;
	private source: { type: string; id: string; readOnly?: boolean } | null = null;
	private plugin: StyleManagerPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: StyleManagerPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.editor = new CSSEditor();
	}

	async setState(state: Record<string, unknown>, result: ViewStateResult): Promise<void> {
		super.setState(state, result);

		if (state && state.source) {
			this.source = state.source as { type: string; id: string; readOnly?: boolean };
			this.contentEl.empty();
			this.contentEl.addClass('style-manager-editor-view');
			
			await this.editor.render(this.contentEl, {
				plugin: this.plugin,
				source: this.source!,
				isView: true,
			});
		}
	}

	getState(): Record<string, unknown> {
		const state = (super.getState() as Record<string, unknown>) || {};
		if (this.source) {
			state.source = this.source;
		}
		return state;
	}

	onload(): void {
		// Rendering happens in setState when source is available
	}

	onunload(): void {
		this.editor.destroy();
		this.contentEl.empty();
	}

	getViewType(): string {
		return cssEditorViewType;
	}

	getIcon(): string {
		return 'code'; // You can use a more appropriate icon if needed
	}

	getDisplayText(): string {
		if (this.source) {
			return `Editing: ${this.source.id}`;
		}
		return 'CSS Editor';
	}
}

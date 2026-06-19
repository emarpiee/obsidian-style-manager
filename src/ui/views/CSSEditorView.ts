import { ItemView, ViewStateResult, WorkspaceLeaf } from 'obsidian';

import StyleManagerPlugin from '../../main';
import { CSSEditor } from '../components/CSSEditor';

export const cssEditorViewType = 'style-manager-css-editor-view';

export interface CSSEditorViewState {
	source: { type: string; id: string; readOnly?: boolean };
}

export class CSSEditorView extends ItemView {
	private editor: CSSEditor;
	private source: { type: string; id: string; readOnly?: boolean } | null =
		null;
	private plugin: StyleManagerPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: StyleManagerPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.editor = new CSSEditor();
	}

	async setState(
		state: Record<string, unknown>,
		result: ViewStateResult
	): Promise<void> {
		super.setState(state, result);

		if (state && state.source) {
			this.source = state.source as {
				type: string;
				id: string;
				readOnly?: boolean;
			};
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

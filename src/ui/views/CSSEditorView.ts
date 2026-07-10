import { ItemView, ViewStateResult, WorkspaceLeaf } from 'obsidian';

import StyleManagerPlugin from '../../main';
import { CSSEditor } from '../components/CSSEditor';
import { ConfirmModal } from '../modals/ConfirmModal';

export const cssEditorViewType = 'style-manager-css-editor-view';

export interface CSSEditorViewState {
	source: { type: string; id: string; readOnly?: boolean };
}

export class CSSEditorView extends ItemView {
	private editor: CSSEditor;
	private source: { type: string; id: string; readOnly?: boolean } | null =
		null;
	private plugin: StyleManagerPlugin;
	private actionElements: HTMLElement[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: StyleManagerPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.editor = new CSSEditor();
	}

	async setState(
		state: Record<string, unknown>,
		result: ViewStateResult
	): Promise<void> {
		// Set our internal state FIRST so getDisplayText() returns the right value
		if (state && state.source) {
			this.source = state.source as {
				type: string;
				id: string;
				readOnly?: boolean;
			};
		}

		// Let Obsidian handle its state updates
		await super.setState(state, result);

		// Now render the editor content
		if (this.source) {
			this.contentEl.empty();
			this.contentEl.addClass('style-manager-editor-view');

			for (const el of this.actionElements) {
				el.remove();
			}
			this.actionElements = [];

			await this.editor.render(this.contentEl, {
				plugin: this.plugin,
				source: this.source,
				isView: true,
				addAction: (icon, title, callback) => {
					const el = this.addAction(icon, title, callback);
					this.actionElements.push(el);
					return el;
				}
			});

			// Force update the tab title directly
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const leafAny = this.leaf as any;
			const newTitle = this.getDisplayText();

			if (leafAny.tabHeaderInnerTitleEl) {
				leafAny.tabHeaderInnerTitleEl.innerText = newTitle;
			}
			if (leafAny.tabHeaderTitleEl) {
				leafAny.tabHeaderTitleEl.innerText = newTitle;
			}
			// Update the header inside the view
			if (this.containerEl) {
				const headerTitle = this.containerEl.querySelector('.view-header-title');
				if (headerTitle) {
					headerTitle.textContent = newTitle;

					if (this.source.type === 'Snippet' && !this.source.readOnly) {
						// Clean up any old listeners by replacing the node
						const newHeaderTitle = headerTitle.cloneNode(true) as HTMLElement;
						headerTitle.parentNode?.replaceChild(newHeaderTitle, headerTitle);

						newHeaderTitle.setAttribute('contenteditable', 'true');
						newHeaderTitle.classList.add('style-manager-editor-title-input-tab-view');
						// Obsidian native titles usually have these styles applied dynamically or are inputs, 
						// but contenteditable on .view-header-title works great natively.

						newHeaderTitle.addEventListener('keydown', (e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								newHeaderTitle.blur();
							}
						});

						newHeaderTitle.addEventListener('blur', async () => {
							const newName = newHeaderTitle.textContent?.trim();
							// Only attempt rename if it changed and is not empty
							if (newName && newName !== this.source!.id) {
								try {
									await this.plugin.settingsService.snippetService.renameSnippet(
										this.source!.id,
										newName
									);
									this.source!.id = newName;
									
									// Update internal and external titles
									const updatedTitle = this.getDisplayText();
									if (leafAny.tabHeaderInnerTitleEl) leafAny.tabHeaderInnerTitleEl.innerText = updatedTitle;
									if (leafAny.tabHeaderTitleEl) leafAny.tabHeaderTitleEl.innerText = updatedTitle;
									newHeaderTitle.textContent = updatedTitle;
									
								} catch (err) {
									// Revert on failure
									newHeaderTitle.textContent = this.getDisplayText();
									this.plugin.settingsService.notifications.error(
										'Failed to rename snippet: ' + (err as Error).message
									);
								}
							} else {
								// Revert to original if empty or unchanged
								newHeaderTitle.textContent = this.getDisplayText();
							}
						});
					}
				}
			}
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
		// Monkey-patch leaf detach to warn about unsaved changes
		const originalDetach = this.leaf.detach.bind(this.leaf);
		this.leaf.detach = () => {
			if (this.editor && this.editor.isDirty()) {
				new ConfirmModal(
					this.plugin.app,
					'Unsaved Changes',
					'You have unsaved changes in this tab. Are you sure you want to close without saving?',
					'Discard Changes',
					true,
					() => {
						this.editor.resetDirty();
						originalDetach();
					},
					'Save',
					() => {
						this.editor.handleSave().then(() => {
							originalDetach();
						});
					}
				).open();
				return;
			}
			originalDetach();
		};
	}

	onunload(): void {
		this.editor.destroy();
		this.contentEl.empty();
	}

	getViewType(): string {
		return cssEditorViewType;
	}

	getIcon(): string {
		return 'code';
	}

	getDisplayText(): string {
		if (this.source) {
			return this.source.id;
		}
		return 'CSS Editor';
	}
}

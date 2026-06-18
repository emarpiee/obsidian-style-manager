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
import {
	autocompletion,
	closeBrackets,
	closeBracketsKeymap,
	completionKeymap,
} from '@codemirror/autocomplete';
import {
	defaultKeymap,
	history,
	historyKeymap,
	indentWithTab,
} from '@codemirror/commands';
import { css } from '@codemirror/lang-css';
import {
	bracketMatching,
	defaultHighlightStyle,
	foldGutter,
	foldKeymap,
	indentOnInput,
	indentUnit,
	syntaxHighlighting,
} from '@codemirror/language';
import { lintKeymap } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import {
	EditorView,
	KeyBinding,
	crosshairCursor,
	drawSelection,
	dropCursor,
	highlightActiveLine,
	highlightActiveLineGutter,
	highlightSpecialChars,
	keymap,
	lineNumbers,
	rectangularSelection,
} from '@codemirror/view';
import { Menu, Setting, setIcon, setTooltip } from 'obsidian';

import { EDITOR_TAB_SIZE_KEY, SNIPPETS_KEY } from '../../constants';
import StyleManagerPlugin from '../../main';
import { RefreshLevel } from '../../types';

export interface CSSEditorRenderOptions {
	plugin: StyleManagerPlugin;
	source: { type: string; id: string; readOnly?: boolean };
	isView?: boolean;
	onOpenInTab?: () => void;
	onClose?: () => void;
	onSaveSuccess?: (newName: string) => void;
}

export class CSSEditor {
	private view: EditorView | null = null;
	private content: string = '';
	public newName: string = '';
	private wrapCompartment = new Compartment();
	private isWrapping: boolean = true;
	private addBlockMenuDom: HTMLElement | null = null;
	private lastContextMenuTime: number = 0;
	private plugin: StyleManagerPlugin;
	private source: { type: string; id: string; readOnly?: boolean };
	private isViewMode: boolean = false;
	private container: HTMLElement;
	private onSaveSuccess?: (newName: string) => void;

	async render(container: HTMLElement, options: CSSEditorRenderOptions): Promise<void> {
		this.plugin = options.plugin;
		this.source = options.source;
		this.isViewMode = options.isView ?? false;
		this.onSaveSuccess = options.onSaveSuccess;
		this.container = container;

		this.newName = this.source.id;

		this.container.addClass('style-manager-editor-component');
		
		// Load content
		let path = '';
		const bridge = this.plugin.settingsService.bridge;

		if (this.source.type === 'Snippet') {
			path = bridge.getSnippetPath(this.source.id);
		} else if (this.source.type === 'Theme') {
			path = bridge.getThemePath(this.source.id);
		} else if (this.source.type === 'Plugin') {
			path = bridge.getPluginPath(this.source.id);
		} else {
			path = this.source.id; // fallback
		}

		try {
			this.content = await this.plugin.app.vault.adapter.read(path);
		} catch (_err) {
			this.plugin.settingsService.notifications.error(
				`Failed to read ${this.source.type} file.`
			);
			if (options.onClose) {
				options.onClose();
			}
			return;
		}

		const editorContainer = this.container.createDiv(
			'style-manager-editor-container'
		);

		// Support right-click context menu for adding blocks
		editorContainer.addEventListener('contextmenu', (e) => {
			if (
				(this.source.type === 'Snippet' || this.source.type === 'Theme') &&
				!this.source.readOnly
			) {
				const now = Date.now();
				const diff = now - this.lastContextMenuTime;
				this.lastContextMenuTime = now;

				if (
					this.addBlockMenuDom &&
					document.body.contains(this.addBlockMenuDom)
				) {
					this.addBlockMenuDom.remove();
					this.addBlockMenuDom = null;
				}

				if (diff < 500) {
					// Fast right-click: allow browser's default menu to open
					return;
				}

				e.preventDefault();
				this.showAddBlockMenu({ x: e.clientX, y: e.clientY });
			}
		});

		// Define save command
		const saveKeymap: KeyBinding[] = [
			{
				key: 'Mod-s',
				run: (): boolean => {
					this.handleSave();
					return true;
				},
			},
		];

		const tabSize =
			(this.plugin.settingsService.settings[EDITOR_TAB_SIZE_KEY] as number) ||
			4;

		// Setup CodeMirror 6
		this.view = new EditorView({
			state: EditorState.create({
				doc: this.content,
				extensions: [
					EditorState.tabSize.of(tabSize),
					indentUnit.of(' '.repeat(tabSize)),
					lineNumbers(),
					highlightActiveLineGutter(),
					highlightSpecialChars(),
					history(),
					foldGutter(),
					drawSelection(),
					dropCursor(),
					EditorState.allowMultipleSelections.of(true),
					indentOnInput(),
					syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
					bracketMatching(),
					closeBrackets(),
					autocompletion(),
					rectangularSelection(),
					crosshairCursor(),
					highlightActiveLine(),
					highlightSelectionMatches(),
					EditorState.readOnly.of(this.source.readOnly ?? false),
					this.wrapCompartment.of(EditorView.lineWrapping),
					css(),
					keymap.of([
						...closeBracketsKeymap,
						...defaultKeymap,
						...searchKeymap,
						...historyKeymap,
						...foldKeymap,
						...completionKeymap,
						...lintKeymap,
						...saveKeymap,
						indentWithTab,
					]),
					// Basic theme overrides to match Obsidian
					EditorView.theme(
						{
							'&': {
								height: '100%',
								minHeight: '0',
								fontSize: 'var(--font-ui-small)',
							},
							'.cm-scroller': {
								fontFamily: 'var(--font-monospace)',
								lineHeight: '1.6',
							},
							'&.cm-focused': {
								outline: 'none',
							},
						},
						{ dark: document.body.classList.contains('theme-dark') }
					),
				],
			}),
			parent: editorContainer,
		});

		const footer = this.container.createDiv('style-manager-editor-footer');

		const wrapBtnContainer = footer.createDiv(
			'style-manager-editor-wrap-container'
		);
		const wrapSetting = new Setting(wrapBtnContainer)
			.setClass('style-manager-editor-buttons')
			.addButton((btn) => {
				btn
					.setButtonText('Wrap')
					.setTooltip('Toggle line wrapping')
					.onClick(() => {
						this.isWrapping = !this.isWrapping;
						btn.buttonEl.toggleClass('is-active', this.isWrapping);
						if (this.view) {
							this.view.dispatch({
								effects: this.wrapCompartment.reconfigure(
									this.isWrapping ? EditorView.lineWrapping : []
								),
							});
						}
					});
				btn.buttonEl.toggleClass('is-active', this.isWrapping);
			})
			.addButton((btn) => {
				if (
					(this.source.type === 'Snippet' || this.source.type === 'Theme') &&
					!this.source.readOnly
				) {
					btn
						.setIcon('plus-with-circle')
						.setTooltip('Add block')
						.onClick((_e: MouseEvent) => {
							const rect = btn.buttonEl.getBoundingClientRect();
							this.showAddBlockMenu({ x: rect.right, y: rect.top });
						});
				} else {
					btn.buttonEl.addClass('style-manager-hidden');
				}
			});

		// Add "Open in Tab" button if a callback is provided
		if (options.onOpenInTab && !this.isViewMode) {
			const openInTabBtn = wrapSetting.controlEl.createDiv({
				cls: 'clickable-icon style-manager-editor-open-in-tab-btn',
			});
			setIcon(openInTabBtn, 'external-link');
			setTooltip(openInTabBtn, 'Open this tool in a tab');
			openInTabBtn.onclick = async (): Promise<void> => {
				await this.plugin.activateCSSEditorView(this.source);
				if (options.onOpenInTab) {
					options.onOpenInTab();
				}
			};
		}

		if (!this.isViewMode) {
			const mainBtns = footer.createDiv('style-manager-editor-buttons-main');
			const mainBtnsSetting = new Setting(mainBtns).setClass(
				'style-manager-editor-buttons'
			);

			if (this.source.readOnly) {
				mainBtnsSetting
					.addButton((btn) =>
						btn.setButtonText('Close').onClick(() => {
							if (options.onClose) options.onClose();
						})
					)
					.addButton((btn) =>
						btn
							.setButtonText('Copy to clipboard')
							.setCta()
							.onClick(() => {
								if (this.view) {
									const currentContent = this.view.state.doc.toString();
									navigator.clipboard.writeText(currentContent);
									this.plugin.settingsService.notifications.util(
										'Copied to clipboard'
									);
								}
								if (options.onClose) options.onClose();
							})
					);
			} else {
				if (this.source.type === 'Snippet') {
					const currentEnabled =
						(this.plugin.settingsService.settings[SNIPPETS_KEY] as string[]) ||
						[];
					const isEnabled = currentEnabled.includes(this.source.id);
					mainBtnsSetting.addToggle((toggle) => {
						toggle.setValue(isEnabled).onChange(async (value) => {
							const snippets = new Set(
								(this.plugin.settingsService.settings[
									SNIPPETS_KEY
								] as string[]) || []
							);
							if (value) snippets.add(this.source.id);
							else snippets.delete(this.source.id);

							const list = Array.from(snippets);
							await this.plugin.settingsService.setSetting(SNIPPETS_KEY, list, {
								silentUI: true,
							});
						});
					});
				}

				mainBtnsSetting.addButton((btn) =>
					btn
						.setButtonText('Save')
						.setCta()
						.onClick(() => this.handleSave())
				);
			}
		}
	}

	public async handleSave(): Promise<void> {
		if (!this.newName) {
			this.plugin.settingsService.notifications.error(
				'Snippet name cannot be empty.'
			);
			return;
		}

		if (!this.view) return;

		const currentContent = this.view.state.doc.toString();
		const { type, id } = this.source;
		const bridge = this.plugin.settingsService.bridge;

		try {
			if (type === 'Snippet') {
				if (this.newName !== id) {
					await this.plugin.settingsService.snippetService.renameSnippet(
						id,
						this.newName
					);
					this.source.id = this.newName; // Update source ID for subsequent saves
				}
				await this.plugin.settingsService.snippetService.writeSnippetContent(
					this.newName,
					currentContent
				);
			} else {
				const path =
					type === 'Theme'
						? bridge.getThemePath(id)
						: type === 'Plugin'
							? bridge.getPluginPath(id)
							: id;
				if (path) {
					await this.plugin.app.vault.adapter.write(path, currentContent);
					if (type === 'Theme') bridge.requestLoadTheme();
					this.plugin.settingsService.refreshService.trigger(
						RefreshLevel.PARSE_CSS
					);
				}
			}

			this.plugin.settingsService.notifications.snippet(
				`Saved ${type.toLowerCase()}: ${this.newName}`
			);
			if (this.onSaveSuccess) {
				this.onSaveSuccess(this.newName);
			}
		} catch (err) {
			console.error(`Failed to save ${type}:`, err);
			this.plugin.settingsService.notifications.error(
				`Failed to save ${type.toLowerCase()}.`
			);
		}
	}

	public destroy(): void {
		if (this.view) {
			this.view.destroy();
			this.view = null;
		}
		if (this.container) {
			this.container.empty();
		}
	}

	private showAddBlockMenu(position: { x: number; y: number }): void {
		const menu = new Menu();
		const dom = (menu as unknown as { dom: HTMLElement }).dom;
		dom.addClass('style-manager-add-block-menu');
		this.addBlockMenuDom = dom;

		const blocks = this.plugin.styleBlockService.getAvailableBlocks();

		// Render Meta group
		blocks
			.filter((b) => b.group === 'meta')
			.forEach((block) => {
				menu.addItem((item) =>
					item
						.setTitle(block.label)
						.setIcon(block.icon)
						.onClick(() => {
							this.addBlockMenuDom = null;
							if (this.view) {
								this.plugin.styleBlockService.injectBlock(this.view, block.id);
							}
						})
				);
			});

		menu.addSeparator();

		// Render Field group
		blocks
			.filter((b) => b.group === 'field')
			.forEach((block) => {
				menu.addItem((item) =>
					item
						.setTitle(block.label)
						.setIcon(block.icon)
						.onClick(() => {
							this.addBlockMenuDom = null;
							if (this.view) {
								this.plugin.styleBlockService.injectBlock(this.view, block.id);
							}
						})
				);
			});

		menu.showAtPosition(position);
	}
}

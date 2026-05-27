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
import { App, Menu, Modal, Setting, TextComponent } from 'obsidian';

import { EDITOR_TAB_SIZE_KEY } from '../../constants';
import StyleManagerPlugin from '../../main';
import { RefreshLevel } from '../../types';

export class CSSEditorModal extends Modal {
	private view: EditorView;
	private content: string = '';
	private newName: string = '';
	private wrapCompartment = new Compartment();
	private isWrapping: boolean = true;

	constructor(
		app: App,
		private plugin: StyleManagerPlugin,
		private source: { type: string; id: string; readOnly?: boolean },
		private onSaveSuccess?: (newName: string) => void
	) {
		super(app);
	}

	async onOpen(): Promise<void> {
		const { contentEl, modalEl } = this;
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-editor-modal');
		this.newName = this.source.id;

		this.titleEl.empty();
		this.titleEl.addClass('style-manager-editor-title-container');

		this.titleEl.createSpan({
			text: `${this.source.readOnly ? 'View' : 'Edit'} ${this.source.type}: `,
			cls: 'style-manager-editor-title-prefix',
		});

		const nameInput = new TextComponent(this.titleEl)
			.setValue(this.newName)
			.setPlaceholder('name')
			.onChange((val) => {
				this.newName = val.trim();
			});

		nameInput.inputEl.addClass('style-manager-editor-title-input');
		// Ensure the input has enough space to show the name
		nameInput.inputEl.setAttribute(
			'size',
			Math.max(this.newName.length, 10).toString()
		);

		if (this.source.type !== 'Snippet') {
			nameInput.setDisabled(true);
			nameInput.inputEl.addClass('style-manager-editor-disabled-input');
		}

		nameInput.inputEl.addEventListener('keydown', (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault();
				this.handleSave();
			}
		});

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
			this.content = await this.app.vault.adapter.read(path);
		} catch (_err) {
			this.plugin.settingsService.notifications.error(
				`Failed to read ${this.source.type} file.`
			);
			this.close();
			return;
		}

		const editorContainer = contentEl.createDiv(
			'style-manager-editor-container'
		);

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

		const footer = contentEl.createDiv('style-manager-editor-footer');

		const wrapBtnContainer = footer.createDiv(
			'style-manager-editor-wrap-container'
		);
		new Setting(wrapBtnContainer)
			.setClass('style-manager-editor-buttons')
			.addButton((btn) => {
				btn
					.setButtonText('Wrap')
					.setTooltip('Toggle Line Wrapping')
					.onClick(() => {
						this.isWrapping = !this.isWrapping;
						btn.buttonEl.toggleClass('is-active', this.isWrapping);
						this.view.dispatch({
							effects: this.wrapCompartment.reconfigure(
								this.isWrapping ? EditorView.lineWrapping : []
							),
						});
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
						.setTooltip('Add Block')
						.onClick((_e: MouseEvent) => {
							const menu = new Menu();
							(menu as unknown as { dom: HTMLElement }).dom.addClass(
								'style-manager-add-block-menu'
							);
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
												this.plugin.styleBlockService.injectBlock(
													this.view,
													block.id
												);
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
												this.plugin.styleBlockService.injectBlock(
													this.view,
													block.id
												);
											})
									);
								});

							const rect = btn.buttonEl.getBoundingClientRect();
							menu.showAtPosition({ x: rect.right, y: rect.top });
						});
				} else {
					btn.buttonEl.addClass('style-manager-hidden');
				}
			});

		const mainBtns = footer.createDiv('style-manager-editor-buttons-main');
		const mainBtnsSetting = new Setting(mainBtns).setClass(
			'style-manager-editor-buttons'
		);

		if (this.source.readOnly) {
			mainBtnsSetting
				.addButton((btn) =>
					btn
						.setButtonText('Copy to clipboard')
						.setCta()
						.onClick(() => {
							const currentContent = this.view.state.doc.toString();
							navigator.clipboard.writeText(currentContent);
							this.plugin.settingsService.notifications.util(
								'Copied to clipboard'
							);
							this.close();
						})
				)
				.addButton((btn) =>
					btn.setButtonText('Close').onClick(() => this.close())
				);
		} else {
			mainBtnsSetting
				.addButton((btn) =>
					btn.setButtonText('Cancel').onClick(() => this.close())
				)
				.addButton((btn) =>
					btn
						.setButtonText('Save')
						.setCta()
						.onClick(() => this.handleSave())
				);
		}
	}

	private async handleSave(): Promise<void> {
		if (!this.newName) {
			this.plugin.settingsService.notifications.error(
				'Snippet name cannot be empty.'
			);
			return;
		}

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
					await this.app.vault.adapter.write(path, currentContent);
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

	onClose(): void {
		if (this.view) {
			this.view.destroy();
		}
		const { contentEl } = this;
		contentEl.empty();
	}
}

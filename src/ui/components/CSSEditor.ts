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
	foldGutter,
	foldKeymap,
	indentOnInput,
	indentUnit,
	syntaxHighlighting,
	HighlightStyle
} from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { lintKeymap } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap, openSearchPanel } from '@codemirror/search';
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
import { Menu, Platform, setIcon, setTooltip, ButtonComponent, ToggleComponent } from 'obsidian';

import { PreferencesKeys, StorageKeys } from '../../constants';
import StyleManagerPlugin from '../../main';
import { RefreshLevel } from '../../types';
import { Logger } from '../../utils/Logger';

export interface CSSEditorRenderOptions {
	plugin: StyleManagerPlugin;
	source: { type: string; id: string; readOnly?: boolean };
	isView?: boolean;
	onOpenInTab?: () => void;
	onClose?: () => void;
	onSaveSuccess?: (newName: string) => void;
	addAction?: (icon: string, title: string, callback: (evt: MouseEvent) => void) => HTMLElement;
}

const obsidianHighlightStyle = HighlightStyle.define([
	{ tag: t.keyword, color: 'var(--code-keyword)' },
	{
		tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName],
		color: 'var(--code-property)',
	},
	{
		tag: [t.function(t.variableName), t.labelName],
		color: 'var(--code-function)',
	},
	{
		tag: [t.color, t.constant(t.name), t.standard(t.name)],
		color: 'var(--code-value)',
	},
	{
		tag: [t.definition(t.name), t.separator],
		color: 'var(--code-normal)',
	},
	{
		tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace],
		color: 'var(--code-value)',
	},
	{
		tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)],
		color: 'var(--code-operator)',
	},
	{ tag: [t.meta, t.comment], color: 'var(--code-comment)' },
	{ tag: t.strong, fontWeight: 'bold' },
	{ tag: t.emphasis, fontStyle: 'italic' },
	{ tag: t.strikethrough, textDecoration: 'line-through' },
	{ tag: t.link, color: 'var(--text-accent)', textDecoration: 'underline' },
	{ tag: t.heading, fontWeight: 'bold', color: 'var(--text-title)' },
	{
		tag: [t.atom, t.bool, t.special(t.variableName)],
		color: 'var(--code-value)',
	},
	{ tag: [t.processingInstruction, t.string, t.inserted], color: 'var(--code-string)' },
	{ tag: t.invalid, color: 'var(--text-error)' },
]);

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
	private snippetToggle: { setValue: (value: boolean) => void } | null = null;
	private settingsChangedHandler: (() => void) | null = null;
	private onSaveSuccess?: (newName: string) => void;

	async render(
		container: HTMLElement,
		options: CSSEditorRenderOptions
	): Promise<void> {
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
			const rawContent = await this.plugin.app.vault.adapter.read(path);
			this.content = rawContent.replace(/\r\n/g, '\n');
		} catch {
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
			if (Platform.isMobile) return;

			if (
				(this.source.type === 'Snippet' || this.source.type === 'Theme') &&
				!this.source.readOnly
			) {
				const now = Date.now();
				const diff = now - this.lastContextMenuTime;
				this.lastContextMenuTime = now;

				if (
					this.addBlockMenuDom &&
					activeDocument.body.contains(this.addBlockMenuDom)
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
					void this.handleSave();
					return true;
				},
			},
		];

		const tabSize =
			(this.plugin.settingsService.settings[
				PreferencesKeys.EDITOR_TAB_SIZE
			] as number) || 4;

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
					syntaxHighlighting(obsidianHighlightStyle, { fallback: true }),
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
								backgroundColor: 'var(--background-primary)',
								color: 'var(--text-normal)'
							},
							'.cm-scroller': {
								fontFamily: 'var(--font-monospace)',
								lineHeight: '1.6',
							},
							'&.cm-focused': {
								outline: 'none',
							},
							'.cm-activeLine': {
								backgroundColor: 'var(--background-modifier-active-hover)',
							},
							'.cm-activeLineGutter': {
								backgroundColor: 'var(--background-modifier-active-hover)',
							},
							'.cm-selectionBackground, .cm-focused .cm-selectionBackground, &::selection': {
								backgroundColor: 'var(--text-selection)',
							},
							'.cm-cursor, .cm-dropCursor': {
								borderLeftColor: 'var(--text-normal)',
							},
							'.cm-gutters': {
								backgroundColor: 'var(--background-primary)',
								color: 'var(--text-faint)',
								borderRight: '1px solid var(--background-modifier-border)',
							}
						},
						{ dark: activeDocument.body.classList.contains('theme-dark') }
					),
				],
			}),
			parent: editorContainer,
		});

		if (this.isViewMode && options.addAction) {
			// Tab View - Native Actions
			// Note: Obsidian prepends actions. The first one added appears furthest to the right.
			// Desired visual order (L to R): [Enable Snippet] [Copy/Wrap] [Add Block] [Search] [Save]

			// 1. Save (furthest right)
			if (!this.source.readOnly) {
				options.addAction('save', 'Save', (): void => { void this.handleSave(); });
				options.addAction('search', 'Search', () => this.handleSearch());
			}

			// 2. Add Block
			if (
				(this.source.type === 'Snippet' || this.source.type === 'Theme') &&
				!this.source.readOnly
			) {
				options.addAction('plus-with-circle', 'Add block', (e: MouseEvent) => {
					const target = e.target as HTMLElement;
					const rect = target.getBoundingClientRect();
					this.showAddBlockMenu({ x: rect.right, y: rect.bottom });
				});
			}

			// 3. Wrap Text
			options.addAction('wrap-text', 'Toggle line wrapping', () => {
				this.isWrapping = !this.isWrapping;
				if (this.view) {
					this.view.dispatch({
						effects: this.wrapCompartment.reconfigure(
							this.isWrapping ? EditorView.lineWrapping : []
						),
					});
				}
			});

			// 4. Copy (if read-only)
			if (this.source.readOnly) {
				options.addAction('copy', 'Copy to clipboard', () => {
					if (this.view) {
						const currentContent = this.view.state.doc.toString();
						void navigator.clipboard.writeText(currentContent);
						this.plugin.settingsService.notifications.util(
							'Copied to clipboard'
						);
					}
				});
			}

			// 5. Enable Snippet Toggle (furthest left)
			if (!this.source.readOnly && this.source.type === 'Snippet') {
				const currentEnabled =
					(this.plugin.settingsService.settings[
						StorageKeys.SNIPPETS
					] as string[]) || [];
				let isEnabled = currentEnabled.includes(this.source.id);
				
				const toggleActionEl = options.addAction(
					isEnabled ? 'check-circle' : 'circle',
					isEnabled ? 'Disable snippet' : 'Enable snippet',
					(): void => { void (async (): Promise<void> => {
                    const snippets = new Set(
                    	(this.plugin.settingsService.settings[
                    		StorageKeys.SNIPPETS
                    	] as string[]) || []
                    );
                    isEnabled = !isEnabled;
                    if (isEnabled) snippets.add(this.source.id);
                    else snippets.delete(this.source.id);

                    const list = Array.from(snippets);
                    await this.plugin.settingsService.setSetting(
                    	StorageKeys.SNIPPETS,
                    	list,
                    	{ silentUI: true }
                    );

                    setIcon(toggleActionEl, isEnabled ? 'check-circle' : 'circle');
                    setTooltip(toggleActionEl, isEnabled ? 'Disable snippet' : 'Enable snippet');
                    })(); }
				);

				this.settingsChangedHandler = (): void => {
					const currentEnabled =
						(this.plugin.settingsService.settings[
							StorageKeys.SNIPPETS
						] as string[]) || [];
					isEnabled = currentEnabled.includes(this.source.id);
					setIcon(toggleActionEl, isEnabled ? 'check-circle' : 'circle');
					setTooltip(toggleActionEl, isEnabled ? 'Disable snippet' : 'Enable snippet');
				};
				this.plugin.settingsService.on('settings-changed', this.settingsChangedHandler);
			}
		} else {
			// Modal / Non-Tab View - Custom Footer
			const footer = this.container.createDiv('modal-button-container');
			footer.addClass('style-manager-editor-footer-modal');

			const leftGroup = footer.createDiv('style-manager-editor-footer-left');
			const rightGroup = footer.createDiv('style-manager-editor-footer-right');

			const wrapBtn = new ButtonComponent(leftGroup)
				.setButtonText('Wrap')
				.setTooltip('Toggle line wrapping')
				.onClick(() => {
					this.isWrapping = !this.isWrapping;
					wrapBtn.buttonEl.toggleClass('is-active', this.isWrapping);
					if (this.view) {
						this.view.dispatch({
							effects: this.wrapCompartment.reconfigure(
								this.isWrapping ? EditorView.lineWrapping : []
							),
						});
					}
				});
			wrapBtn.buttonEl.toggleClass('is-active', this.isWrapping);

			if (
				(this.source.type === 'Snippet' || this.source.type === 'Theme') &&
				!this.source.readOnly
			) {
				const addBlockBtn = new ButtonComponent(leftGroup)
					.setIcon('plus-with-circle')
					.setTooltip('Add block')
					.onClick(() => {
						const rect = addBlockBtn.buttonEl.getBoundingClientRect();
						this.showAddBlockMenu({ x: rect.right, y: rect.top });
					});
			}

			if (options.onOpenInTab && !this.isViewMode) {
				new ButtonComponent(leftGroup)
					.setIcon('external-link')
					.setTooltip('Open this tool in a tab')
					.onClick((): void => { void (async (): Promise<void> => {
                    await this.plugin.activateCSSEditorView(this.source);
                    if (options.onOpenInTab) {
                    	options.onOpenInTab();
                    }
                    })(); });
			}

			if (this.source.readOnly) {
				if (!this.isViewMode) {
					new ButtonComponent(rightGroup)
						.setButtonText('Close')
						.onClick(() => {
							if (options.onClose) options.onClose();
						});
				}
				new ButtonComponent(rightGroup)
					.setButtonText('Copy to clipboard')
					.setCta()
					.onClick(() => {
						if (this.view) {
							const currentContent = this.view.state.doc.toString();
							void navigator.clipboard.writeText(currentContent);
							this.plugin.settingsService.notifications.util(
								'Copied to clipboard'
							);
						}
						if (!this.isViewMode && options.onClose) options.onClose();
					});
			} else {
				if (this.source.type === 'Snippet') {
					const toggleContainer = leftGroup.createDiv('style-manager-editor-toggle-container');
					
					const toggleLabel = toggleContainer.createSpan('style-manager-editor-toggle-label');
					toggleLabel.setText('Enable snippet');
					
					const currentEnabled =
						(this.plugin.settingsService.settings[
							StorageKeys.SNIPPETS
						] as string[]) || [];
					const isEnabled = currentEnabled.includes(this.source.id);
					
					const toggle = new ToggleComponent(toggleContainer)
						.setValue(isEnabled)
						.onChange((value): void => { void (async (): Promise<void> => {
                        const snippets = new Set(
                        	(this.plugin.settingsService.settings[
                        		StorageKeys.SNIPPETS
                        	] as string[]) || []
                        );
                        if (value) snippets.add(this.source.id);
                        else snippets.delete(this.source.id);

                        const list = Array.from(snippets);
                        await this.plugin.settingsService.setSetting(
                        	StorageKeys.SNIPPETS,
                        	list,
                        	{
                        		silentUI: true,
                        	}
                        );
                        })(); });
					
					this.snippetToggle = toggle;
					this.settingsChangedHandler = (): void => {
						const currentEnabled =
							(this.plugin.settingsService.settings[
								StorageKeys.SNIPPETS
							] as string[]) || [];
						const isEnabled = currentEnabled.includes(this.source.id);
						if (this.snippetToggle) {
							this.snippetToggle.setValue(isEnabled);
						}
					};
					this.plugin.settingsService.on('settings-changed', this.settingsChangedHandler);
				}

				new ButtonComponent(rightGroup)
					.setButtonText('Save')
					.setCta()
					.onClick(() => this.handleSave());
			}
		}
	}

	public isDirty(): boolean {
		if (!this.view || this.source.readOnly) return false;
		return this.view.state.doc.toString() !== this.content;
	}

	public resetDirty(): void {
		if (this.view) {
			this.content = this.view.state.doc.toString();
		}
	}

	public handleSearch(): void {
		if (this.view) {
			openSearchPanel(this.view);
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
					void this.plugin.settingsService.refreshService.trigger(
                    						RefreshLevel.PARSE_CSS
                    					);
				}
			}

			this.resetDirty();
			this.plugin.settingsService.notifications.snippet(
				`Saved ${type.toLowerCase()}: ${this.newName}`
			);
			if (this.onSaveSuccess) {
				this.onSaveSuccess(this.newName);
			}
		} catch (err) {
			Logger.error(`Style Manager | Failed to save ${type}:`, err);
			this.plugin.settingsService.notifications.error(
				`Failed to save ${type.toLowerCase()}.`
			);
		}
	}

	public destroy(): void {
		if (this.settingsChangedHandler) {
			this.plugin.settingsService.off('settings-changed', this.settingsChangedHandler);
			this.settingsChangedHandler = null;
		}
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

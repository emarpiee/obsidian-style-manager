import { App, Modal, TextComponent } from 'obsidian';

import StyleManagerPlugin from '../../main';
import { CSSEditor } from '../components/CSSEditor';

import { ConfirmModal } from './ConfirmModal';

export class CSSEditorModal extends Modal {
	private editor: CSSEditor;
	private newName: string = '';
	private forceClose: boolean = false;

	constructor(
		app: App,
		private plugin: StyleManagerPlugin,
		private source: { type: string; id: string; readOnly?: boolean },
		private onSaveSuccess?: (newName: string) => void
	) {
		super(app);
		this.editor = new CSSEditor();
	}

	async onOpen(): Promise<void> {
		const { contentEl, modalEl } = this;
		modalEl.addClass('style-manager-plugin');
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-editor-modal');
		this.newName = this.source.id;

		this.titleEl.empty();
		this.titleEl.addClass('style-manager-editor-title-container');

		this.titleEl.createSpan({
			text: `${this.source.readOnly ? 'Viewing' : 'Editing'}: `,
			cls: 'style-manager-editor-title-prefix',
		});

		const nameInput = new TextComponent(this.titleEl)
			.setValue(this.newName)
			.setPlaceholder('name')
			.onChange((val) => {
				this.newName = val.trim();
				this.editor.newName = this.newName;
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
				void this.editor.handleSave();
			}
		});

		await this.editor.render(contentEl, {
			plugin: this.plugin,
			source: this.source,
			isView: false,
			onOpenInTab: () => this.close(),
			onClose: () => this.close(),
			onSaveSuccess: this.onSaveSuccess,
		});
	}

	close(): void {
		if (this.editor.isDirty() && !this.forceClose) {
			new ConfirmModal(
				this.app,
				'Unsaved Changes',
				'You have unsaved changes. Are you sure you want to close without saving?',
				'Discard Changes',
				true,
				() => {
					this.forceClose = true;
					this.close();
				},
				'Save',
				() => {
					void this.editor.handleSave().then(() => {
                    						this.forceClose = true;
                    						this.close();
                    					});
				}
			).open();
			return;
		}
		super.close();
	}

	onClose(): void {
		this.editor.destroy();
		this.contentEl.empty();
	}
}

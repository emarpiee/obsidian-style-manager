import { App, Modal, Setting, TFile, setIcon } from 'obsidian';

export class VaultFileSelectModal extends Modal {
	files: TFile[] = [];
	selectedFiles: Set<string> = new Set();
	onSelect: (files: TFile[]) => void;
	searchTerm: string = '';

	constructor(app: App, onSelect: (files: TFile[]) => void) {
		super(app);
		this.onSelect = onSelect;
		this.loadFiles();
	}

	loadFiles(): void {
		const abstractFiles = this.app.vault.getAllLoadedFiles();
		this.files = abstractFiles
			.filter(
				(file): file is TFile =>
					file instanceof TFile &&
					(file.extension === 'json' ||
						file.extension === 'md' ||
						file.extension === 'txt' ||
						file.extension === 'zip')
			)
			.sort((a, b) => a.path.localeCompare(b.path));
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('style-manager-plugin');
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-vault-select-modal');

		this.setTitle('Browse vault');

		const searchContainer = contentEl.createDiv();
		new Setting(searchContainer)
			.setClass('style-manager-search-container')
			.addSearch((search) => {
				search.setPlaceholder('Filter files...');
				search.onChange((val) => {
					this.searchTerm = val.toLowerCase();
					this.renderList(listContainer);
				});
			});

		const controlsEl = contentEl.createDiv('style-manager-modal-controls');
		const selectAllBtn = controlsEl.createEl('button', {
			text: 'Select all',
			cls: 'style-manager-modal-button',
		});
		selectAllBtn.onclick = (): void => {
			this.getFilteredFiles().forEach((f) => this.selectedFiles.add(f.path));
			this.renderList(listContainer);
		};

		const deselectAllBtn = controlsEl.createEl('button', {
			text: 'Deselect all',
			cls: 'style-manager-modal-button',
		});
		deselectAllBtn.onclick = (): void => {
			this.selectedFiles.clear();
			this.renderList(listContainer);
		};

		const listContainer = contentEl.createDiv('style-manager-vault-file-list');
		this.renderList(listContainer);

		new Setting(contentEl)
			.setClass('style-manager-modal-buttons')
			.addButton((btn) =>
				btn.setButtonText('Cancel').onClick(() => this.close())
			)
			.addButton((btn) =>
				btn
					.setButtonText('Import selected')
					.setCta()
					.onClick(() => {
						const selected = this.files.filter((f) =>
							this.selectedFiles.has(f.path)
						);
						this.onSelect(selected);
						this.close();
					})
			);
	}

	getFilteredFiles(): TFile[] {
		return this.files.filter((f) =>
			f.path.toLowerCase().includes(this.searchTerm)
		);
	}

	renderList(container: HTMLElement): void {
		container.empty();
		const filtered = this.getFilteredFiles();

		if (filtered.length === 0) {
			container.createEl('p', {
				text: 'No matching files found.',
				cls: 'style-manager-no-results',
			});
			return;
		}

		filtered.forEach((file) => {
			const item = container.createDiv('style-manager-vault-file-item');
			if (this.selectedFiles.has(file.path)) {
				item.addClass('is-selected');
			}

			const checkbox = item.createEl('input', { type: 'checkbox' });
			checkbox.checked = this.selectedFiles.has(file.path);

			checkbox.onchange = (e: Event): void => {
				e.stopPropagation();
				if (checkbox.checked) {
					this.selectedFiles.add(file.path);
					item.addClass('is-selected');
				} else {
					this.selectedFiles.delete(file.path);
					item.removeClass('is-selected');
				}
			};

			const iconContainer = item.createDiv('style-manager-suggestion-icon');
			if (file.extension === 'md') setIcon(iconContainer, 'document');
			else if (file.extension === 'json') setIcon(iconContainer, 'code');
			else if (file.extension === 'zip') setIcon(iconContainer, 'package');
			else setIcon(iconContainer, 'file-text');

			const textContainer = item.createDiv('style-manager-vault-file-text');
			textContainer.createDiv({
				text: file.name,
				cls: 'style-manager-suggestion-name',
			});
			textContainer.createDiv({
				text: file.path,
				cls: 'style-manager-suggestion-path',
			});

			item.onclick = (e: MouseEvent): void => {
				if (e.target !== checkbox) {
					checkbox.checked = !checkbox.checked;
					checkbox.dispatchEvent(new Event('change'));
				}
			};
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

import { App, Modal, Setting } from 'obsidian';

export class ConfirmModal extends Modal {
	title: string;
	message: string;
	onConfirm: () => void;
	ctaText: string;
	isWarning: boolean;
	secondaryCtaText?: string;
	onSecondaryConfirm?: () => void;
	listItems?: string[];
	diffSummary?: {
		added: number;
		updated: number;
		deleted: number;
		addedKeys?: string[];
		updatedKeys?: string[];
		deletedKeys?: string[];
		addedEntries?: Record<string, unknown>;
		updatedEntries?: Record<string, unknown>;
		updatedOldEntries?: Record<string, unknown>;
		deletedEntries?: Record<string, unknown>;
	};

	constructor(
		app: App,
		title: string,
		message: string,
		ctaText: string,
		isWarning: boolean,
		onConfirm: () => void,
		secondaryCtaText?: string,
		onSecondaryConfirm?: () => void,
		listItems?: string[],
		diffSummary?: {
			added: number;
			updated: number;
			deleted: number;
			addedKeys?: string[];
			updatedKeys?: string[];
			deletedKeys?: string[];
			addedEntries?: Record<string, unknown>;
			updatedEntries?: Record<string, unknown>;
			updatedOldEntries?: Record<string, unknown>;
			deletedEntries?: Record<string, unknown>;
		}
	) {
		super(app);
		this.title = title;
		this.message = message;
		this.onConfirm = onConfirm;
		this.ctaText = ctaText;
		this.isWarning = isWarning;
		this.secondaryCtaText = secondaryCtaText;
		this.onSecondaryConfirm = onSecondaryConfirm;
		this.listItems = listItems;
		this.diffSummary = diffSummary;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('style-manager-plugin');
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-confirm-modal');

		this.setTitle(this.title);
		const descEl = contentEl.createEl('p', {
			cls: 'style-manager-modal-description',
		});
		descEl.setCssStyles({ whiteSpace: 'pre-wrap' });
		descEl.textContent = this.message;

		if (this.diffSummary) {
			// Header row: label + expand/collapse toggle
			const diffHeader = contentEl.createDiv({ cls: 'style-manager-diff-summary-header' });
			diffHeader.createSpan({ cls: 'style-manager-diff-summary-title', text: 'Changes' });

			const { added, updated, deleted, addedKeys, updatedKeys, deletedKeys, addedEntries, updatedEntries, updatedOldEntries, deletedEntries } = this.diffSummary;
			const hasExpandable = (added > 0 && addedKeys && addedKeys.length > 0)
				|| (updated > 0 && updatedKeys && updatedKeys.length > 0)
				|| (deleted > 0 && deletedKeys && deletedKeys.length > 0);

			const allDetailsEls: HTMLDetailsElement[] = [];
			let allExpanded = false;

			let toggleBtn: HTMLButtonElement | null = null;
			if (hasExpandable) {
				toggleBtn = diffHeader.createEl('button', {
					cls: 'style-manager-diff-toggle-btn',
					text: 'Expand all',
				});
				toggleBtn.addEventListener('click', () => {
					allExpanded = !allExpanded;
					for (const d of allDetailsEls) {
						d.open = allExpanded;
					}
					if (toggleBtn) toggleBtn.textContent = allExpanded ? 'Collapse all' : 'Expand all';
				});
			}

			const diffContainer = contentEl.createDiv({ cls: 'style-manager-diff-summary-container' });

			const createCard = (
				type: 'added' | 'updated' | 'deleted' | 'unchanged',
				count: number,
				label: string,
				keys?: string[],
				entries?: Record<string, unknown>,
				oldEntries?: Record<string, unknown>
			) : void => {
				const card = diffContainer.createDiv({ cls: `style-manager-diff-card is-${type}` });
				const hasKeys = keys && keys.length > 0;

				if (hasKeys) {
					const details = card.createEl('details');
					allDetailsEls.push(details);
					const summary = details.createEl('summary');
					const titleSpan = summary.createSpan({ cls: 'style-manager-diff-card-title-span' });
					titleSpan.createSpan({ cls: 'style-manager-diff-card-icon', text: type === 'added' ? '+' : type === 'updated' ? '~' : '-' });
					titleSpan.createSpan({ cls: 'style-manager-diff-card-count', text: String(count) });
					titleSpan.createSpan({ cls: 'style-manager-diff-card-label', text: label });

					const pre = details.createEl('pre', { cls: 'style-manager-modal-pre style-manager-diff-keys-code' });
					const code = pre.createEl('code');
					if (entries && Object.keys(entries).length > 0) {
						// Render as "key": value pairs matching the preset viewer style
						code.textContent = Object.entries(entries)
							.map(([k, v]) => {
								const newVal = JSON.stringify(v);
								if (oldEntries && oldEntries[k] !== undefined) {
									const oldVal = JSON.stringify(oldEntries[k]);
									return `"${k}": ${oldVal} → ${newVal}`;
								}
								return `"${k}": ${newVal}`;
							})
							.join('\n');
					} else {
						code.textContent = keys.map(key => key.includes('@@') ? key.split('@@')[1] : key).join('\n');
					}
				} else {
					// No keys to show — flat summary row
					const titleSpan = card.createSpan({ cls: 'style-manager-diff-card-title-span' });
					titleSpan.setCssStyles({ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' });
					if (type !== 'unchanged') {
						titleSpan.createSpan({ cls: 'style-manager-diff-card-icon', text: type === 'added' ? '+' : type === 'updated' ? '~' : '-' });
						titleSpan.createSpan({ cls: 'style-manager-diff-card-count', text: String(count) });
					} else {
						titleSpan.createSpan({ cls: 'style-manager-diff-card-icon', text: '=' });
					}
					titleSpan.createSpan({ cls: 'style-manager-diff-card-label', text: label });
				}
			};

			if (added === 0 && updated === 0 && deleted === 0) {
				createCard('unchanged', 0, 'No changes to apply');
			} else {
				if (added > 0) createCard('added', added, 'Added', addedKeys, addedEntries);
				if (updated > 0) createCard('updated', updated, 'Updated', updatedKeys, updatedEntries, updatedOldEntries);
				if (deleted > 0) createCard('deleted', deleted, 'Removed', deletedKeys, deletedEntries);
			}
		}

		if (this.listItems && this.listItems.length > 0) {
			const pre = contentEl.createEl('pre', { cls: 'style-manager-modal-pre' });
			pre.setText(this.listItems.join('\n'));
		}

		const buttonSetting = new Setting(contentEl).setClass(
			'style-manager-modal-buttons'
		);

		// 1. Cancel — leftmost
		buttonSetting.addButton((btn) =>
			btn.setButtonText('Cancel').onClick(() => this.close())
		);

		// 2. Secondary CTA (e.g. "Keep") — middle
		if (this.secondaryCtaText && this.onSecondaryConfirm) {
			buttonSetting.addButton((btn) => {
				btn.setButtonText(this.secondaryCtaText);
				btn.setCta();
				btn.onClick(() => {
					this.onSecondaryConfirm?.();
					this.close();
				});
			});
		}

		// 3. Primary CTA (e.g. "Save", "Discard") — rightmost
		buttonSetting.addButton((btn) => {
			btn.setButtonText(this.ctaText);
			if (this.isWarning) {
				btn.setWarning();
			} else {
				btn.setCta();
			}
			btn.onClick(() => {
				this.onConfirm();
				this.close();
			});
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

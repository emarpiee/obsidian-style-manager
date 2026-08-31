import { App, Modal, Setting } from 'obsidian';
import type StyleManagerPlugin from '../../main';
import type { CSSSetting } from '../../types';

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
	plugin?: StyleManagerPlugin;

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
		},
		plugin?: StyleManagerPlugin
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
		this.plugin = plugin;
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
			let showNames = false;

			if (hasExpandable) {
				const diffHeaderActions = diffHeader.createDiv({ cls: 'style-manager-diff-header-actions' });
				diffHeaderActions.setCssStyles({ display: 'flex', alignItems: 'center', gap: '8px' });

				const nameBtn = diffHeaderActions.createEl('button', {
					cls: 'style-manager-diff-toggle-btn',
					text: 'Show names',
				});
				nameBtn.addEventListener('click', () => {
					showNames = !showNames;
					nameBtn.textContent = showNames ? 'Show IDs' : 'Show names';
					renderDiffSummary();
				});

				const tBtn = diffHeaderActions.createEl('button', {
					cls: 'style-manager-diff-toggle-btn',
					text: 'Expand all',
				});
				tBtn.addEventListener('click', () => {
					allExpanded = !allExpanded;
					for (const d of allDetailsEls) {
						d.open = allExpanded;
					}
					tBtn.textContent = allExpanded ? 'Collapse all' : 'Expand all';
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
								const rawKey = keys.find(x => (x.includes('@@') ? x.split('@@')[1] : x) === k) || k;
								let displayName = k;
								let setting: CSSSetting | null = null;
								if (rawKey.includes('@@')) {
									const parts = rawKey.split('@@');
									const settingId = parts[1];
									const appWithPlugins = this.app as App & {
										plugins?: {
											plugins?: Record<string, StyleManagerPlugin>;
										};
									};
									const p = this.plugin || appWithPlugins.plugins?.plugins?.['obsidian-style-manager'];
									if (p && p.settingsList) {
										for (const section of p.settingsList) {
											const st = section.settings?.find((s) => s.id === settingId);
											if (st) {
												setting = st;
												break;
											}
										}
									}
								}

								if (showNames) {
									if (rawKey === '__theme') displayName = 'Active theme';
									else if (rawKey === '__appearance') displayName = 'Appearance';
									else if (rawKey === '__snippets') displayName = 'Snippets';
									else if (rawKey === '__accentColor') displayName = 'Accent color';
									else if (setting && setting.title) {
										displayName = setting.title;
									}
								}

								const getValueDisplay = (val: unknown): unknown => {
									if (showNames && setting) {
										const options = (setting as { options?: Array<string | { label: string; value: string }> }).options;
										if (options && Array.isArray(options)) {
											const option = options.find((opt) => {
												if (typeof opt === 'object' && opt !== null) {
													return opt.value === val;
												}
												return opt === val;
											});
											if (option && typeof option === 'object' && 'label' in option && option.label !== undefined) {
												return option.label;
											}
										}
									}
									return val;
								};

								const displayedVal = getValueDisplay(v);
								const newVal = JSON.stringify(displayedVal);
								if (oldEntries && oldEntries[k] !== undefined) {
									const displayedOldVal = getValueDisplay(oldEntries[k]);
									const oldVal = JSON.stringify(displayedOldVal);
									return `"${displayName}": ${oldVal} → ${newVal}`;
								}
								return `"${displayName}": ${newVal}`;
							})
							.join('\n');
					} else {
						code.textContent = keys.map(key => {
							if (showNames) {
								if (key === '__theme') return 'Active theme';
								if (key === '__appearance') return 'Appearance';
								if (key === '__snippets') return 'Snippets';
								if (key === '__accentColor') return 'Accent color';
								if (key.includes('@@')) {
									const parts = key.split('@@');
									const settingId = parts[1];
									const appWithPlugins = this.app as App & {
										plugins?: {
											plugins?: Record<string, StyleManagerPlugin>;
										};
									};
									const p = this.plugin || appWithPlugins.plugins?.plugins?.['obsidian-style-manager'];
									if (p && p.settingsList) {
										for (const section of p.settingsList) {
											const st = section.settings?.find((st) => st.id === settingId);
											if (st && st.title) {
												return st.title;
											}
										}
									}
								}
							}
							return key.includes('@@') ? key.split('@@')[1] : key;
						}).join('\n');
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

			const renderDiffSummary = (): void => {
				const states: Record<string, boolean> = {};
				for (const d of allDetailsEls) {
					const card = d.closest('.style-manager-diff-card');
					if (card) {
						if (card.classList.contains('is-added')) states['added'] = d.open;
						else if (card.classList.contains('is-updated')) states['updated'] = d.open;
						else if (card.classList.contains('is-deleted')) states['deleted'] = d.open;
					}
				}

				diffContainer.empty();
				allDetailsEls.length = 0;
				if (added === 0 && updated === 0 && deleted === 0) {
					createCard('unchanged', 0, 'No changes to apply');
				} else {
					if (added > 0) createCard('added', added, 'Added', addedKeys, addedEntries);
					if (updated > 0) createCard('updated', updated, 'Updated', updatedKeys, updatedEntries, updatedOldEntries);
					if (deleted > 0) createCard('deleted', deleted, 'Removed', deletedKeys, deletedEntries);
				}

				for (const d of allDetailsEls) {
					const card = d.closest('.style-manager-diff-card');
					if (card) {
						let type = '';
						if (card.classList.contains('is-added')) type = 'added';
						else if (card.classList.contains('is-updated')) type = 'updated';
						else if (card.classList.contains('is-deleted')) type = 'deleted';

						if (type && states[type] !== undefined) {
							d.open = states[type];
						} else {
							d.open = allExpanded;
						}
					}
				}
			};

			renderDiffSummary();
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

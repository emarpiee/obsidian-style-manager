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
import { App, ButtonComponent, Component, Setting, debounce } from 'obsidian';

import { SnippetSettingComponent } from './SnippetSettingComponent';

import {
	OPEN_IN_DEFAULT_APP_KEY,
	OPEN_MODAL_ON_CREATE_KEY,
	SNIPPETS_KEY,
} from '../../../constants';
import StyleManagerPlugin from '../../../main';
import {
	handleItemSelection,
	setupListKeybindings,
} from '../../../utils/UIUtils';
import { CSSEditorModal } from '../../modals/CSSEditorModal';
import { ConfirmModal } from '../../modals/ConfirmModal';

/**
 * Renders the Snippets tab: search, folder actions, and the list of snippets.
 */
export class SnippetsTab {
	private snippetComponents: SnippetSettingComponent[] = [];
	private filterString: string = '';
	private listContainer: HTMLElement;

	constructor(
		private containerEl: HTMLElement,
		private app: App,
		private plugin: StyleManagerPlugin,
		private onRerender: () => void,
		private addChild: (child: Component) => Component
	) {}

	render(): void {
		const searchRow = this.containerEl.createDiv('style-manager-search-row');
		searchRow.addClass('style-manager-snippets-search-row');

		new Setting(searchRow)
			.setClass('style-manager-search-container')
			.setClass('style-manager-snippets-filter')
			.addSearch((search) => {
				search
					.setPlaceholder('Search snippets...')
					.setValue(this.filterString)
					.onChange(
						debounce((value) => {
							this.filterString = value.toLowerCase();
							this.applyFilter();
						}, 250)
					);
			})
			.addExtraButton((btn) => {
				btn
					.setIcon('plus')
					.setTooltip('Create snippet')
					.onClick(async () => {
						const id =
							await this.plugin.settingsService.snippetService.createSnippet();

						const openModal =
							this.plugin.settingsService.settings[OPEN_MODAL_ON_CREATE_KEY] !==
							false;
						if (openModal) {
							const useDefaultApp =
								this.plugin.settingsService.settings[OPEN_IN_DEFAULT_APP_KEY];
							if (useDefaultApp) {
								const path =
									this.plugin.settingsService.bridge.getSnippetPath(id);
								(
									this.app as unknown as {
										openWithDefaultApp: (path: string) => void;
									}
								).openWithDefaultApp(path);
							} else {
								new CSSEditorModal(this.app, this.plugin, {
									type: 'Snippet',
									id,
								}).open();
							}
						}

						this.onRerender();
					});
			})
			.addExtraButton((btn) => {
				btn
					.setIcon('folder')
					.setTooltip('Open snippets folder')
					.onClick(() => {
						const customCss = (
							this.app as unknown as {
								customCss?: { openSnippetsFolder?: () => void };
							}
						).customCss;
						if (customCss && customCss.openSnippetsFolder) {
							customCss.openSnippetsFolder();
						} else {
							// Robust fallback: show the snippets folder by targeting its path
							(
								this.app as unknown as { showInFolder?: (path: string) => void }
							).showInFolder?.('.obsidian/snippets');
						}
					});
			});

		this.listContainer = this.containerEl.createDiv(
			'style-manager-snippets-list'
		);
		this.listContainer.tabIndex = 0;

		setupListKeybindings({
			container: this.listContainer,
			getItems: () => this.getVisibleSnippets(),
			getId: (id) => id,
			selectedIds: this.plugin.selectedSnippets,
			onSelectionChange: () => this.onRerender(),
		});

		this.renderSnippetList();
		this.renderBulkActions();
	}

	private getVisibleSnippets(): string[] {
		// Wait, snippetComponents has setting which might be undefined if not rendered yet,
		// but since we only call this after rendering, it's fine.
		return this.snippetComponents
			.filter((comp) => {
				// The component has a setVisibility method that toggles the settingEl
				// We can check the DOM node's style.display
				const el = (comp as unknown as { setting: { settingEl: HTMLElement } })
					.setting?.settingEl;
				return el && el.style.display !== 'none';
			})
			.map((comp) => comp.snippetId);
	}

	private renderSnippetList(): void {
		const customCss = (
			this.app as unknown as { customCss?: { snippets?: string[] } }
		).customCss;
		if (!customCss) return;

		const snippets = customCss.snippets || [];

		if (snippets.length === 0) {
			this.listContainer.createDiv({
				cls: 'style-manager-empty',
				text: 'No snippets found in vault',
			});
			return;
		}

		snippets.forEach((id: string, index: number) => {
			const isSelected = this.plugin.selectedSnippets.has(id);
			const metadata = this.plugin.snippetMetadataMap.get(id);
			const comp = new SnippetSettingComponent(
				this.app,
				this.listContainer,
				this.plugin,
				id,
				isSelected,
				(e, forceToggle) =>
					this.handleSelectionChange(e, id, index, forceToggle),
				metadata
			);
			this.snippetComponents.push(comp);
			this.addChild(comp);
		});

		if (this.filterString) {
			this.applyFilter();
		}
	}

	private applyFilter(): void {
		const query = this.filterString.toLowerCase();

		const authorMatch = query.match(/@author\s+([^\s@]+)/);
		const nameMatch = query.match(/@name\s+([^\s@]+)/);
		const descMatch = query.match(/@description\s+([^\s@]+)/);
		const licenseMatch = query.match(/@license\s+([^\s@]+)/);

		const cleanedQuery = query
			.replace(/@author\s+[^\s@]+/g, '')
			.replace(/@name\s+[^\s@]+/g, '')
			.replace(/@description\s+[^\s@]+/g, '')
			.replace(/@license\s+[^\s@]+/g, '')
			.trim();

		this.snippetComponents.forEach((comp) => {
			let matches = true;
			const displayName = comp.snippetId + '.css';
			const metadata = this.plugin.snippetMetadataMap.get(comp.snippetId) || {};

			if (
				authorMatch &&
				!metadata.author?.toLowerCase().includes(authorMatch[1])
			)
				matches = false;
			if (nameMatch && !displayName.toLowerCase().includes(nameMatch[1]))
				matches = false;
			if (
				descMatch &&
				!metadata.description?.toLowerCase().includes(descMatch[1])
			)
				matches = false;
			if (
				licenseMatch &&
				!metadata.license?.toLowerCase().includes(licenseMatch[1])
			)
				matches = false;

			if (
				cleanedQuery &&
				!(
					comp.snippetId.toLowerCase().includes(cleanedQuery) ||
					displayName.toLowerCase().includes(cleanedQuery) ||
					metadata.author?.toLowerCase().includes(cleanedQuery) ||
					metadata.description?.toLowerCase().includes(cleanedQuery)
				)
			) {
				matches = false;
			}

			comp.setVisibility(matches);
		});
	}

	private handleSelectionChange(
		e: MouseEvent | KeyboardEvent,
		id: string,
		index: number,
		forceToggle?: boolean
	): void {
		const customCss = (
			this.app as unknown as { customCss?: { snippets?: string[] } }
		).customCss;
		const snippets = customCss.snippets || [];

		handleItemSelection(
			e,
			index,
			id,
			{
				container: this.listContainer,
				getItems: () => snippets,
				getId: (s) => s,
				selectedIds: this.plugin.selectedSnippets,
				lastSelectedIndexGetter: () =>
					this.plugin.lastSnippetSelectedIndex ?? null,
				lastSelectedIndexSetter: (idx) => {
					this.plugin.lastSnippetSelectedIndex = idx;
				},
				onSelectionChange: () => this.onRerender(),
			},
			forceToggle
		);
	}

	private renderBulkActions(): void {
		if (this.plugin.selectedSnippets.size === 0) {
			this.listContainer.removeClass('has-bulk-actions');
			return;
		}

		this.listContainer.addClass('has-bulk-actions');
		const bulkContainer = this.containerEl.createDiv(
			'style-manager-bulk-actions'
		);

		const info = bulkContainer.createDiv('style-manager-bulk-info');
		info.setText(`${this.plugin.selectedSnippets.size} selected`);

		const actions = bulkContainer.createDiv('style-manager-bulk-buttons');

		new ButtonComponent(actions).setButtonText('Select all').onClick(() => {
			const visibleSnippets = this.getVisibleSnippets();
			visibleSnippets.forEach((id: string) =>
				this.plugin.selectedSnippets.add(id)
			);
			this.onRerender();
		});

		new ButtonComponent(actions)
			.setButtonText('Duplicate')
			.onClick(() => this.bulkDuplicate());

		new ButtonComponent(actions)
			.setButtonText('Delete')
			.setWarning()
			.onClick(() => this.bulkDelete());

		new ButtonComponent(actions)
			.setButtonText('Toggle')
			.setCta()
			.onClick(() => {
				this.toggleAllSelected();
			});

		new ButtonComponent(actions)
			.setIcon('cross')
			.setTooltip('Clear selection')
			.onClick(() => {
				this.plugin.selectedSnippets.clear();
				this.onRerender();
			});
	}

	private async toggleAllSelected(): Promise<void> {
		const lockerEnabled =
			(this.plugin.settingsService.settings[SNIPPETS_KEY] as string[]) || [];
		const isEnabled = (id: string): boolean => lockerEnabled.includes(id);

		// Determine target state: if any selected is disabled, enable all. Otherwise disable all.
		let targetState = false;
		for (const id of this.plugin.selectedSnippets) {
			if (!isEnabled(id)) {
				targetState = true;
				break;
			}
		}

		const snippets = new Set(lockerEnabled);
		for (const id of this.plugin.selectedSnippets) {
			if (targetState) snippets.add(id);
			else snippets.delete(id);
		}

		await this.plugin.settingsService.setSetting(
			SNIPPETS_KEY,
			Array.from(snippets),
			{ silentUI: true }
		);
		this.plugin.settingsService.notifications.snippet(
			`${targetState ? 'Enabled' : 'Disabled'} ${this.plugin.selectedSnippets.size} snippets`
		);
		this.onRerender();
	}

	private async bulkDelete(): Promise<void> {
		const count = this.plugin.selectedSnippets.size;
		new ConfirmModal(
			this.app,
			'Delete snippets',
			`Are you sure you want to delete ${count} selected snippets? This action cannot be undone.`,
			'Delete all',
			true,
			async () => {
				const selectedIds = Array.from(this.plugin.selectedSnippets);
				for (const snippetId of selectedIds) {
					try {
						await this.plugin.settingsService.snippetService.deleteSnippet(
							snippetId
						);
					} catch (err) {
						console.error(`Failed to delete snippet ${snippetId}:`, err);
					}
				}

				this.plugin.selectedSnippets.clear();
				this.plugin.settingsService.notifications.snippet(
					`Deleted ${count} snippets`
				);
				this.onRerender();
			}
		).open();
	}

	private async bulkDuplicate(): Promise<void> {
		const count = this.plugin.selectedSnippets.size;
		const selectedIds = Array.from(this.plugin.selectedSnippets);

		for (const id of selectedIds) {
			try {
				await this.plugin.settingsService.snippetService.duplicateSnippet(id);
			} catch (err) {
				console.error(`Failed to duplicate snippet ${id}:`, err);
			}
		}

		this.plugin.settingsService.notifications.snippet(
			`Duplicated ${count} snippets`
		);
		this.plugin.selectedSnippets.clear();
		this.onRerender();
	}
}

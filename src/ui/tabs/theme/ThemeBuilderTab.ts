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
import { App, Component, Setting, debounce } from 'obsidian';

import { ThemeItemComponent } from './ThemeItemComponent';

import StyleManagerPlugin from '../../../main';
import { ThemeManifestModal } from '../../modals/ThemeManifestModal';

export class ThemeBuilderTab {
	private themeComponents: ThemeItemComponent[] = [];
	private filterString: string = '';
	private listContainer: HTMLElement;

	constructor(
		private containerEl: HTMLElement,
		private app: App,
		private plugin: StyleManagerPlugin,
		private onRerender: () => void,
		private addChild: (child: Component) => Component
	) {}
	async render(): Promise<void> {
		const searchRow = this.containerEl.createDiv('style-manager-search-row');
		searchRow.addClass('style-manager-theme-builder-search-row');

		new Setting(searchRow)
			.setClass('style-manager-search-container')
			.setClass('style-manager-theme-builder-filter')
			.addSearch((search) => {
				search
					.setPlaceholder('Search themes...')
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
					.setTooltip('Create new theme')
					.onClick(() => {
						new ThemeManifestModal(
							this.app,
							this.plugin,
							this.plugin.settingsService.themeBuilderService,
							() => this.onRerender()
						).open();
					});
			})
			.addExtraButton((btn) => {
				btn
					.setIcon('folder')
					.setTooltip('Open themes folder')
					.onClick(() => {
						(
							this.app as unknown as { showInFolder?: (path: string) => void }
						).showInFolder?.('.obsidian/themes');
					});
			});

		this.listContainer = this.containerEl.createDiv(
			'style-manager-theme-builder-list'
		);
		await this.renderThemeList();
	}

	private async renderThemeList(): Promise<void> {
		const themes =
			await this.plugin.settingsService.themeBuilderService.getThemes();

		if (Object.keys(themes).length === 0) {
			this.listContainer.createDiv({
				cls: 'style-manager-empty',
				text: 'No custom themes found. Create one to get started!',
			});
			return;
		}

		for (const themeId in themes) {
			const manifest = themes[themeId];
			const comp = new ThemeItemComponent(
				this.app,
				this.listContainer,
				this.plugin,
				themeId,
				manifest,
				() => this.onRerender()
			);
			this.themeComponents.push(comp);
			this.addChild(comp);
		}

		if (this.filterString) {
			this.applyFilter();
		}
	}

	private applyFilter(): void {
		const query = this.filterString.toLowerCase();

		const authorMatch = query.match(/@author\s+([^\s@]+)/);
		const nameMatch = query.match(/@name\s+([^\s@]+)/);

		const cleanedQuery = query
			.replace(/@author\s+[^\s@]+/g, '')
			.replace(/@name\s+[^\s@]+/g, '')
			.trim();

		this.themeComponents.forEach((comp) => {
			let matches = true;
			const manifest = comp.manifest;

			if (
				authorMatch &&
				!manifest?.author?.toLowerCase().includes(authorMatch[1])
			)
				matches = false;
			if (nameMatch && !manifest?.name?.toLowerCase().includes(nameMatch[1]))
				matches = false;

			if (
				cleanedQuery &&
				!(
					comp.themeId.toLowerCase().includes(cleanedQuery) ||
					manifest?.name?.toLowerCase().includes(cleanedQuery)
				)
			) {
				matches = false;
			}

			comp.setVisibility(matches);
		});
	}
}

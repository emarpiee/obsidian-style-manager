import { App, Component, Setting, debounce } from 'obsidian';

import { ThemeItemComponent } from './ThemeItemComponent';

import StyleManagerPlugin from '../../../main';
import { ThemeManifestModal } from '../../modals/ThemeManifestModal';

export class ThemeBuilderTab {
	private themeComponents: ThemeItemComponent[] = [];
	private filterString: string = '';
	private listContainer: HTMLElement;

	private statsLeftEl: HTMLSpanElement;

	constructor(
		private containerEl: HTMLElement,
		private app: App,
		private plugin: StyleManagerPlugin,
		private onRerender: () => void,
		private addChild: (child: Component) => Component,
		private initialFilterString: string = '',
		private onFilterChange: (value: string) => void = () => {}
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
					.setValue(this.initialFilterString)
					.onChange(
						debounce((value) => {
							this.filterString = value.toLowerCase();
							this.onFilterChange(value);
							this.applyFilter();
						}, 250)
					);
				if (this.initialFilterString) {
					this.filterString = this.initialFilterString.toLowerCase();
				}
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
						).showInFolder?.(`${this.app.vault.configDir}/themes`);
					});
			});

		const statsBarEl = this.containerEl.createDiv(
			'style-manager-snippets-stats-bar'
		);
		this.statsLeftEl = statsBarEl.createSpan('style-manager-stats-left');

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
				() => this.onRerender(),
				() => this.applyFilter()
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
		const settingsMatch = query.match(/@settings\s+(true|false)/);

		const cleanedQuery = query
			.replace(/@author\s+[^\s@]+/g, '')
			.replace(/@name\s+[^\s@]+/g, '')
			.replace(/@settings\s+(true|false)/g, '')
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
			if (settingsMatch && comp.supportsStyleSettings !== null) {
				const expectsSettings = settingsMatch[1] === 'true';
				if (comp.supportsStyleSettings !== expectsSettings) {
					matches = false;
				}
			}

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

		let matchCount = 0;
		this.themeComponents.forEach((comp) => {
			const el = (comp as unknown as { setting: { settingEl: HTMLElement } })
				.setting?.settingEl;
			const isVisible = el && el.style.display !== 'none';
			if (isVisible) {
				matchCount++;
			}
		});

		const totalThemes = this.themeComponents.length;

		if (query.trim()) {
			const modifiers: string[] = [];
			if (authorMatch) modifiers.push(`by ${authorMatch[1]}`);
			if (nameMatch) modifiers.push(`named ${nameMatch[1]}`);
			if (settingsMatch) {
				modifiers.push(
					settingsMatch[1] === 'true'
						? 'with settings'
						: 'without settings'
				);
			}
			if (cleanedQuery) modifiers.push(`matching "${cleanedQuery}"`);

			const plural = matchCount === 1 ? 'theme' : 'themes';
			let label = `${matchCount} ${plural}`;
			if (modifiers.length > 0) {
				label += ' ' + modifiers.join(' and ');
			}

			this.statsLeftEl.setText(label);
		} else {
			this.statsLeftEl.setText(
				`You have ${totalThemes} theme${totalThemes !== 1 ? 's' : ''}`
			);
		}
	}
}

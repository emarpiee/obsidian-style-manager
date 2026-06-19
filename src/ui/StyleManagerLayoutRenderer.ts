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
import { App, Component, Platform } from 'obsidian';

import StyleManagerPlugin from '../main';
import { ParseLogList, ParsedCSSSettings } from '../types';

import { HeadingSettingComponent } from './components/fields/HeadingSettingComponent';
import { IsolateModeHeader } from './components/layout/IsolateModeHeader';
import { SettingsHeaderComponent } from './components/layout/SettingsHeaderComponent';
import { IsolateTab } from './tabs/IsolateTab';
import { PreferencesTab } from './tabs/PreferencesTab';
import { StylesTab } from './tabs/StylesTab';
import { PresetsTab } from './tabs/preset/PresetsTab';
import { SnippetsTab } from './tabs/snippet/SnippetsTab';
import { ThemeBuilderTab } from './tabs/theme/ThemeBuilderTab';

export type ActiveTab =
	| 'styles'
	| 'presets'
	| 'snippets'
	| 'theme'
	| 'isolate'
	| 'preferences';

export class StyleManagerLayoutRenderer extends Component {
	app: App;
	plugin: StyleManagerPlugin;
	settingsComponentTrees: HeadingSettingComponent[] = [];
	filterString: string = '';
	showModifiedOnly: boolean = false;
	settings: ParsedCSSSettings[] = [];
	parseLogs: ParseLogList = [];
	containerEl: HTMLElement;
	settingsContainerEl: HTMLElement;
	isView: boolean;
	activeTab: ActiveTab = 'styles';
	isolateModeHeader: IsolateModeHeader;
	private savedScrollTop: number = 0;

	private stylesTab: StylesTab | null = null;

	constructor(
		app: App,
		plugin: StyleManagerPlugin,
		containerEl: HTMLElement,
		isView?: boolean
	) {
		super();
		this.app = app;
		this.plugin = plugin;
		this.containerEl = containerEl;
		this.isView = !!isView;

		this.isolateModeHeader = new IsolateModeHeader(app, plugin, containerEl);
		this.addChild(this.isolateModeHeader);
	}

	onload(): void {
		this.display();

		this.registerEvent(
			this.plugin.settingsService.on('isolate-mode-changed', () => {
				this.rerender();
			})
		);

		this.registerEvent(
			this.plugin.settingsService.on('device-lockers-updated', () => {
				if (this.activeTab === 'isolate') this.rerender();
			})
		);

		this.registerEvent(
			this.plugin.settingsService.on('preset-schedules-updated', () => {
				if (this.activeTab === 'presets') this.rerender();
			})
		);
	}

	onunload(): void {
		this.cleanup();
		this.clearSelections();
		this.settingsComponentTrees = [];
	}

	display(): void {
		this.generate(this.settings);
	}

	removeChildren(): void {
		for (const tree of this.settingsComponentTrees) {
			this.removeChild(tree as unknown as Component);
		}
	}

	cleanup(): void {
		this.stylesTab?.cancelRender();
		this.removeChildren();
		this.settingsContainerEl?.empty();
	}

	public openTab(tab: ActiveTab): void {
		if (this.activeTab !== tab) {
			this.clearSelections();
			this.activeTab = tab;
			this.rerender(false);
		}
	}

	private clearSelections(): void {
		this.plugin.presetService.selectedPresets.clear();
		this.plugin.selectedSnippets.clear();
	}

	setSettings(settings: ParsedCSSSettings[], parseLogs: ParseLogList): void {
		// Only save scroll if we are not already tracking it (e.g. from rerender)
		if (this.savedScrollTop === 0 && this.containerEl.scrollTop > 0) {
			this.savedScrollTop = this.containerEl.scrollTop;
		}

		this.settings = settings;
		this.parseLogs = parseLogs;
		if (this.containerEl.parentNode) {
			this.generate(settings);
		}
	}

	generate(settings: ParsedCSSSettings[]): void {
		const { containerEl } = this;
		containerEl.empty();

		const masterContainer = containerEl.createDiv('style-manager-plugin');
		masterContainer.addClass('style-manager-wrapper');
		if (Platform.isMobile) {
			masterContainer.addClass('is-mobile');
		}

		this.cleanup();

		const header = new SettingsHeaderComponent(
			this.app,
			this.plugin,
			masterContainer,
			{
				activeTab: this.activeTab,
				onTabChange: (tab): void => this.openTab(tab),
				onRerender: (): void => this.rerender(),
				isolateModeHeader: this.isolateModeHeader,
			}
		);
		this.addChild(header);

		if (this.activeTab === 'presets') {
			new PresetsTab(masterContainer, this.plugin, () =>
				this.rerender()
			).render();
			this.restoreScroll();
			return;
		}

		if (this.activeTab === 'isolate') {
			new IsolateTab(this.app, masterContainer, this.plugin, () =>
				this.rerender()
			).render();
			this.restoreScroll();
			return;
		}

		if (this.activeTab === 'snippets') {
			new SnippetsTab(
				masterContainer,
				this.app,
				this.plugin,
				() => this.rerender(),
				(child) => this.addChild(child)
			).render();
			this.restoreScroll();
			return;
		}

		if (this.activeTab === 'theme') {
			new ThemeBuilderTab(
				masterContainer,
				this.app,
				this.plugin,
				() => this.rerender(),
				(child) => this.addChild(child)
			).render();
			this.restoreScroll();
			return;
		}

		if (this.activeTab === 'preferences') {
			new PreferencesTab(this.app, masterContainer, this.plugin).render();
			this.restoreScroll();
			return;
		}

		// Default: styles tab
		this.stylesTab = new StylesTab(masterContainer, {
			plugin: this.plugin,
			isView: this.isView,
			parseLogs: this.parseLogs,
			filterString: this.filterString,
			showModifiedOnly: this.showModifiedOnly,
			onFilterChange: (value: string): void => {
				this.filterString = value;
				this.filter();
			},
			onFilterClear: (): void => {
				this.filterString = '';
				this.clearFilter();
			},
			onToggleModifiedOnly: (): void => {
				this.showModifiedOnly = !this.showModifiedOnly;
				this.filter();
			},
			addChild: (child: HeadingSettingComponent): HeadingSettingComponent => {
				this.addChild(child);
				return child;
			},
			getSettingsComponentTrees: (): HeadingSettingComponent[] =>
				this.settingsComponentTrees,
			setSettingsComponentTrees: (trees: HeadingSettingComponent[]): void => {
				this.settingsComponentTrees = trees;
			},
			onRenderComplete: (): void => {
				if (this.filterString) this.filter();
				this.restoreScroll();
			},
		});
		this.stylesTab.render(settings);
		this.settingsContainerEl = this.stylesTab.settingsContainerEl;
	}

	private restoreScroll(): void {
		// Restore scroll position after all chunks are done
		if (this.savedScrollTop > 0) {
			this.containerEl.scrollTop = this.savedScrollTop;
			this.savedScrollTop = 0;
		}
	}


	filter(): void {
		if (!this.filterString && !this.showModifiedOnly) {
			this.clearFilter();
			return;
		}
		for (const tree of this.settingsComponentTrees) {
			tree.filter(this.filterString, this.showModifiedOnly);
		}
	}

	clearFilter(): void {
		this.showModifiedOnly = false;
		for (const tree of this.settingsComponentTrees) {
			tree.clearFilter();
		}
	}

	rerender(saveScroll: boolean = true): void {
		if (saveScroll && this.containerEl.scrollTop > 0) {
			this.savedScrollTop = this.containerEl.scrollTop;
		} else {
			this.savedScrollTop = 0;
		}
		this.cleanup();
		this.display();
	}
}

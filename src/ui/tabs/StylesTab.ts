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
import { Setting, debounce } from 'obsidian';

import StyleManagerPlugin from '../../main';
import { CSSSetting, ParsedCSSSettings } from '../../types';
import {
	HeadingSettingComponent,
	buildSettingComponentTree,
} from '../components/fields/HeadingSettingComponent';
import { ReadmeModal } from '../modals/ReadmeModal';
import { CSSParserLogsModal } from '../modals/CSSParserLogsModal';
import { ParseLogList } from '../../types';

export interface StylesTabDeps {
	plugin: StyleManagerPlugin;
	isView: boolean;
	parseLogs: ParseLogList;
	filterString: string;
	showModifiedOnly: boolean;
	onFilterChange: (value: string) => void;
	onFilterClear: () => void;
	onToggleModifiedOnly: () => void;
	addChild: (child: HeadingSettingComponent) => HeadingSettingComponent;
	getSettingsComponentTrees: () => HeadingSettingComponent[];
	setSettingsComponentTrees: (trees: HeadingSettingComponent[]) => void;
	onRenderComplete?: () => void;
}

/**
 * Renders the Styles tab: search bar + paginated chunked setting trees.
 */
export class StylesTab {
	private containerEl: HTMLElement;
	private deps: StylesTabDeps;
	private currentRenderIdx: number = 0;
	private renderFrameId: number | null = null;
	private isRendering: boolean = false;
	public settingsContainerEl: HTMLElement;

	constructor(containerEl: HTMLElement, deps: StylesTabDeps) {
		this.containerEl = containerEl;
		this.deps = deps;
	}

	render(settings: ParsedCSSSettings[]): void {
		if (settings.length === 0) {
			if (this.deps.plugin.isInitialLoading) {
				this.displayLoading();
			} else {
				this.displayEmpty();
			}
			return;
		}

		const topBtns = this.containerEl.createDiv('style-manager-search-row');
		topBtns.addClass('style-manager-styles-search-row');

		new Setting(topBtns)
			.setClass('style-manager-search-container')
			.setClass('style-manager-styles-filter')
			.addSearch((searchComponent) => {
				searchComponent.setValue(this.deps.filterString);
				searchComponent.onChange(
					debounce(
						(value) => {
							if (value) {
								this.deps.onFilterChange(value);
							} else {
								this.deps.onFilterClear();
							}
						},
						250,
						true
					)
				);
				searchComponent.setPlaceholder('Search styles...');
			})
			.addExtraButton((btn) => {
				btn
					.setIcon('asterisk')
					.setTooltip('Show modified only')
					.onClick(() => {
						this.deps.onToggleModifiedOnly();
						btn.extraSettingsEl.toggleClass(
							'is-active',
							this.deps.showModifiedOnly
						);
					});
				btn.extraSettingsEl.toggleClass(
					'is-active',
					this.deps.showModifiedOnly
				);
			})
			.addExtraButton((btn) => {
				btn
					.setIcon('info')
					.setTooltip('View Parse Logs')
					.onClick(() => {
						new CSSParserLogsModal(
							this.deps.plugin.app,
							this.deps.plugin,
							this.deps.parseLogs
						).open();
					});
			})
			.addExtraButton((btn) => {
				btn
					.setIcon('chevrons-up-down')
					.setTooltip('Collapse/Expand all')
					.onClick(() => {
						const trees = this.deps.getSettingsComponentTrees();
						const anyExpanded = trees.some((t) => !t.setting.collapsed);
						trees.forEach((t) => t.setCollapsedRecursive(anyExpanded));
					});
			});

		this.settingsContainerEl = this.containerEl.createDiv(
			'style-manager-styles-tab-content'
		);
		this.deps.setSettingsComponentTrees([]);

		this.cancelRender();
		this.isRendering = true;
		this.currentRenderIdx = 0;
		this.renderNextChunk(settings);
	}

	cancelRender(): void {
		if (this.renderFrameId) {
			cancelAnimationFrame(this.renderFrameId);
			this.renderFrameId = null;
		}
		this.isRendering = false;
	}

	private renderNextChunk(settings: ParsedCSSSettings[]): void {
		const CHUNK_SIZE = 5;
		const { plugin } = this.deps;

		for (
			let i = 0;
			i < CHUNK_SIZE && this.currentRenderIdx < settings.length;
			i++, this.currentRenderIdx++
		) {
			const s = settings[this.currentRenderIdx];
			const options: CSSSetting[] = [
				{
					id: s.id,
					type: 'heading',
					title: s.name,
					level: 0,
					collapsed: s.collapsed,
					sourceType: s.sourceType,
					sourceId: s.sourceId,
					isDuplicate: s.isDuplicate,
					resetFn: (): void => {
						plugin.settingsService.clearSection(s.id, false, {
							silentUI: true,
						});
					},
				},
				...s.settings,
			];

			try {
				const tree = buildSettingComponentTree({
					containerEl: this.settingsContainerEl,
					isView: this.deps.isView,
					sectionId: s.id,
					sectionName: s.name,
					settings: options,
					settingsService: plugin.settingsService,
				});

				this.deps.addChild(tree);
				this.deps.getSettingsComponentTrees().push(tree);
			} catch (e) {
				console.error('Style Manager | Failed to render section', e);
			}
		}

		if (this.currentRenderIdx < settings.length) {
			this.renderFrameId = requestAnimationFrame(() =>
				this.renderNextChunk(settings)
			);
		} else {
			this.isRendering = false;
			this.renderFrameId = null;
			this.deps.onRenderComplete?.();
		}
	}

	private displayEmpty(): void {
		this.containerEl.createDiv({ cls: 'style-manager-empty' }, (wrapper) => {
			wrapper.createDiv({
				cls: 'style-manager-empty-name',
				text: 'No styles found',
			});
			wrapper.createDiv({ cls: 'style-manager-empty-desc' }).appendChild(
				createFragment((frag) => {
					frag.appendText(
						'Styles configured by theme and plugin authors will show up here. You can also create your own configuration by creating a CSS snippet or theme in your vault. '
					);
					const link = frag.createEl('a', {
						text: 'Click here for details and examples.',
						href: '#',
					});
					link.onclick = (e: MouseEvent): void => {
						e.preventDefault();
						new ReadmeModal(this.deps.plugin.app, this.deps.plugin).open();
					};
				})
			);
		});
	}

	private displayLoading(): void {
		this.containerEl.createDiv({ cls: 'style-manager-loading' }, (wrapper) => {
			wrapper.createDiv({ cls: 'style-manager-search-row' }, (row) => {
				row.createDiv({
					cls: 'style-manager-skeleton style-manager-skeleton-search',
				});
			});

			for (let i = 0; i < 3; i++) {
				wrapper.createDiv({
					cls: 'style-manager-skeleton style-manager-skeleton-heading',
				});
				wrapper.createDiv(
					{ cls: 'style-manager-style-settings-container' },
					(container) => {
						for (let j = 0; j < 3; j++) {
							container.createDiv({
								cls: 'style-manager-skeleton style-manager-skeleton-item',
								attr: { style: `width: ${80 - j * 10}%` },
							});
						}
					}
				);
			}
		});
	}
}

import { App, Component, Menu, Platform, setIcon, setTooltip } from 'obsidian';

import { renderAccentColorSelect } from './AccentColorSelector';
import { IsolateModeHeader } from './IsolateModeHeader';
import { renderThemeSelect } from './ThemeSelector';

import { PreferencesKeys, StorageKeys } from '../../../constants';
import StyleManagerPlugin from '../../../main';
import { RefreshLevel } from '../../../types';
import { Logger } from '../../../utils/Logger';
import { ActiveTab } from '../../StyleManagerLayoutRenderer';
import { CSSEditorModal } from '../../modals/CSSEditorModal';
import { CreatePresetModal } from '../../modals/CreatePresetModal';
import { ImportPresetModal } from '../../modals/ImportPresetModal';
import { ResetSettingsModal } from '../../modals/ResetSettingsModal';

export interface SettingsHeaderOptions {
	activeTab: ActiveTab;
	onTabChange: (tab: ActiveTab) => void;
	onRerender: () => void;
	isolateModeHeader: IsolateModeHeader;
}

/**
 * Component for rendering the settings view header and toolbar.
 */
export class SettingsHeaderComponent extends Component {
	constructor(
		private app: App,
		private plugin: StyleManagerPlugin,
		private containerEl: HTMLElement,
		private options: SettingsHeaderOptions
	) {
		super();
	}

	onload(): void {
		this.render();
	}

	render(): void {
		const headerContainer = this.containerEl.createDiv(
			'style-manager-header-container'
		);
		if (Platform.isMobile) headerContainer.addClass('is-mobile');
		const tabContainer = headerContainer.createDiv(
			'style-manager-tabs-container'
		);
		if (Platform.isMobile) tabContainer.addClass('is-mobile');

		const scrollWrap = tabContainer.createDiv('style-manager-tabs-scroll-wrap');
		const activeTabEl = this.renderTabs(scrollWrap);

		if (activeTabEl) {
			this.scrollActiveTabIntoView(activeTabEl);
		}

		const updateFades = (): void => {
			const scrollLeft = scrollWrap.scrollLeft;
			const scrollRight =
				scrollWrap.scrollWidth - scrollWrap.clientWidth - scrollLeft;
			scrollWrap.toggleClass('has-start-fade', scrollLeft > 5);
			scrollWrap.toggleClass('has-end-fade', scrollRight > 5);
		};
		this.registerDomEvent(scrollWrap, 'scroll', () => updateFades());
		window.setTimeout(updateFades, 50);

		tabContainer.createDiv('style-manager-tab-spacer');

		const actionGroup = tabContainer.createDiv('style-manager-tab-actions');
		renderAccentColorSelect(this.plugin, actionGroup, () =>
			this.options.onRerender()
		);

		actionGroup.createDiv('style-manager-toolbar-separator');
		this.renderAppearanceToggle(actionGroup);
		actionGroup.createDiv('style-manager-toolbar-separator');
		renderThemeSelect(this.plugin, actionGroup, () =>
			this.options.onRerender()
		);
		actionGroup.createDiv('style-manager-toolbar-separator');
		this.options.isolateModeHeader.renderBadge(actionGroup);
		actionGroup.createDiv('style-manager-toolbar-separator');
		this.renderReloadButton(actionGroup);
		actionGroup.createDiv('style-manager-toolbar-separator');
		this.renderExtraMenu(actionGroup);
	}

	private renderTabs(tabContainer: HTMLElement): HTMLElement | null {
		const tabs: Array<{
			id: ActiveTab;
			label: string;
			icon: string;
			tooltip: string;
		}> = [
			{ id: 'styles', label: 'Styles', icon: 'paintbrush', tooltip: 'Styles' },
			{
				id: 'snippets',
				label: 'Snippets',
				icon: 'file-code',
				tooltip: 'CSS Snippets',
			},
			{
				id: 'theme',
				label: 'Themes',
				icon: 'paint-roller',
				tooltip: 'Theme builder',
			},
			{
				id: 'presets',
				label: 'Presets',
				icon: 'swatch-book',
				tooltip: 'Presets',
			},
			{
				id: 'isolate',
				label: 'Isolate',
				icon: 'lock-keyhole',
				tooltip: 'Isolate mode',
			},
			{
				id: 'preferences',
				label: 'Preferences',
				icon: 'settings',
				tooltip: 'Preferences',
			},
		];

		let activeTabEl: HTMLElement | null = null;

		tabs.forEach(({ id, label, icon, tooltip }) => {
			const tab = tabContainer.createDiv('style-manager-tab');
			setTooltip(tab, tooltip);
			setIcon(tab.createSpan('style-manager-tab-icon'), icon);
			tab.createSpan({ text: label, cls: 'style-manager-tab-text' });

			if (this.options.activeTab === id) {
				tab.addClass('is-active');
				activeTabEl = tab;
			}

			tab.onclick = (): void => {
				this.options.onTabChange(id);
			};
		});

		return activeTabEl;
	}

	private scrollActiveTabIntoView(activeTabEl: HTMLElement): void {
		// We use a small timeout to ensure the DOM is fully painted and dimensions are accurate
		window.setTimeout(() => {
			activeTabEl.scrollIntoView({
				behavior: 'auto',
				block: 'nearest',
				inline: 'center',
			});
		}, 50);
	}

	private renderAppearanceToggle(containerEl: HTMLElement): void {
		const appearance =
			(this.plugin.settingsService.getSetting(
				StorageKeys.APPEARANCE
			) as string) || 'system';
		let icon = '';
		let label = '';
		if (appearance === 'light') {
			icon = 'sun';
			label = 'Light mode';
		} else if (appearance === 'dark') {
			icon = 'moon';
			label = 'Dark mode';
		}

		const toggleBtn = containerEl.createDiv({
			cls: 'style-manager-icon-button',
		});
		if (appearance === 'light') toggleBtn.addClass('sun-toggle');
		else if (appearance === 'dark') toggleBtn.addClass('moon-toggle');
		setIcon(toggleBtn, icon);
		setTooltip(toggleBtn, label);
		toggleBtn.onclick = async (): Promise<void> => {
			const next = appearance === 'light' ? 'dark' : 'light';
			void this.plugin.settingsService.setSetting(StorageKeys.APPEARANCE, next, {
            				silentUI: true,
            			});
			this.plugin.settingsService.applyAppearance(
				next,
				!this.plugin.settingsService.isIsolateMode()
			);
			this.options.onRerender();
		};
	}

	private renderReloadButton(containerEl: HTMLElement): void {
		const reloadBtn = containerEl.createDiv({
			cls: 'style-manager-icon-button',
		});
		setIcon(reloadBtn, 'refresh-cw');
		setTooltip(reloadBtn, 'Update from shared locker (refresh)');
		reloadBtn.onclick = async (_e: MouseEvent): Promise<void> => {
			reloadBtn.addClass('is-loading');
			try {
				// Force Obsidian to re-scan the .obsidian/snippets folder for any external changes
				await this.plugin.settingsService.bridge.forceLoadSnippets();

				// Obsidian processes this asynchronously; wait a moment before re-rendering the UI
				await new Promise((resolve) => window.setTimeout(resolve, 200));

				await this.plugin.settingsService.refreshService.trigger(
					RefreshLevel.SYSTEM_RELOAD
				);
			} catch (e) {
				Logger.error('Style Manager | Shared update error:', e);
				this.plugin.settingsService.notifications.error(
					'Error: Could not update from Shared Locker.'
				);
			} finally {
				reloadBtn.removeClass('is-loading');
				this.options.onRerender();
			}
		};
	}

	private renderExtraMenu(containerEl: HTMLElement): void {
		const moreBtn = containerEl.createDiv({
			cls: 'style-manager-icon-button style-manager-tab-more-actions',
		});
		setIcon(moreBtn, 'more-vertical');
		setTooltip(moreBtn, 'More options');

		moreBtn.onclick = (_e: MouseEvent): void => {
			const menu = new Menu();

			menu.addItem((item) => {
				item
					.setTitle('Create preset...')
					.setIcon('plus')
					.onClick(() => {
						const prefixesArr = this.plugin.presetService.getPrefixesMetadata();
						new CreatePresetModal(
							this.app,
							this.plugin.presetService,
							prefixesArr,
							() => {
								this.options.onTabChange('presets');
								this.options.onRerender();
							}
						).open();
					});
			});

			menu.addItem((item) => {
				item
					.setTitle('Import preset...')
					.setIcon('download')
					.onClick(() => {
						new ImportPresetModal(this.app, this.plugin.presetService, () => {
							this.options.onTabChange('presets');
							this.options.onRerender();
						}).open();
					});
			});

			menu.addSeparator();

			menu.addItem((item) => {
				item
					.setTitle('Create snippet...')
					.setIcon('plus-circle')
					.onClick(async () => {
						const id =
							await this.plugin.settingsService.snippetService.createSnippet();

						const openModal =
							this.plugin.settingsService.settings[
								PreferencesKeys.OPEN_MODAL_ON_CREATE
							] !== false;
						if (openModal) {
							const useDefaultApp =
								this.plugin.app.loadLocalStorage(PreferencesKeys.OPEN_IN_DEFAULT_APP) ===
								'true';
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

						this.options.onTabChange('snippets');
						this.options.onRerender();
					});
			});

			menu.addSeparator();

			menu.addItem((item) => {
				item
					.setTitle('Reset styles')
					.setIcon('rotate-ccw')
					.setWarning(true)
					.onClick(() => {
						const sectionsWithData =
							this.plugin.settingsService.statsService.getResetSectionsData();

						new ResetSettingsModal(
							this.app,
							this.plugin,
							sectionsWithData,
							async (selectedIds) => {
								void this.plugin.settingsService.clearSections(selectedIds, false, {
                                									silentUI: true,
                                								});
								this.options.onRerender();
							}
						).open();
					});
			});

			const rect = moreBtn.getBoundingClientRect();
			menu.showAtPosition({ x: rect.left, y: rect.bottom });
		};
	}
}

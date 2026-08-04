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
	private accentSelector: { destroy: () => void } | null = null;

	constructor(
		private app: App,
		private plugin: StyleManagerPlugin,
		private containerEl: HTMLElement,
		private options: SettingsHeaderOptions
	) {
		super();
	}

	onunload(): void {
		if (this.accentSelector) {
			this.accentSelector.destroy();
			this.accentSelector = null;
		}
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
			if (!scrollWrap.isConnected) return;
			const scrollLeft = scrollWrap.scrollLeft;
			const scrollRight =
				scrollWrap.scrollWidth - scrollWrap.clientWidth - scrollLeft;
			scrollWrap.toggleClass('has-start-fade', scrollLeft > 5);
			scrollWrap.toggleClass('has-end-fade', scrollRight > 5);
		};
		this.registerDomEvent(scrollWrap, 'scroll', () => updateFades());
		const timer = window.setTimeout(updateFades, 50);
		this.register(() => window.clearTimeout(timer));

		tabContainer.createDiv('style-manager-tab-spacer');

		const actionGroup = tabContainer.createDiv('style-manager-tab-actions');
		this.accentSelector = renderAccentColorSelect(this.plugin, actionGroup, () =>
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

			if (id === 'styles') {
				const showBadge =
					(this.plugin.settingsService.sharedSettings[
						PreferencesKeys.SHOW_TAB_BADGE
					] as boolean | undefined) !== false;
				if (showBadge) {
					const activeSectionIds = new Set(
						this.plugin.settingsList.map((s) => s.id)
					);
					const settings = this.plugin.settingsService.settings;
					let count = 0;
					for (const key of Object.keys(settings)) {
						if (key.includes('@@')) {
							const sectionId = key.split('@@')[0];
							if (activeSectionIds.has(sectionId)) {
								count++;
							}
						}
					}
					if (count > 0) {
						const badge = tab.createSpan('style-manager-tab-badge');
						badge.setText(count.toString());
						setTooltip(badge, `${count} active style${count !== 1 ? 's' : ''}`);
					}
				}
			} else if (id === 'snippets') {
				const showBadge =
					(this.plugin.settingsService.sharedSettings[
						PreferencesKeys.SHOW_TAB_BADGE
					] as boolean | undefined) !== false;
				if (showBadge) {
					const count =
						this.plugin.settingsService.bridge.getEnabledSnippets().length;
					if (count > 0) {
						const badge = tab.createSpan('style-manager-tab-badge');
						badge.setText(count.toString());
						setTooltip(
							badge,
							`${count} active snippet${count !== 1 ? 's' : ''}`
						);
					}
				}
			}

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
		const timer = window.setTimeout(() => {
			if (activeTabEl.isConnected) {
				activeTabEl.scrollIntoView({
					behavior: 'auto',
					block: 'nearest',
					inline: 'center',
				});
			}
		}, 50);
		this.register(() => window.clearTimeout(timer));
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
			void this.plugin.settingsService.setSetting(
				StorageKeys.APPEARANCE,
				next,
				{
					silentUI: true,
				}
			);
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
		setTooltip(moreBtn, 'More actions');

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

						const openMode =
							(this.plugin.settingsService.settings[
								PreferencesKeys.SNIPPET_CREATE_OPEN_MODE
							] as string | undefined) ?? 'always-ask';

						const openInMode = async (
							mode: 'modal' | 'tab' | 'default-app' | 'none'
						): Promise<void> => {
							if (mode === 'none') return;
							if (mode === 'default-app') {
								const path =
									this.plugin.settingsService.bridge.getSnippetPath(id);
								(
									this.app as unknown as {
										openWithDefaultApp: (path: string) => void;
									}
								).openWithDefaultApp(path);
							} else if (mode === 'tab') {
								await this.plugin.activateCSSEditorView({
									type: 'Snippet',
									id,
								});
							} else {
								new CSSEditorModal(this.app, this.plugin, {
									type: 'Snippet',
									id,
								}).open();
							}
						};

						if (openMode === 'always-ask') {
							const { SnippetOpenModeModal } = await import(
								'../../modals/SnippetOpenModeModal'
							);
							new SnippetOpenModeModal(this.app, (mode) => {
								void openInMode(mode);
							}).open();
						} else {
							await openInMode(
								openMode as 'modal' | 'tab' | 'default-app' | 'none'
							);
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
								void this.plugin.settingsService.clearSections(
									selectedIds,
									false,
									{
										silentUI: true,
									}
								);
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

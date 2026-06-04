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
import { Command, Plugin, normalizePath } from 'obsidian';

import { ACCENT_COLOR_KEY, APPEARANCE_KEY, THEME_KEY } from './constants';
import {
	ClassToggle,
	ErrorList,
	ParsedCSSSettings,
	RefreshLevel,
	SettingsSeachResource,
	SnippetMetadata,
} from './types';

import { BackupService } from './application/BackupService';
import { BundleService } from './application/BundleService';
import { PresetImportService } from './application/PresetImportService';
import { PresetService } from './application/PresetService';
import { SettingsService } from './application/SettingsService';
import { StyleBlockService } from './application/StyleBlockService';
import { CSSParser } from './core/css/CSSParser';
import { StyleSheetManager } from './core/css/StyleSheetManager';
import './css/main.css';
import { ActiveTab } from './ui/StyleManagerLayoutRenderer';
import { StyleManagerSettingTab } from './ui/StyleManagerSettingTab';
import { StyleManagerView, viewType } from './ui/StyleManagerView';
import { SettingType } from './ui/components/base/types';
import { StatusBarManager } from './ui/elements/StatusBarManager';
import { CommandApplyPresetModal } from './ui/modals/CommandApplyPresetModal';
import { CreatePresetModal } from './ui/modals/CreatePresetModal';
import { ResetSettingsModal } from './ui/modals/ResetSettingsModal';
import { getDescription, getTitle } from './utils/CommonUtils';
import { Logger } from './utils/Logger';

export default class StyleManagerPlugin extends Plugin {
	settingsService: SettingsService;
	presetService: PresetService;
	bundleService: BundleService;
	presetImportService: PresetImportService;
	backupService: BackupService;
	styleBlockService: StyleBlockService;
	styleSheetManager: StyleSheetManager;
	statusBarManager: StatusBarManager;

	settingsList: ParsedCSSSettings[] = [];
	errorList: ErrorList = [];
	commandList: Command[] = [];

	// Snippet Tab Persistent State
	selectedSnippets: Set<string> = new Set();
	snippetMetadataMap: Map<string, SnippetMetadata> = new Map();
	lastSnippetSelectedIndex: number | null = null;

	debounceTimer = 0;
	public isInitialLoading = true;

	async onload(): Promise<void> {
		this.settingsService = new SettingsService(this);
		this.presetService = new PresetService(this);
		this.bundleService = new BundleService(this.settingsService.bridge);
		this.presetImportService = new PresetImportService(this);
		this.backupService = new BackupService(this);
		this.styleBlockService = new StyleBlockService();
		this.styleSheetManager = this.settingsService.styleSheetManager;
		this.statusBarManager = new StatusBarManager(this);

		this.settingsService.refreshService.setDelegates({
			parseCSS: () => this.parseCSS(),
			systemReload: (opts) => this.reloadAll(opts),
		});

		await this.settingsService.load();
		this.statusBarManager.init();

		this.settingsService.viewManager.registerSettingsTab(
			new StyleManagerSettingTab(this.app, this)
		);

		this.addCommand({
			id: 'style-manager-command-save-preset',
			name: 'Save current styles as preset',
			callback: () => {
				const prefixesArr = this.presetService.getPrefixesMetadata();
				new CreatePresetModal(this.app, this.presetService, prefixesArr, () => {
					this.settingsService.refreshService.trigger(RefreshLevel.UI_ONLY);
				}).open();
			},
		});

		this.addCommand({
			id: 'style-manager-command-apply-preset-shared',
			name: 'Apply preset to shared locker',
			callback: () => {
				new CommandApplyPresetModal(this.app, this.presetService, 'shared').open();
			},
		});

		this.addCommand({
			id: 'style-manager-command-apply-preset-this-device',
			name: 'Apply preset to this device (isolate)',
			callback: () => {
				new CommandApplyPresetModal(
					this.app,
					this.presetService,
					'this-device'
				).open();
			},
		});

		this.addCommand({
			id: 'style-manager-command-apply-preset-other-device',
			name: 'Apply preset to other device (isolate)',
			callback: () => {
				new CommandApplyPresetModal(
					this.app,
					this.presetService,
					'other-device'
				).open();
			},
		});

		this.addCommand({
			id: 'style-manager-command-reset-styles',
			name: 'Reset current styles',
			callback: () => {
				const sectionsWithData = this.settingsService.statsService.getResetSectionsData();
				new ResetSettingsModal(
					this.app,
					this,
					sectionsWithData,
					async (selectedIds) => {
						this.settingsService.clearSections(selectedIds);
						this.settingsService.refreshService.trigger(RefreshLevel.UI_ONLY);
					}
				).open();
			},
		});

		this.addCommand({
			id: 'style-manager-command-toggle-isolate-mode',
			name: 'Toggle isolate mode',
			callback: async () => {
				const current = this.settingsService.isIsolateMode();
				const next = !current;
				await this.settingsService.setIsolateMode(next);
			},
		});

		this.addCommand({
			id: 'style-manager-command-copy-accent-color',
			name: 'Copy current accent color',
			callback: async () => {
				const color = this.settingsService.settings[ACCENT_COLOR_KEY] || 
								this.settingsService.bridge.getNativeConfig('accentColor');
				if (color) {
					await navigator.clipboard.writeText(color as string);
					this.settingsService.notifications.util(`Accent color ${color} copied to clipboard`);
				} else {
					this.settingsService.notifications.error('No accent color set');
				}
			},
		});

		this.addSettingTab(
			(
				this.settingsService.viewManager as unknown as {
					settingsTab: import('obsidian').PluginSettingTab;
				}
			).settingsTab
		);

		this.registerView(viewType, (leaf) => new StyleManagerView(this, leaf));

		this.addCommand({
			id: 'style-manager-show-leaf',
			name: 'Show Style Manager',
			callback: () => {
				this.activateView();
			},
		});

		this.registerEvent(
			this.app.workspace.on('css-change', (data?: { source: string }) => {
				if (data?.source !== 'style-manager') {
					this.settingsService.refreshService.trigger(RefreshLevel.PARSE_CSS);

					if (this.settingsService.isApplyingTheme) return;

					const isIsolate = this.settingsService.isIsolateMode();
					const currentTheme =
						this.settingsService.bridge.getNativeConfig('cssTheme') || '';
					const desiredTheme =
						this.settingsService.settings[THEME_KEY] || 'default';
					const desiredNormalized =
						desiredTheme === 'default' || !desiredTheme ? '' : desiredTheme;

					if (isIsolate) {
						if (currentTheme !== '') {
							this.settingsService.applyTheme(desiredTheme as string, false);
						}
					}
					if (!isIsolate) {
						if (currentTheme !== desiredNormalized) {
							(async (): Promise<void> => {
								// Avoid enqueuing a load if we just performed one or are in the middle of a sync
								await this.settingsService.load();
							})();
						}
					}
				}
			})
		);

		this.registerEvent(
			this.app.workspace.on('parse-style-manager', () =>
				this.settingsService.refreshService.trigger(RefreshLevel.PARSE_CSS)
			)
		);
		this.registerEvent(
			this.app.workspace.on('parse-style-settings', () =>
				this.settingsService.refreshService.trigger(RefreshLevel.PARSE_CSS)
			)
		);

		this.settingsService.refreshService.trigger(RefreshLevel.PARSE_CSS);
		this.parseAllSnippetMetadata();

		this.app.workspace.onLayoutReady(() => {
			// Background Sync Guard: Check for external data.json changes every 4 seconds.
			// (Obsidian's vault.on('modify') doesn't trigger for .obsidian/ config files).
			this.registerInterval(
				window.setInterval(
					() => this.settingsService.checkForExternalChanges(),
					4000
				)
			);

			this.registerDomEvent(window, 'focus', () => {
				this.settingsService.checkForExternalChanges();
			});

			this.registerEvent(
				this.settingsService.on(
					'shared-update-detected',
					(data: { skipAdopt?: boolean }) => {
						this.settingsService.refreshService.trigger(
							RefreshLevel.SYSTEM_RELOAD,
							{ skipLoad: true, skipAdopt: data?.skipAdopt }
						);
					}
				)
			);

			if (this.settingsList) {
				this.settingsService.viewManager.updateData(
					this.settingsList,
					this.errorList
				);
			}
		});
	}

	parseCSS(): void {
		clearTimeout(this.debounceTimer);
		this.debounceTimer = activeWindow.setTimeout(async () => {
			// Pre-fetch async metadata first
			await this.parseAllSnippetMetadata();

			this.styleSheetManager.clearCache();
			await this.styleSheetManager.buildDiskMap();

			Logger.time('StyleManager:Parsing');
			const { settingsList, errorList } =
				this.styleSheetManager.getSettingsFromStyles();
			this.settingsList = settingsList;
			this.errorList = errorList;
			Logger.timeEnd('StyleManager:Parsing');

			this.isInitialLoading = false;

			this.refreshSettingsSearchIntegration();
			this.settingsService.viewManager.updateData(
				this.settingsList,
				this.errorList
			);

			this.settingsService.styleGenerator.setConfig(this.settingsList);

			// Refresh styles and UI to prevent visual flicker
			this.settingsService.refreshService.trigger(RefreshLevel.FULL_VISUAL);

			this.refreshSettingCommands();
		}, 250);
	}

	async parseAllSnippetMetadata(): Promise<void> {
		const customCss = (
			this.app as unknown as {
				customCss?: {
					snippets?: string[];
					getSnippetPath?: (id: string) => string;
				};
			}
		).customCss;
		if (!customCss) return;

		const snippetIds = customCss.snippets || [];
		const adapter = this.app.vault.adapter;

		for (const id of snippetIds) {
			const path = customCss.getSnippetPath
				? customCss.getSnippetPath(id)
				: normalizePath(`.obsidian/snippets/${id}.css`);
			try {
				if (await adapter.exists(path)) {
					const content = await adapter.read(path);
					const metadata = CSSParser.parseMetadata(content);
					if (metadata) {
						this.snippetMetadataMap.set(id, metadata);
					} else {
						this.snippetMetadataMap.delete(id);
					}
				}
			} catch (err) {
				Logger.error(
					`Style Manager | Failed to parse metadata for snippet ${id}:`,
					err
				);
			}
		}
	}

	private refreshSettingCommands(): void {
		for (const command of this.commandList) {
			this.app.commands?.removeCommand(command.id);
		}
		this.commandList = [];
		this.registerSettingCommands();
	}

	private refreshSettingsSearchIntegration(): void {
		this.registerSettingsToSettingsSearch();
	}

	async reloadAll(options?: {
		skipLoad?: boolean;
		skipAdopt?: boolean;
	}): Promise<void> {
		if (!options?.skipLoad) {
			await this.settingsService.reload();
		}

		const settings = this.settingsService.settings;

		// Apply core identity settings
		const persist = !this.settingsService.isIsolateMode();

		const theme = settings[THEME_KEY];
		if (theme) {
			await this.settingsService.applyTheme(theme as string, persist);
		}

		const appearance = settings[APPEARANCE_KEY];
		if (appearance) {
			this.settingsService.applyAppearance(appearance as string, persist);
		}

		const accent = settings[ACCENT_COLOR_KEY];
		if (accent) {
			this.settingsService.applyAccentColor(accent as string, persist);
		}

		await this.settingsService.syncSnippetState({
			skipAdopt: options?.skipAdopt,
		});
		this.settingsService.refreshService.trigger(RefreshLevel.PARSE_CSS);

		if (!options?.skipLoad) {
			this.settingsService.notifications.shared(
				'Style Manager synchronized with shared locker.'
			);
		}
	}

	private registerSettingsToSettingsSearch(): void {
		const onSettingsSearchLoaded = (): void => {
			if (
				(
					window as Window & {
						SettingsSearch?: {
							removeTabResources: (tab: string) => void;
							addResources: (...args: unknown[]) => void;
						};
					}
				).SettingsSearch
			) {
				const settingsSearch = (
					window as Window & {
						SettingsSearch: {
							removeTabResources: (tab: string) => void;
							addResources: (...args: unknown[]) => void;
						};
					}
				).SettingsSearch;
				settingsSearch.removeTabResources('obsidian-style-manager');

				for (const parsedCSSSetting of this.settingsList) {
					settingsSearch.addResources(
						...parsedCSSSetting.settings.map((x) => {
							const settingsSearchResource: SettingsSeachResource = {
								tab: 'obsidian-style-manager',
								name: 'Style Manager',
								text: getTitle(x) ?? '',
								desc: getDescription(x) ?? '',
							};
							return settingsSearchResource;
						})
					);
				}
			}
		};
		const internalApp = this.app as unknown as {
			plugins: { plugins: Record<string, { loaded: boolean }> };
		};
		if (internalApp.plugins.plugins['settings-search']?.loaded) {
			onSettingsSearchLoaded();
		} else {
			this.registerEvent(
				this.app.workspace.on('settings-search-loaded', () =>
					onSettingsSearchLoaded()
				)
			);
		}
	}

	private unregisterSettingsFromSettingsSearch(): void {
		const internalApp = this.app as unknown as {
			plugins: { plugins: Record<string, { loaded: boolean }> };
		};
		if (internalApp.plugins.plugins['settings-search']?.loaded) {
			window.SettingsSearch.removeTabResources('obsidian-style-manager');
		}
	}

	private registerSettingCommands(): void {
		for (const section of this.settingsList) {
			for (const setting of section.settings) {
				if (
					setting.type === SettingType.CLASS_TOGGLE &&
					(setting as ClassToggle).addCommand
				) {
					this.addClassToggleCommand(section, setting as ClassToggle);
				}
			}
		}
	}

	private addClassToggleCommand(
		section: ParsedCSSSettings,
		setting: ClassToggle
	): void {
		this.commandList.push(
			this.addCommand({
				id: `style-manager-class-toggle-${section.id}-${setting.id}`,
				name: `Toggle ${setting.title}`,
				callback: () => {
					const value = !(this.settingsService.getSetting(
						section.id,
						setting.id
					) as boolean);
					this.settingsService.setSetting(section.id, setting.id, value);
					this.settingsService.refreshService.trigger(RefreshLevel.UI_ONLY);
				},
			})
		);
	}

	onunload(): void {
		try {
			clearTimeout(this.debounceTimer);
			this.styleSheetManager.cleanup();
			this.settingsService.cleanup();
			this.statusBarManager.cleanup();
			this.unregisterSettingsFromSettingsSearch();

			this.selectedSnippets.clear();
			this.snippetMetadataMap.clear();
			this.commandList = [];
		} catch (e) {
			Logger.error('Style Manager | Error during plugin shutdown', e);
		}
	}

	deactivateView(): void {
		this.app.workspace.detachLeavesOfType(viewType);
	}

	async activateView(tab?: ActiveTab): Promise<void> {
		this.deactivateView();
		const leaf = this.app.workspace.getLeaf('tab');

		await leaf.setViewState({
			type: viewType,
			active: true,
		});

		const view = leaf.view as StyleManagerView;
		view.setSettings(this.settingsList, this.errorList);

		if (tab && view.settingsMarkup) {
			view.settingsMarkup.openTab(tab);
		}
	}
}

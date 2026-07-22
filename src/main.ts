import { Command, Notice, Plugin, normalizePath } from 'obsidian';

import { StorageKeys, ToolKeys } from './constants';
import {
	ClassToggle,
	ParseLogList,
	ParsedCSSSettings,
	RefreshLevel,
	SettingsSeachResource,
	SnippetMetadata,
} from './types';

import { BackupService } from './application/BackupService';
import { BundleService } from './application/BundleService';
import { PresetImportService } from './application/PresetImportService';
import { PresetScheduleService } from './application/PresetScheduleService';
import { PresetService } from './application/PresetService';
import { SettingsService } from './application/SettingsService';
import { StyleBlockService } from './application/StyleBlockService';
import { CSSParser } from './core/css/CSSParser';
import { StyleSheetManager } from './core/css/StyleSheetManager';
import './css/main.css';
import { BoxOutlineTool } from './tools/BoxOutlineTool';
import { CSSCompatibilityTool } from './tools/CSSCompatibilityTool';
import { ColorContrastCheckerTool } from './tools/ColorContrastCheckerTool';
import { CopyAccentColorTool } from './tools/CopyAccentColorTool';
import { FreezeObsidianTool } from './tools/FreezeObsidianTool';
import { GarbledTextTool } from './tools/GarbledTextTool';
import { LoremIpsumTool } from './tools/LoremIpsumTool';
import { MobileEmulationTool } from './tools/MobileEmulationTool';
import { TestNoticeTool } from './tools/TestNoticeTool';
import { ToggleDevToolsTool } from './tools/ToggleDevToolsTool';
import { ActiveTab } from './ui/StyleManagerLayoutRenderer';
import { StyleManagerSettingTab } from './ui/StyleManagerSettingTab';
import { StyleManagerView, viewType } from './ui/StyleManagerView';
import { SettingType } from './ui/components/base/types';
import { StatusBarManager } from './ui/elements/StatusBarManager';
import { ActiveSchedulesModal } from './ui/modals/ActiveSchedulesModal';
import { BoxOutlineColorPromptModal } from './ui/modals/BoxOutlineColorPromptModal';
import { ColorContrastCheckerModal } from './ui/modals/ColorContrastCheckerModal';
import { CommandApplyPresetModal } from './ui/modals/CommandApplyPresetModal';
import { CommandSchedulePresetModal } from './ui/modals/CommandSchedulePresetModal';
import { CreatePresetModal } from './ui/modals/CreatePresetModal';
import { FreezeDelayPromptModal } from './ui/modals/FreezeDelayPromptModal';
import { ImportPresetModal } from './ui/modals/ImportPresetModal';
import { LoremIpsumModal } from './ui/modals/LoremIpsumModal';
import { ReadmeModal } from './ui/modals/ReadmeModal';
import { ResetSettingsModal } from './ui/modals/ResetSettingsModal';
import { CSSEditorView, cssEditorViewType } from './ui/views/CSSEditorView';
import {
	ColorContrastCheckerView,
	colorContrastViewType,
} from './ui/views/ColorContrastCheckerView';
import { LoremIpsumView, loremIpsumViewType } from './ui/views/LoremIpsumView';
import { ReadmeView, readmeViewType } from './ui/views/ReadmeView';
import { getDescription, getTitle } from './utils/CommonUtils';
import { Logger } from './utils/Logger';

export default class StyleManagerPlugin extends Plugin {
	settingsService: SettingsService;
	presetService: PresetService;
	presetScheduleService: PresetScheduleService;
	bundleService: BundleService;
	presetImportService: PresetImportService;
	backupService: BackupService;
	styleBlockService: StyleBlockService;
	styleSheetManager: StyleSheetManager;
	statusBarManager: StatusBarManager;
	garbledTextTool: GarbledTextTool;
	boxOutlineTool: BoxOutlineTool;
	testNoticeTool: TestNoticeTool;
	copyAccentColorTool: CopyAccentColorTool;
	colorContrastCheckerTool: ColorContrastCheckerTool;
	cssCompatibilityTool: CSSCompatibilityTool;
	mobileEmulationTool: MobileEmulationTool;
	toggleDevToolsTool: ToggleDevToolsTool;
	freezeObsidianTool: FreezeObsidianTool;
	loremIpsumTool: LoremIpsumTool;

	settingsList: ParsedCSSSettings[] = [];
	parseLogs: ParseLogList = [];
	commandList: Command[] = [];

	selectedSnippets: Set<string> = new Set();
	snippetMetadataMap: Map<string, SnippetMetadata> = new Map();
	lastSnippetSelectedIndex: number | null = null;

	debounceTimer = 0;
	public isInitialLoading = true;

	setupMutationObserver(): void {
		const observer = new MutationObserver((mutations) => {
			if (
				activeDocument.body.querySelector('.style-settings-ref') &&
				activeDocument.body.querySelector('.style-manager-ref')
			) {
				activeDocument.body.classList.add('sm-conflict-warning');
			} else {
				activeDocument.body.classList.remove('sm-conflict-warning');
			}

			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						const el = node as HTMLElement;
						if (el.classList && el.classList.contains('style-manager-plugin')) {
							const settings = el.findAll('.setting-item');
							settings.forEach((setting) => {
								if (
									setting.querySelector(
										'input[type="text"], input[type="range"], select, textarea'
									)
								) {
									setting.classList.add('sm-has-input');
								}
							});
						} else if (el.findAll) {
							const plugins = el.findAll('.style-manager-plugin');
							plugins.forEach((plugin) => {
								const settings = plugin.findAll('.setting-item');
								settings.forEach((setting) => {
									if (
										setting.querySelector(
											'input[type="text"], input[type="range"], select, textarea'
										)
									) {
										setting.classList.add('sm-has-input');
									}
								});
							});

							if (
								el.classList &&
								el.classList.contains('setting-item') &&
								el.closest('.style-manager-plugin')
							) {
								if (
									el.querySelector(
										'input[type="text"], input[type="range"], select, textarea'
									)
								) {
									el.classList.add('sm-has-input');
								}
							}
						}
					}
				});
			});
		});
		observer.observe(activeDocument.body, { childList: true, subtree: true });
	}

	async onload(): Promise<void> {
		this.settingsService = new SettingsService(this);
		this.presetService = new PresetService(this);
		this.presetScheduleService = new PresetScheduleService(this);
		this.bundleService = new BundleService(this.settingsService.bridge);
		this.presetImportService = new PresetImportService(this);
		this.backupService = new BackupService(this);
		this.styleBlockService = new StyleBlockService(this);
		this.styleSheetManager = this.settingsService.styleSheetManager;
		this.statusBarManager = new StatusBarManager(this);
		this.garbledTextTool = new GarbledTextTool(this);
		this.boxOutlineTool = new BoxOutlineTool(this);
		this.testNoticeTool = new TestNoticeTool(this);
		this.colorContrastCheckerTool = new ColorContrastCheckerTool(this);
		this.copyAccentColorTool = new CopyAccentColorTool(this);
		this.cssCompatibilityTool = new CSSCompatibilityTool(this);
		this.mobileEmulationTool = new MobileEmulationTool(this);
		this.toggleDevToolsTool = new ToggleDevToolsTool(this);
		this.freezeObsidianTool = new FreezeObsidianTool(this);
		this.loremIpsumTool = new LoremIpsumTool(this);

		this.settingsService.refreshService.setDelegates({
			parseCSS: () => this.parseCSS(),
			systemReload: (opts) => this.reloadAll(opts),
		});

		await this.settingsService.load();
		this.statusBarManager.init();
		this.setupMutationObserver();

		this.settingsService.viewManager.registerSettingsTab(
			new StyleManagerSettingTab(this.app, this)
		);

		this.addCommand({
			id: 'view-active-schedules',
			name: 'View active schedules',
			callback: () => {
				new ActiveSchedulesModal(this.app, this).open();
			},
		});

		this.addCommand({
			id: 'set-preset-schedule',
			name: 'Set schedule for a preset',
			callback: () => {
				new CommandSchedulePresetModal(this.app, this.presetService).open();
			},
		});

		this.addCommand({
			id: 'save-preset',
			name: 'Save current styles as preset',
			callback: () => {
				const prefixesArr = this.presetService.getPrefixesMetadata();
				new CreatePresetModal(
					this.app,
					this.presetService,
					prefixesArr,
					(): void => {
						{
							void this.settingsService.refreshService.trigger(
								RefreshLevel.UI_ONLY
							);
						}
					}
				).open();
			},
		});

		this.addCommand({
			id: 'apply-preset-shared',
			name: 'Apply preset to shared locker',
			callback: () => {
				new CommandApplyPresetModal(
					this.app,
					this.presetService,
					'shared'
				).open();
			},
		});

		this.addCommand({
			id: 'apply-preset-this-device',
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
			id: 'apply-preset-other-device',
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
			id: 'reset-styles',
			name: 'Reset current styles',
			callback: () => {
				const sectionsWithData =
					this.settingsService.statsService.getResetSectionsData();
				new ResetSettingsModal(
					this.app,
					this,
					sectionsWithData,
					async (selectedIds): Promise<void> => {
						await this.settingsService.clearSections(selectedIds, false, {
							silentUI: true,
						});
						await this.settingsService.refreshService.trigger(
							RefreshLevel.UI_ONLY
						);
					}
				).open();
			},
		});

		this.addCommand({
			id: 'toggle-isolate-mode',
			name: 'Toggle isolate mode',
			callback: (): void => {
				void (async (): Promise<void> => {
					const current = this.settingsService.isIsolateMode();
					const next = !current;
					await this.settingsService.setIsolateMode(next);
				})();
			},
		});

		this.addCommand({
			id: 'copy-accent-color',
			name: 'Copy current accent color',
			callback: (): void => {
				void (async (): Promise<void> => {
					void this.copyAccentColorTool.copy();
				})();
			},
		});

		this.addCommand({
			id: 'color-contrast-checker',
			name: 'Color contrast checker',
			callback: () => {
				if (this.isContrastViewActive()) {
					return;
				}
				new ColorContrastCheckerModal(this.app, this).open();
			},
		});

		this.addCommand({
			id: 'css-compatibility',
			name: 'Obsidian tech stack versions',
			callback: () => this.cssCompatibilityTool.show(),
		});

		this.addCommand({
			id: 'toggle-garbled-text',
			name: 'Toggle garbled text',
			callback: () => this.garbledTextTool.toggle(),
		});

		this.addCommand({
			id: 'toggle-box-outlines',
			name: 'Toggle CSS box outlines for debugging',
			callback: () => this.boxOutlineTool.toggle(),
		});

		this.addCommand({
			id: 'change-box-outline-color',
			name: 'Change CSS box outline color',
			callback: () => {
				const currentColor = (this.settingsService.getSetting(
					ToolKeys.TOOL_BOX_OUTLINE_COLOR
				) ?? 'red') as string;
				new BoxOutlineColorPromptModal(this.app, currentColor, (value) => {
					if (value !== null) {
						void this.settingsService.setSetting(
							ToolKeys.TOOL_BOX_OUTLINE_COLOR,
							value,
							{
								silentUI: true,
							}
						);
						this.boxOutlineTool.updateColor();
						new Notice(` CSS Box outline color set to ${value}`);
					}
				}).open();
			},
		});

		this.addCommand({
			id: 'toggle-devtools',
			name: 'Toggle devtools',
			callback: () => this.toggleDevToolsTool.toggle(),
		});

		this.addCommand({
			id: 'freeze-obsidian',
			name: 'Freeze Obsidian',
			callback: () => this.freezeObsidianTool.freeze(),
		});

		this.addCommand({
			id: 'change-freeze-delay',
			name: 'Change freeze Obsidian delay',
			callback: () => {
				new FreezeDelayPromptModal(this.app, (value) => {
					if (value !== null) {
						void this.settingsService.setSetting(
							ToolKeys.TOOL_FREEZE_DELAY,
							value,
							{
								silentUI: true,
							}
						);
						new Notice(`Freeze Obsidian delay set to ${value}s`);
					}
				}).open();
			},
		});

		this.addCommand({
			id: 'toggle-mobile-emulation',
			name: 'Toggle mobile emulation',
			callback: () => this.mobileEmulationTool.toggle(),
		});

		this.addCommand({
			id: 'show-test-notice',
			name: 'Show test notice',
			callback: () => this.testNoticeTool.show(),
		});

		this.addCommand({
			id: 'lorem-ipsum',
			name: 'Lorem ipsum generator',
			callback: () => {
				if (this.isLoremIpsumViewActive()) {
					return;
				}
				new LoremIpsumModal(this.app, this).open();
			},
		});

		this.addCommand({
			id: 'show-readme',
			name: 'Show readme',
			callback: () => {
				if (this.isReadmeViewActive()) {
					return;
				}
				new ReadmeModal(this.app, this).open();
			},
		});

		this.addCommand({
			id: 'import-preset',
			name: 'Import preset',
			callback: () => {
				new ImportPresetModal(
					this.app,
					this.presetService,
					(): void => {
						void this.settingsService.refreshService.trigger(
							RefreshLevel.UI_ONLY
						);
					}
				).open();
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
		this.registerView(
			colorContrastViewType,
			(leaf) => new ColorContrastCheckerView(leaf)
		);
		this.registerView(
			cssEditorViewType,
			(leaf) => new CSSEditorView(leaf, this)
		);
		this.registerView(loremIpsumViewType, (leaf) => new LoremIpsumView(leaf));
		this.registerView(readmeViewType, (leaf) => new ReadmeView(leaf));

		this.addCommand({
			id: 'show-leaf',
			name: 'Show panel',
			callback: () => {
				void this.activateView();
			},
		});

		this.registerEvent(
			this.app.workspace.on('css-change', (data?: { source: string }) => {
				if (data?.source !== 'style-manager') {
					void this.settingsService.refreshService.trigger(
						RefreshLevel.PARSE_CSS
					);

					if (!this.settingsService.isApplyingTheme) {
						const isIsolate = this.settingsService.isIsolateMode();
						const currentEnabled =
							this.settingsService.bridge.getEnabledSnippets();
						const lockerEnabled =
							(this.settingsService.settings[
								StorageKeys.SNIPPETS
							] as string[]) || [];

						const currentString = JSON.stringify([...currentEnabled].sort());
						const lockerString = JSON.stringify([...lockerEnabled].sort());

						if (currentString !== lockerString) {
							Logger.log(
								`Style Manager | Snippets: Adopting native snippet change (${isIsolate ? 'isolate' : 'shared'}).`
							);
							void this.settingsService.setSetting(
								StorageKeys.SNIPPETS,
								currentEnabled,
								{
									silentUI: false,
									target: isIsolate ? 'isolate' : 'shared',
								}
							);
						}
					}

					if (this.settingsService.isApplyingTheme) return;

					const isIsolate = this.settingsService.isIsolateMode();
					const currentTheme =
						this.settingsService.bridge.getNativeConfig('cssTheme') || '';
					const desiredTheme =
						this.settingsService.settings[StorageKeys.THEME] || 'default';
					const desiredNormalized =
						desiredTheme === 'default' || !desiredTheme ? '' : desiredTheme;

					if (isIsolate) {
						if (currentTheme !== '') {
							void this.settingsService.applyTheme(
								desiredTheme as string,
								false
							);
						}
					}
					if (!isIsolate) {
						if (currentTheme !== desiredNormalized) {
							void (async (): Promise<void> => {
								// Avoid enqueuing a load if we just performed one or are in the middle of a sync
								await this.settingsService.load();
							})();
						}
					}
				}
			})
		);

		this.registerEvent(
			this.app.workspace.on('parse-style-manager', (): void => {
				void this.settingsService.refreshService.trigger(
					RefreshLevel.PARSE_CSS
				);
			})
		);
		this.registerEvent(
			this.app.workspace.on('parse-style-settings', (): void => {
				void this.settingsService.refreshService.trigger(
					RefreshLevel.PARSE_CSS
				);
			})
		);

		void this.settingsService.refreshService.trigger(RefreshLevel.PARSE_CSS);
		void this.parseAllSnippetMetadata();

		this.app.workspace.onLayoutReady(() => {
			this.registerInterval(
				window.setInterval((): void => {
					void this.settingsService.checkForExternalChanges();
				}, 4000)
			);

			this.registerDomEvent(window, 'focus', () => {
				void this.settingsService.checkForExternalChanges();
			});

			this.registerEvent(
				this.settingsService.on(
					'shared-update-detected',
					(data: { skipAdopt?: boolean }) => {
						void this.settingsService.refreshService.trigger(
							RefreshLevel.SYSTEM_RELOAD,
							{ skipLoad: true, skipAdopt: data?.skipAdopt }
						);
					}
				)
			);

			if (this.settingsList) {
				this.settingsService.viewManager.updateData(
					this.settingsList,
					this.parseLogs
				);
			}

			this.presetScheduleService.start();
		});
	}

	parseCSS(): void {
		window.clearTimeout(this.debounceTimer);
		this.debounceTimer = window.setTimeout((): void => {
			void (async (): Promise<void> => {
				// Pre-fetch async metadata first
				await this.parseAllSnippetMetadata();

				this.styleSheetManager.clearCache();
				await this.styleSheetManager.buildDiskMap();

				Logger.time('StyleManager:Parsing');
				const { settingsList, parseLogs } =
					this.styleSheetManager.getSettingsFromStyles();
				this.settingsList = settingsList;
				this.parseLogs = parseLogs;
				Logger.timeEnd('StyleManager:Parsing');

				this.isInitialLoading = false;

				this.refreshSettingsSearchIntegration();
				this.settingsService.viewManager.updateData(
					this.settingsList,
					this.parseLogs
				);

				this.settingsService.styleGenerator.setConfig(this.settingsList);

				void this.settingsService.refreshService.trigger(
					RefreshLevel.FULL_VISUAL
				);

				this.refreshSettingCommands();
			})();
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

		const theme = settings[StorageKeys.THEME];
		if (theme) {
			await this.settingsService.applyTheme(theme as string, persist);
		}

		const appearance = settings[StorageKeys.APPEARANCE];
		if (appearance) {
			this.settingsService.applyAppearance(appearance as string, persist);
		}

		const accent = settings[StorageKeys.ACCENT_COLOR];
		if (accent) {
			this.settingsService.applyAccentColor(accent as string, persist);
		}

		await this.settingsService.syncSnippetState({
			skipAdopt: options?.skipAdopt,
		});
		void this.settingsService.refreshService.trigger(RefreshLevel.PARSE_CSS);

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
				id: `class-toggle-${section.id}-${setting.id}`,
				name: `Toggle ${setting.title}`,
				callback: () => {
					const value = !(this.settingsService.getSetting(
						section.id,
						setting.id
					) as boolean);
					const defaultValue = setting.default ?? false;
					if (value === defaultValue) {
						void this.settingsService.clearSetting(section.id, setting.id);
					} else {
						void this.settingsService.setSetting(section.id, setting.id, value);
					}
				},
			})
		);
	}

	onunload(): void {
		try {
			this.presetScheduleService.stop();
			window.clearTimeout(this.debounceTimer);
			this.styleSheetManager.cleanup();
			this.settingsService.cleanup();
			this.statusBarManager.cleanup();
			this.unregisterSettingsFromSettingsSearch();

			// Clean up shared color picker wrapper div injected into the document body.
			// Matches how it was created in ColorUtils.getColorPickerConfig.
			activeDocument
				.querySelectorAll('.style-manager-color-picker-wrapper')
				.forEach((el) => el.remove());

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

	deactivateContrastView(): void {
		this.app.workspace.detachLeavesOfType(colorContrastViewType);
	}

	deactivateCSSEditorView(): void {
		this.app.workspace.detachLeavesOfType(cssEditorViewType);
	}

	deactivateLoremIpsumView(): void {
		this.app.workspace.detachLeavesOfType(loremIpsumViewType);
	}

	deactivateReadmeView(): void {
		this.app.workspace.detachLeavesOfType(readmeViewType);
	}

	isContrastViewActive(): boolean {
		return this.app.workspace.getLeavesOfType(colorContrastViewType).length > 0;
	}

	isLoremIpsumViewActive(): boolean {
		return this.app.workspace.getLeavesOfType(loremIpsumViewType).length > 0;
	}

	isReadmeViewActive(): boolean {
		return this.app.workspace.getLeavesOfType(readmeViewType).length > 0;
	}

	async activateView(tab?: ActiveTab): Promise<void> {
		this.deactivateView();
		const leaf = this.app.workspace.getLeaf('tab');

		await leaf.setViewState({
			type: viewType,
			active: true,
		});

		const view = leaf.view as StyleManagerView;
		view.setSettings(this.settingsList, this.parseLogs);

		if (tab && view.settingsMarkup) {
			view.settingsMarkup.openTab(tab);
		}
	}

	async activateContrastView(): Promise<void> {
		this.deactivateContrastView();
		const leaf = this.app.workspace.getLeaf('tab');

		await leaf.setViewState({
			type: colorContrastViewType,
			active: true,
		});
	}

	async activateCSSEditorView(source: {
		type: string;
		id: string;
		readOnly?: boolean;
	}): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType(cssEditorViewType);
		for (const leaf of leaves) {
			const state = leaf.view.getState();
			if (
				state.source &&
				(state.source as Record<string, unknown>).type === source.type &&
				(state.source as Record<string, unknown>).id === source.id
			) {
				this.app.workspace.setActiveLeaf(leaf, { focus: true });
				return;
			}
		}

		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.setViewState({
			type: cssEditorViewType,
			active: true,
			state: { source },
		});
	}

	async activateLoremIpsumView(): Promise<void> {
		this.deactivateLoremIpsumView();
		const leaf = this.app.workspace.getLeaf('tab');

		await leaf.setViewState({
			type: loremIpsumViewType,
			active: true,
		});
	}

	async activateReadmeView(): Promise<void> {
		this.deactivateReadmeView();
		const leaf = this.app.workspace.getLeaf('tab');

		await leaf.setViewState({
			type: readmeViewType,
			active: true,
		});
	}
}

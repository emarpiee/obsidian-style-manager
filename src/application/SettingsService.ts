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
import { Events } from 'obsidian';

import {
	ACCENT_COLOR_KEY,
	APPEARANCE_KEY,
	SNIPPETS_KEY,
	THEME_KEY,
	ENABLE_CONSOLE_LOGGING_KEY,
} from '../constants';
import { Logger } from '../utils/Logger';
import type StyleManagerPlugin from '../main';
import { ParsedCSSSettings, RefreshLevel, SettingValue, StyleManagerSettings } from '../types';
import { IdentityService } from './IdentityService';
import { IsolateModeService } from './IsolateModeService';
import { NotificationService } from './NotificationService';
import { PersistenceService } from './PersistenceService';
import { SharedStateService } from './SharedStateService';
import { SnippetService } from './SnippetService';
import { StatsService } from './StatsService';
import { ThemeBuilderService } from './ThemeBuilderService';
import { ThemeService } from './ThemeService';

import { StyleSheetManager } from '../core/css/StyleSheetManager';
import { RefreshService } from '../core/style/RefreshService';
import { StyleGenerator } from '../core/style/StyleGenerator';
import { ObsidianBridge } from '../infrastructure/bridge/ObsidianBridge';
import { DeviceBucketStore } from '../infrastructure/storage/DeviceBucketStore';
import { SharedStore } from '../infrastructure/storage/SharedStore';
import { ViewManager } from '../ui/ViewManager';
import { DataUtils } from '../utils/CommonUtils';

export { THEME_KEY, APPEARANCE_KEY, SNIPPETS_KEY, ACCENT_COLOR_KEY };

export class SettingsService extends Events {
	public sharedSettings: StyleManagerSettings = {};
	private _mergedSettings: StyleManagerSettings = {};

	public identity: IdentityService;
	public styleGenerator: StyleGenerator;
	public styleSheetManager: StyleSheetManager;
	public isolateModeService: IsolateModeService;
	public viewManager: ViewManager;
	public bridge: ObsidianBridge;
	private sharedStore: SharedStore;
	private deviceStore: DeviceBucketStore;
	private themeService: ThemeService;

	public get isSafeToSave(): boolean {
		return this.persistenceService?.isSafeToSave || false;
	}
	private hasPerformedInitialBackup: boolean = false;
	private sharedStateService: SharedStateService;
	public notifications: NotificationService;
	public snippetService: SnippetService;
	public refreshService: RefreshService;
	public persistenceService: PersistenceService;
	public statsService: StatsService;
	public themeBuilderService: ThemeBuilderService;

	public get deviceId(): string {
		return this.identity.deviceId;
	}
	public get deviceName(): string {
		return this.identity.deviceName;
	}
	public get isNewIdentity(): boolean {
		return this.identity.isNewIdentity;
	}
	public get settings(): StyleManagerSettings {
		return this._mergedSettings;
	}
	public get isApplyingTheme(): boolean {
		return this.themeService.isApplyingTheme;
	}

	constructor(public plugin: StyleManagerPlugin) {
		super();
		this.bridge = new ObsidianBridge(plugin.app);
		this.sharedStore = new SharedStore(plugin);
		this.styleSheetManager = new StyleSheetManager(this.bridge);
		this.styleGenerator = new StyleGenerator(
			this.plugin,
			this.bridge,
			() => this.settings
		);

		this.viewManager = new ViewManager(plugin.app);
		this.sharedStateService = new SharedStateService();
		this.notifications = new NotificationService(() => this.settings);

		this.themeService = new ThemeService({
			bridge: this.bridge,
			isIsolateMode: (): boolean => this.isolateModeService.isIsolateMode(),
			getSetting: (key): SettingValue | undefined => this.settings[key],
			setSetting: (key, val): Promise<void> => this.setMetaSetting(key, val),
			triggerEvent: (name): void => this.bridge.triggerEvent(name),
			notifications: this.notifications,
		});

		this.isolateModeService = new IsolateModeService({
			getSharedSettings: (): typeof this.sharedSettings => this.sharedSettings,
			setSharedSettings: (s): void => {
				this.sharedSettings = s;
			},
			save: (opts): Promise<void> => this.save(opts),
			updateMerged: (): void => this.updateMerged(),
			applyTheme: (t, p): Promise<void> => this.applyTheme(t, p),
			applyAppearance: (m, p): void => this.applyAppearance(m, p),
			applyAccentColor: (c, p): void => this.applyAccentColor(c, p),
			triggerGlobal: (evt: string): void => {
				this.trigger(evt);
			},
			themeService: this.themeService,
			bridge: this.bridge,
			styleGenerator: this.styleGenerator,
			viewManager: this.viewManager,
			plugin: this.plugin,
		});

		this.identity = new IdentityService({
			getDevices: (): typeof this.sharedSettings.__devices =>
				this.sharedSettings.__devices,
			setDevices: (devices): void => {
				this.sharedSettings.__devices = devices;
			},
			clearIsolateSettings: (): void => {
				this.isolateModeService.isolateSettings = {};
			},
			save: (): Promise<void> => this.save(),
			reload: (): Promise<void> => this.reload(),
			updateMerged: (): void => this.updateMerged(),
			rerenderAll: (): void => {
				this.refreshService.trigger(RefreshLevel.UI_ONLY);
			},
			trigger: (event: string): void => {
				this.trigger(event);
			},
			getPlugin: (): typeof this.plugin => this.plugin,
		});

		this.refreshService = new RefreshService(
			this.styleGenerator,
			this.viewManager
		);

		this.statsService = new StatsService({
			getSettings: (): StyleManagerSettings => this.settings,
			getSharedSettings: (): typeof this.sharedSettings => this.sharedSettings,
			isolateModeService: this.isolateModeService,
			styleGenerator: this.styleGenerator,
			styleSheetManager: this.styleSheetManager,
			getSettingsList: (): ParsedCSSSettings[] => this.plugin.settingsList,
		});

		this.persistenceService = new PersistenceService({
			sharedStore: this.sharedStore,
			sharedStateService: this.sharedStateService,
			notifications: this.notifications,
			getDeviceId: (): string => this.deviceId,
			getDeviceName: (): string => this.deviceName,
			getSharedSettings: (): typeof this.sharedSettings => this.sharedSettings,
			setSharedSettings: (s): void => {
				this.sharedSettings = s;
			},
			getIsolateSettings: (): StyleManagerSettings =>
				this.isolateModeService.isolateSettings,
			getIsIsolateMode: (): boolean => this.isolateModeService.isIsolateMode(),
			onDataLoaded: async (data, isShared, force): Promise<void> => {
				await this.onDataLoaded(data, isShared, force);
			},
		});

		this.snippetService = new SnippetService({
			plugin: this.plugin,
			bridge: this.bridge,
			viewManager: this.viewManager,
			getIsolateMode: (): boolean => this.isolateModeService.isIsolateMode(),
			getLockerSettings: (): string[] =>
				this.isolateModeService.isIsolateMode()
					? (this.isolateModeService.isolateSettings[
							SNIPPETS_KEY
						] as string[]) || []
					: (this.sharedSettings[SNIPPETS_KEY] as string[]) || [],
			setLockerSettings: async (snippets): Promise<void> => {
				this.sharedSettings[SNIPPETS_KEY] = snippets;
				this.updateMerged();
				await this.save({ silent: true });
			},
		});

		this.themeBuilderService = new ThemeBuilderService(
			this.plugin.app,
			this.bridge,
			this.notifications
		);

		this.deviceStore = new DeviceBucketStore(this.sharedStore, this.deviceId);
	}

	public getModifiedCount(sectionId: string): number {
		return this.statsService.getModifiedCount(sectionId);
	}

	public getTotalModifiedCount(): number {
		return this.statsService.getTotalModifiedCount();
	}

	public getCSSVar(
		id: string
	): { light: string; dark: string; current: string } | undefined {
		return this.styleSheetManager.getCSSVar(id);
	}

	public async save(options?: {
		silent?: boolean;
		skipMerge?: boolean;
		force?: boolean;
	}): Promise<void> {
		return this.persistenceService.save(options);
	}

	public setSafeToSave(safe: boolean): void {
		this.persistenceService.setSafeToSave(safe);
	}

	public async load(forcePull: boolean = false): Promise<void> {
		return this.persistenceService.load(forcePull);
	}

	public async onDataLoaded(
		loadedData: StyleManagerSettings | null,
		isExternalShared: boolean,
		forcePull: boolean
	): Promise<void> {
		const oldDevices = DataUtils.getCanonicalString(
			this.sharedSettings.__devices || {}
		);
		const oldTheme = this.sharedSettings[THEME_KEY];
		const oldApp = this.sharedSettings[APPEARANCE_KEY];
		const oldAccent = this.sharedSettings[ACCENT_COLOR_KEY];
		const oldVersion = Number(this.sharedSettings.__shared_version) || 0;

		if (loadedData === null && !(await this.sharedStore.hasBackup())) {
			this.sharedSettings = {};
			this.identity.isNewIdentity = true;
		} else if (loadedData !== null) {
			this.sharedSettings = loadedData || {};
		}

		const newDevices = DataUtils.getCanonicalString(
			this.sharedSettings.__devices || {}
		);
		const rawBucket = this.sharedSettings.__devices?.[this.deviceId];
		const bucket = rawBucket
			? {
					isIsolateMode: rawBucket.isIsolateMode || false,
					isolateSettings: { ...rawBucket.isolateSettings },
				}
			: { isIsolateMode: false, isolateSettings: {} };
		this.isolateModeService.loadState(
			bucket.isIsolateMode,
			bucket.isolateSettings
		);
		this.identity.syncDeviceName();

		const wasAdopted =
			forcePull || isExternalShared
				? false
				: this.themeService.adoptNativeSettings(
						(key) => this.sharedSettings[key],
						(key, val) => {
							this.sharedSettings[key] = val;
						}
					);

		this.updateMerged();

		// Trigger loudest refresh after data is fully merged and ready for the UI
		const newVersion = Number(this.sharedSettings.__shared_version) || 0;
		if (
			(isExternalShared ||
				forcePull ||
				(newVersion !== oldVersion && newVersion > 0)) &&
			this.isSafeToSave
		) {
			const newTheme = this.sharedSettings[THEME_KEY];
			const newApp = this.sharedSettings[APPEARANCE_KEY];
			const newAccent = this.sharedSettings[ACCENT_COLOR_KEY];

			if (
				oldTheme !== newTheme ||
				oldApp !== newApp ||
				oldAccent !== newAccent ||
				oldVersion !== newVersion
			) {
				Logger.log(
					`Style Manager | Sync detected: v${oldVersion} -> v${newVersion}`
				);
				this.notifications.shared(
					`Style Manager: Styles shared (${newVersion})`
				);
				this.trigger('shared-update-detected', { skipAdopt: true });
			}
		}

		if (oldDevices !== newDevices) {
			this.trigger('device-lockers-updated');
		}

		this.installPatches();
		this.themeService.hideNativeTheme();
		this.themeService.startBodyGuard();

		const theme = this.settings[THEME_KEY];
		if (theme) {
			const shouldPersist =
				!this.isolateModeService.isIsolateMode() && !wasAdopted;
			this.applyTheme(theme as string, shouldPersist);
		}

		this.applyAppearance(this.settings[APPEARANCE_KEY] as string);

		const persistAccent = !this.isolateModeService.isIsolateMode();
		this.applyAccentColor(
			this.settings[ACCENT_COLOR_KEY] as string,
			persistAccent
		);

		if (wasAdopted && this.isSafeToSave) {
			this.save({ silent: true });
		}
	}

	private updateMerged(): void {
		const isIsolate = this.isolateModeService.isIsolateMode();
		const merged = { ...this.sharedSettings };
		delete merged.__devices;

		if (isIsolate) {
			Object.keys(merged).forEach((key) => {
				if (
					key.includes('@@') ||
					key === THEME_KEY ||
					key === APPEARANCE_KEY ||
					key === ACCENT_COLOR_KEY
				) {
					delete merged[key];
				}
			});
			Object.assign(merged, this.isolateModeService.isolateSettings);
		}

		this._mergedSettings = merged;
		Logger.setEnabled(this._mergedSettings[ENABLE_CONSOLE_LOGGING_KEY] === true);
	}

	async applyTheme(themeName: string, persist: boolean): Promise<void> {
		await this.themeService.applyTheme(themeName, persist);
	}

	applyAppearance(mode: string, persist: boolean = false): void {
		this.themeService.applyAppearance(mode, persist);
	}

	applyAccentColor(color: string, persist: boolean = false): void {
		this.themeService.applyAccentColor(color, persist);
	}

	/**
	 * Visually applies a list of enabled snippets to Obsidian.
	 * In Isolate Mode, it overrides memory only. In Sync Mode, it writes to disk.
	 */
	public async applySnippets(
		snippetList: string[],
		isIsolate: boolean
	): Promise<void> {
		return this.snippetService.applySnippets(snippetList, isIsolate);
	}

	private installPatches(): void {
		this.themeService.installPatches();
	}

	private uninstallPatches(): void {
		this.themeService.uninstallPatches();
	}

	async reload(): Promise<void> {
		await this.load(true);
		this.refreshService.trigger(RefreshLevel.STYLES_ONLY);
	}

	public async checkForExternalChanges(): Promise<boolean | undefined> {
		return this.persistenceService.checkForExternalChanges();
	}

	/**
	 * Reconciles Obsidian's in-memory snippet state with the appearance.json file on disk.
	 * This fixes the issue where Sync updates the file but core doesn't apply the changes.
	 */
	public async syncSnippetState(options?: {
		skipAdopt?: boolean;
	}): Promise<void> {
		return this.snippetService.syncSnippetState(options);
	}

	async applySettingsOverlay(
		settings: Record<string, unknown>,
		isIsolate: boolean
	): Promise<void> {
		this.isolateModeService.setIsolateMode(isIsolate);
		await this.applySettingsUpdate(settings, { persistNative: !isIsolate });

		if (!isIsolate) {
			await this.refreshService.trigger(RefreshLevel.STYLES_ONLY, {
				skipAdopt: true,
			});
		}

		this.trigger('isolate-mode-changed');
		this.trigger('device-lockers-updated');
	}

	isIsolateMode(): boolean {
		return this.isolateModeService.isIsolateMode();
	}
	getIsolateSettings(): StyleManagerSettings {
		return { ...this.isolateModeService.isolateSettings };
	}

	public getEffectiveLockerSettings(deviceId: string): Record<string, unknown> {
		const locker = this.identity.getLockerData(deviceId);
		if (!locker) return {};

		const data: Record<string, unknown> = {};

		// 1. Capture Style Settings (@@) from shared
		for (const key of Object.keys(this.sharedSettings)) {
			if (key.includes('@@')) {
				data[key] = this.sharedSettings[key];
			}
		}

		// 2. Capture core settings from shared
		const coreKeys = [
			THEME_KEY,
			APPEARANCE_KEY,
			SNIPPETS_KEY,
			ACCENT_COLOR_KEY,
		];
		for (const key of coreKeys) {
			if (this.sharedSettings[key] !== undefined) {
				data[key] = this.sharedSettings[key];
			}
		}

		// 3. Merge isolated settings over shared
		// CRITICAL: Use the live isolateSettings if this is the current device,
		// as sharedSettings.__devices might be stale until the next save cycle.
		const isolateSettings =
			deviceId === this.deviceId
				? this.isolateModeService.isolateSettings
				: locker.isolateSettings;

		Object.assign(data, isolateSettings);

		// 4. Fallback for core settings if still missing
		// This ensures the preset is "complete" even if some keys weren't explicitly set.
		if (data[THEME_KEY] === undefined) {
			data[THEME_KEY] = this.bridge.getNativeConfig('cssTheme') || 'default';
		}
		if (data[APPEARANCE_KEY] === undefined) {
			data[APPEARANCE_KEY] =
				this.bridge.getNativeConfig('theme') === 'moonstone' ? 'light' : 'dark';
		}
		if (data[ACCENT_COLOR_KEY] === undefined) {
			data[ACCENT_COLOR_KEY] = this.bridge.getNativeConfig('accentColor') || '';
		}
		if (data[SNIPPETS_KEY] === undefined) {
			data[SNIPPETS_KEY] = this.bridge.getEnabledSnippets();
		}

		return data;
	}

	async setIsolateMode(
		enabled: boolean,
		options?: { skipSave?: boolean }
	): Promise<void> {
		return this.isolateModeService.setIsolateMode(enabled, options);
	}

	async resetIsolateSettings(): Promise<void> {
		return this.isolateModeService.resetIsolateSettings();
	}

	async pushToShared(): Promise<void> {
		return this.isolateModeService.pushToShared();
	}

	public hasIsolateSetting(key: string): boolean {
		return this.isolateModeService.isolateSettings[key] !== undefined;
	}

	public async resetAllStyleSettings(isIsolate: boolean): Promise<void> {
		const targetBuffer = isIsolate
			? this.isolateModeService.isolateSettings
			: this.sharedSettings;

		Object.keys(targetBuffer).forEach((key) => {
			if (this.isStyleSetting(key)) {
				delete targetBuffer[key];
			}
		});

		targetBuffer[THEME_KEY] = 'default';
		targetBuffer[APPEARANCE_KEY] = 'light';
		targetBuffer[ACCENT_COLOR_KEY] = '#8a5cf5';
		targetBuffer[SNIPPETS_KEY] = [];

		this.updateMerged();
		this.styleSheetManager.clearCache();
		this.refreshService.trigger(RefreshLevel.FULL_VISUAL);
		this.trigger('refresh-status-bar');

		await this.save();
	}

	private isStyleSetting(key: string): boolean {
		return (
			key.includes('@@') ||
			key === THEME_KEY ||
			key === APPEARANCE_KEY ||
			key === ACCENT_COLOR_KEY ||
			key === SNIPPETS_KEY ||
			key === '__style_manager_sticky_heading'
		);
	}

	getSetting(sectionId: string, settingId?: string): SettingValue | undefined {
		if (settingId === undefined) {
			return this.settings[sectionId];
		}
		if (sectionId === THEME_KEY) return this.settings[THEME_KEY];
		if (sectionId === APPEARANCE_KEY) return this.settings[APPEARANCE_KEY];
		if (sectionId === ACCENT_COLOR_KEY) return this.settings[ACCENT_COLOR_KEY];
		return this.settings[`${sectionId}@@${settingId}`];
	}

	getSettings(sectionId: string, ids: string[]): Record<string, SettingValue> {
		const prefix = `${sectionId}@@`;
		const currentSettings = this.settings;

		return ids.reduce<Record<string, SettingValue>>((acc, id) => {
			const fullId = `${prefix}${id}`;

			Object.keys(currentSettings).forEach((key) => {
				if (key === fullId || key.startsWith(`${fullId}@@`)) {
					acc[key] = currentSettings[key];
				}
			});

			return acc;
		}, {});
	}

	async setMetaSetting(
		key: string,
		value: SettingValue,
		options?: {
			persistNative?: boolean;
			silentUI?: boolean;
			skipSave?: boolean;
			target?: 'shared' | 'isolate';
		}
	): Promise<void> {
		return this.applySettingsUpdate({ [key]: value }, options);
	}

	async setSectionSetting(
		sectionId: string,
		settingId: string,
		value: SettingValue,
		options?: {
			persistNative?: boolean;
			silentUI?: boolean;
			skipSave?: boolean;
			target?: 'shared' | 'isolate';
		}
	): Promise<void> {
		return this.applySettingsUpdate(
			{ [`${sectionId}@@${settingId}`]: value },
			options
		);
	}

	async setSetting(
		sectionOrKey: string,
		keyOrValue: SettingValue | string,
		valueOrOptions?:
			| SettingValue
			| { persistNative?: boolean; silentUI?: boolean; skipSave?: boolean; target?: 'shared' | 'isolate' },
		options?: {
			persistNative?: boolean;
			silentUI?: boolean;
			skipSave?: boolean;
			target?: 'shared' | 'isolate';
		}
	): Promise<void> {
		let section: string | null = null;
		let key: string;
		let val: SettingValue;
		let opts = options;

		if (
			typeof valueOrOptions === 'undefined' ||
			(typeof valueOrOptions === 'object' &&
				valueOrOptions !== null &&
				!Array.isArray(valueOrOptions) &&
				!options)
		) {
			key = sectionOrKey;
			val = keyOrValue as SettingValue;
			opts = valueOrOptions as
				| { persistNative?: boolean; silentUI?: boolean; skipSave?: boolean; target?: 'shared' | 'isolate' }
				| undefined;
		} else {
			section = sectionOrKey;
			key = keyOrValue as string;
			val = valueOrOptions as SettingValue;
		}

		if (section) {
			return this.setSectionSetting(section, key, val, opts);
		}
		return this.setMetaSetting(key, val, opts);
	}

	async setSettings(
		settings: Record<string, SettingValue>,
		options?: {
			persistNative?: boolean;
			silentUI?: boolean;
			skipSave?: boolean;
			target?: 'shared' | 'isolate';
		}
	): Promise<void> {
		return this.applySettingsUpdate(settings, options);
	}

	private async applySettingsUpdate(
		updates: Record<string, SettingValue>,
		options?: {
			persistNative?: boolean;
			silentUI?: boolean;
			skipSave?: boolean;
			target?: 'shared' | 'isolate';
		}
	): Promise<void> {
		const isIsolate = this.isolateModeService.isIsolateMode();
		let targetBuffer;
		if (options?.target === 'isolate') {
			targetBuffer = this.isolateModeService.isolateSettings;
		} else if (options?.target === 'shared') {
			targetBuffer = this.sharedSettings;
		} else {
			targetBuffer = isIsolate
				? this.isolateModeService.isolateSettings
				: this.sharedSettings;
		}

		Object.assign(targetBuffer, updates);

		const persist = !isIsolate && options?.persistNative !== false;

		if (updates[THEME_KEY]) {
			await this.applyTheme(updates[THEME_KEY] as string, persist);
		}
		if (updates[APPEARANCE_KEY]) {
			this.applyAppearance(updates[APPEARANCE_KEY] as string, persist);
		}
		if (updates[ACCENT_COLOR_KEY]) {
			this.applyAccentColor(updates[ACCENT_COLOR_KEY] as string, persist);
		}
		if (updates[SNIPPETS_KEY]) {
			await this.applySnippets(updates[SNIPPETS_KEY] as string[], isIsolate);
		}

		this.updateMerged();
		const hasStyleChange = Object.keys(updates).some((key) =>
			this.isStyleSetting(key)
		);
		const isSnippetOnly =
			updates[SNIPPETS_KEY] !== undefined &&
			!Object.keys(updates).some(
				(key) => key !== SNIPPETS_KEY && this.isStyleSetting(key)
			);

		if (hasStyleChange && !isSnippetOnly) {
			this.styleSheetManager.clearCache();
			this.refreshService.trigger(RefreshLevel.STYLES_ONLY);
		}

		if (!options?.silentUI && !isSnippetOnly) {
			this.refreshService.trigger(RefreshLevel.UI_ONLY);
		}

		if (hasStyleChange && !isSnippetOnly) {
			this.trigger('refresh-status-bar');
		}

		if (options?.skipSave) return;
		return this.save({ silent: options?.persistNative === false });
	}

	async clearSetting(
		sectionId: string,
		settingId: string,
		options?: { silentUI?: boolean; skipSave?: boolean }
	): Promise<void> {
		let key: string;
		if (
			!sectionId ||
			sectionId === THEME_KEY ||
			sectionId === APPEARANCE_KEY ||
			sectionId === ACCENT_COLOR_KEY ||
			sectionId === SNIPPETS_KEY
		) {
			key = settingId;
		} else {
			key = `${sectionId}@@${settingId}`;
		}

		if (this.isolateModeService.isIsolateMode()) {
			delete this.isolateModeService.isolateSettings[key];
		} else {
			delete this.sharedSettings[key];
		}

		this.updateMerged();
		if (!options?.skipSave) {
			await this.save();
		}

		const keyMatched = (key: string): boolean =>
			key === THEME_KEY ||
			key === APPEARANCE_KEY ||
			key === ACCENT_COLOR_KEY ||
			key === SNIPPETS_KEY;
		const isIsolate = this.isolateModeService.isIsolateMode();

		if (keyMatched(key)) {
			if (key === THEME_KEY) await this.applyTheme('default', !isIsolate);
			else if (key === APPEARANCE_KEY)
				this.applyAppearance('light', !isIsolate);
			else if (key === ACCENT_COLOR_KEY)
				this.applyAccentColor('#8a5cf5', !isIsolate);
			else if (key === SNIPPETS_KEY) await this.applySnippets([], isIsolate);
		}

		if (options?.silentUI) {
			this.styleSheetManager.clearCache();
			this.refreshService.trigger(RefreshLevel.STYLES_ONLY);
			if (this.isStyleSetting(key)) {
				this.trigger('refresh-status-bar');
			}
		} else {
			this.styleSheetManager.clearCache();
			this.refreshService.trigger(RefreshLevel.FULL_VISUAL);
		}
	}

	async clearSection(
		sectionId: string,
		skipSave: boolean = false,
		options?: { silentUI?: boolean }
	): Promise<void> {
		await this.clearSections([sectionId], skipSave, options);
	}

	async clearSections(
		sectionIds: string[],
		skipSave: boolean = false,
		options?: { silentUI?: boolean }
	): Promise<void> {
		let modified = false;
		const isIsolate = this.isolateModeService.isIsolateMode();
		const targetBuffer = isIsolate
			? this.isolateModeService.isolateSettings
			: this.sharedSettings;

		Object.keys(targetBuffer).forEach((key) => {
			const [section] = key.split('@@');
			if (sectionIds.includes(section)) {
				delete targetBuffer[key];
				modified = true;
			}
		});

		// Explicit handle for core settings to match requested defaults
		if (sectionIds.includes('__theme')) {
			targetBuffer[THEME_KEY] = 'default';
			modified = true;
		}
		if (sectionIds.includes('__appearance')) {
			targetBuffer[APPEARANCE_KEY] = 'light';
			modified = true;
		}
		if (sectionIds.includes('__accentColor')) {
			targetBuffer[ACCENT_COLOR_KEY] = '#8a5cf5';
			modified = true;
		}
		if (sectionIds.includes('__snippets')) {
			targetBuffer[SNIPPETS_KEY] = [];
			modified = true;
		}

		if (modified && !skipSave) {
			this.updateMerged();
			await this.save();

			if (sectionIds.includes('__theme'))
				await this.applyTheme('default', !isIsolate);
			if (sectionIds.includes('__appearance'))
				this.applyAppearance('light', !isIsolate);
			if (sectionIds.includes('__accentColor'))
				this.applyAccentColor('#8a5cf5', !isIsolate);
			if (sectionIds.includes('__snippets'))
				await this.applySnippets([], isIsolate);

			if (options?.silentUI) {
				this.refreshService.trigger(RefreshLevel.STYLES_ONLY);
				this.trigger('refresh-status-bar');
			} else {
				this.refreshService.trigger(RefreshLevel.FULL_VISUAL);
			}

			const coreMapping: Record<string, string> = {
				'__theme': 'active theme',
				'__appearance': 'appearance',
				'__accentColor': 'color accent',
				'__snippets': 'snippets',
			};
			const resetCoreItems = sectionIds
				.filter((id) => id in coreMapping)
				.map((id) => coreMapping[id]);

			if (resetCoreItems.length > 0) {
				const mode = isIsolate ? 'isolate' : 'shared';
				this.notifications.notify(
					`Reset ${resetCoreItems.join(', ')} to default in ${mode} mode.`
				);
			}
		}
	}

	getRawSettingsSections(): Array<{
		id: string;
		name: string;
		count: number;
		isActive: boolean;
		isIsolate: boolean;
		isShared: boolean;
	}> {
		return this.statsService.getRawSettingsSections();
	}

	public countUniqueSettings(keys: string[]): number {
		return this.statsService.countUniqueSettings(keys);
	}

	public countModifiedEntries(settings: Record<string, unknown>): number {
		return this.statsService.countModifiedEntries(settings);
	}

	async resetSettings(
		sectionId: string,
		ids: string[],
		options?: { silentUI?: boolean }
	): Promise<void> {
		const isIsolate = this.isolateModeService.isIsolateMode();
		const targetBuffer = isIsolate
			? this.isolateModeService.isolateSettings
			: this.sharedSettings;

		let modified = false;

		for (const id of ids) {
			const fullId = `${sectionId}@@${id}`;

			Object.keys(targetBuffer).forEach((key) => {
				if (key === fullId || key.startsWith(`${fullId}@@`)) {
					delete targetBuffer[key];
					modified = true;
				}
			});
		}

		if (modified) {
			this.updateMerged();
			await this.save();

			const keyMatched = (key: string): boolean =>
				key === THEME_KEY ||
				key === APPEARANCE_KEY ||
				key === ACCENT_COLOR_KEY ||
				key === SNIPPETS_KEY;

			if (keyMatched(sectionId)) {
				if (sectionId === THEME_KEY)
					await this.applyTheme('default', !isIsolate);
				else if (sectionId === APPEARANCE_KEY)
					this.applyAppearance('light', !isIsolate);
				else if (sectionId === ACCENT_COLOR_KEY)
					this.applyAccentColor('#8a5cf5', !isIsolate);
				else if (sectionId === SNIPPETS_KEY)
					await this.applySnippets([], isIsolate);
			}

			if (options?.silentUI) {
				this.styleSheetManager.clearCache();
				this.refreshService.trigger(RefreshLevel.STYLES_ONLY);
				this.trigger('refresh-status-bar');
			} else {
				this.styleSheetManager.clearCache();
				this.refreshService.trigger(RefreshLevel.FULL_VISUAL);
			}
		}
	}

	cleanup(): void {
		try {
			this.themeService.cleanup();
			this.styleGenerator.destroy();
		} catch (e) {
			Logger.error('Style Manager | Error during settings manager cleanup', e);
		}
	}
}

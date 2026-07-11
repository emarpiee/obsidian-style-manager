import type StyleManagerPlugin from '../main';
import type {
	ParsedCSSSettings,
	Preset,
	StyleManagerSettings,
} from './settings';

import type { IsolateModeService } from '../application/IsolateModeService';
import type { NotificationService } from '../application/NotificationService';
import type { SharedStateService } from '../application/SharedStateService';
import type { ThemeService } from '../application/ThemeService';
import type { StyleSheetManager } from '../core/css/StyleSheetManager';
import type { StyleGenerator } from '../core/style/StyleGenerator';
import type { ObsidianBridge } from '../infrastructure/bridge/ObsidianBridge';
import type { SharedStore } from '../infrastructure/storage/SharedStore';
import type { ViewManager } from '../ui/ViewManager';

export interface BundleData {
	presets: Preset[];
	snippets: { name: string; content: string }[];
	themes?: { name: string; files: { filename: string; content: string }[] }[];
}

export interface DeviceLocker {
	name?: string;
	isIsolateMode: boolean;
	isolateSettings: Record<string, unknown>;
}

export interface IdentityStorageAdapter {
	getDevices(): Record<string, DeviceLocker> | undefined;
	loadLocalStorage(key: string): unknown;
	saveLocalStorage(key: string, data: unknown): void;
	setDevices(
		devices: Record<
			string,
			{
				name?: string;
				isIsolateMode: boolean;
				isolateSettings: Record<string, unknown>;
			}
		>
	): void;
	clearIsolateSettings(): void;
	save(): Promise<void>;
	reload(): Promise<void>;
	updateMerged(): void;
	rerenderAll(): void;
	trigger(event: string): void;
	getPlugin(): StyleManagerPlugin;
}

export interface IsolateModeDelegate {
	getSharedSettings(): StyleManagerSettings;
	setSharedSettings(settings: StyleManagerSettings): void;
	save(options?: { silent?: boolean }): Promise<void>;
	updateMerged(): void;
	applyTheme(themeName: string, persist: boolean): Promise<void>;
	applyAppearance(mode: string, persist?: boolean): void;
	applyAccentColor(color: string, persist?: boolean): void;
	triggerGlobal(event: string): void;
	themeService: ThemeService;
	bridge: ObsidianBridge;
	styleGenerator: StyleGenerator;
	viewManager: ViewManager;
	plugin: StyleManagerPlugin;
}

export interface PersistenceServiceOptions {
	sharedStore: SharedStore;
	sharedStateService: SharedStateService;
	notifications: NotificationService;
	getDeviceId: () => string;
	getDeviceName: () => string;
	getSharedSettings: () => StyleManagerSettings;
	setSharedSettings: (settings: StyleManagerSettings) => void;
	getIsolateSettings: () => StyleManagerSettings;
	getIsIsolateMode: () => boolean;
	onDataLoaded: (
		data: StyleManagerSettings,
		isExternal: boolean,
		force: boolean
	) => Promise<void>;
}

export interface ImportAnalysis {
	presets: Preset[];
	snippets: { name: string; content: string }[];
	themes: { name: string; files: { filename: string; content: string }[] }[];
	conflicts: string[];
	themeConflicts: string[];
}

export interface SnippetServiceOptions {
	plugin: StyleManagerPlugin;
	bridge: ObsidianBridge;
	viewManager: ViewManager;
	getIsolateMode: () => boolean;
	getLockerSettings: () => string[];
	setLockerSettings: (snippets: string[]) => Promise<void>;
}

export interface StatsServiceOptions {
	getSettings: () => StyleManagerSettings;
	getSharedSettings: () => StyleManagerSettings;
	isolateModeService: IsolateModeService;
	styleGenerator: StyleGenerator;
	styleSheetManager?: StyleSheetManager;
	getSettingsList?: () => ParsedCSSSettings[];
}

export interface StyleBlockDefinition {
	id: string;
	label: string;
	icon: string;
	position: 'top' | 'bottom' | 'cursor';
	allowDuplicates: boolean;
	template: string;
	group: 'meta' | 'field';
}

export interface ThemeManifest {
	name: string;
	author: string;
	version: string;
	minAppVersion: string;
	authorUrl?: string;
	fundingUrl?: string | Record<string, string>;
}

export interface ThemeServiceDeps {
	bridge: ObsidianBridge;
	isIsolateMode: () => boolean;
	getSetting: (key: string) => unknown;
	setSetting: (
		key: string,
		value: unknown,
		options?: { silentUI?: boolean }
	) => void;
	triggerEvent: (name: string) => void;
	notifications: NotificationService;
}

export type AppearanceMode = 'light' | 'dark' | 'system' | string;

export interface RefreshDelegates {
	parseCSS?: () => void;
	systemReload?: (
		options?: import('./settings').RefreshOptions
	) => Promise<void>;
}

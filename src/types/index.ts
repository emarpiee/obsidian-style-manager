import type StyleManagerPlugin from '../main';
import type { ThemeService } from '../application/ThemeService';
import type { ObsidianBridge } from '../infrastructure/bridge/ObsidianBridge';
import type { StyleGenerator } from '../core/style/StyleGenerator';
import type { ViewManager } from '../ui/ViewManager';
import type { SharedStore } from '../infrastructure/storage/SharedStore';
import type { SharedStateService } from '../application/SharedStateService';
import type { NotificationService } from '../application/NotificationService';
import type { IsolateModeService } from '../application/IsolateModeService';
import type { StyleSheetManager } from '../core/css/StyleSheetManager';

export const SettingType = {
	HEADING: 'heading',
	INFO_TEXT: 'info-text',
	CLASS_TOGGLE: 'class-toggle',
	CLASS_SELECT: 'class-select',
	VARIABLE_TEXT: 'variable-text',
	VARIABLE_NUMBER: 'variable-number',
	VARIABLE_NUMBER_SLIDER: 'variable-number-slider',
	VARIABLE_SELECT: 'variable-select',
	VARIABLE_COLOR: 'variable-color',
	VARIABLE_THEMED_COLOR: 'variable-themed-color',
	COLOR_GRADIENT: 'color-gradient',
} as const;

export type SettingType = (typeof SettingType)[keyof typeof SettingType];

export interface WithTitle {
	title: string;
	'title.ar'?: string;
	'title.cz'?: string;
	'title.da'?: string;
	'title.de'?: string;
	'title.es'?: string;
	'title.fr'?: string;
	'title.hi'?: string;
	'title.id'?: string;
	'title.it'?: string;
	'title.ja'?: string;
	'title.ko'?: string;
	'title.nl'?: string;
	'title.no'?: string;
	'title.pl'?: string;
	'title.pt-BR'?: string;
	'title.pt'?: string;
	'title.ro'?: string;
	'title.ru'?: string;
	'title.sq'?: string;
	'title.tr'?: string;
	'title.uk'?: string;
	'title.zh-TW'?: string;
	'title.zh'?: string;
}

export interface WithDescription {
	description?: string;
	'description.ar'?: string;
	'description.cz'?: string;
	'description.da'?: string;
	'description.de'?: string;
	'description.es'?: string;
	'description.fr'?: string;
	'description.hi'?: string;
	'description.id'?: string;
	'description.it'?: string;
	'description.ja'?: string;
	'description.ko'?: string;
	'description.nl'?: string;
	'description.no'?: string;
	'description.pl'?: string;
	'description.pt-BR'?: string;
	'description.pt'?: string;
	'description.ro'?: string;
	'description.ru'?: string;
	'description.sq'?: string;
	'description.tr'?: string;
	'description.uk'?: string;
	'description.zh-TW'?: string;
	'description.zh'?: string;
}

export interface Meta extends WithTitle, WithDescription {
	id: string;
	type: SettingType;
}

export interface Heading extends Meta {
	level: 0 | 1 | 2 | 3 | 4 | 5 | 6;
	collapsed?: boolean;
	resetFn?: () => void;
	sourceType?: 'Plugin' | 'Theme' | 'Snippet' | 'Unknown' | 'Style';
	sourceId?: string;
	isDuplicate?: boolean;
}

export interface InfoText extends Meta {
	markdown?: boolean;
}

export interface ClassToggle extends Meta {
	default?: boolean;
	addCommand?: boolean;
}

export interface SelectOption {
	label: string;
	value: string;
}

export interface ClassMultiToggle extends Meta {
	default?: string;
	allowEmpty: boolean;
	options: Array<string | SelectOption>;
}

export interface VariableText extends Meta {
	default: string;
	quotes?: boolean;
}

export interface VariableNumber extends Meta {
	default: number;
	format?: string;
}

export interface VariableNumberSlider extends Meta {
	default: number;
	min: number;
	max: number;
	step: number;
	format?: string;
}

export interface VariableSelect extends Meta {
	default: string;
	options: Array<string | SelectOption>;
	quotes?: boolean;
}

export type ColorFormat =
	| 'hsl'
	| 'hsl-values'
	| 'hsl-split'
	| 'hsl-split-decimal'
	| 'rgb'
	| 'rgb-values'
	| 'rgb-split'
	| 'hex'
	| 'oklch';

export const FALLBACK_COLOR = '#';

export interface VariableColor extends Meta {
	default?: string;
	format: ColorFormat;
	'alt-format'?: Array<{ id: string; format: ColorFormat }>;
	opacity?: boolean;
}

export interface ColorGradient extends Meta {
	from: string;
	to: string;
	format: 'hsl' | 'rgb' | 'hex' | 'oklch';
	pad?: number;
	step: number;
}

export type VariableKV = Array<{ key: string; value: string; important?: boolean }>;

export type AltFormatList = Array<{ id: string; format: ColorFormat }>;

export interface VariableThemedColor extends Meta {
	'default-light': string;
	'default-dark': string;
	format: ColorFormat;
	'alt-format': AltFormatList;
	opacity?: boolean;
}

export type CSSSetting =
	| Heading
	| InfoText
	| ClassToggle
	| ClassMultiToggle
	| VariableText
	| VariableNumber
	| VariableNumberSlider
	| VariableSelect
	| VariableColor
	| VariableThemedColor
	| ColorGradient;

export interface SnippetMetadata {
	description?: string;
	author?: string;
	version?: string;
	authorUrl?: string;
	license?: string;
}

export interface ParsedCSSSettings {
	name: string;
	id: string;
	collapsed?: boolean;
	settings: Array<CSSSetting>;
	sourceType?: 'Plugin' | 'Theme' | 'Snippet' | 'Unknown' | 'Style';
	sourceId?: string;
	metadata?: SnippetMetadata;
	raw?: string;
	isDuplicate?: boolean;
}

export interface Preset {
	id: string;
	name: string;
	created: number;
	data: Record<string, unknown>;
	targetedPrefixes?: string[];
	isFavorite?: boolean;
}

export interface PrefixMetadata {
	id: string;
	name: string;
	count: number;
	isActive: boolean;
	value?: string | number | string[];
}

export type SettingValue = number | string | boolean | unknown;

export interface PresetSchedule {
	id: string;
	presetId: string;
	rruleString: string;
	targetLocker: 'shared' | 'isolate' | string;
	lastExecuted: number;
	deviceId?: string;
	isPaused?: boolean;
}

export interface StyleManagerSettings {
	[key: string]: SettingValue;
	_manager_presets?: Preset[];
	_manager_schedules?: PresetSchedule[];
	__devices?: Record<
		string,
		{
			name?: string;
			isIsolateMode: boolean;
			isolateSettings: Record<string, unknown>;
		}
	>;
	__shared_version?: number;
}

export interface MappedSettings {
	[sectionId: string]: {
		[settingId: string]: CSSSetting;
	};
}

export interface ParseLogEntry {
	name: string;
	message: string;
	type: 'error' | 'warning';
	timestamp: number;
	settingId?: string;
}

export type ParseLogList = Array<ParseLogEntry>;

export interface SettingsSeachResource {
	tab: string;
	name: string;
	text: string;
	desc: string;
}

/** Tooltip text shown on the 'Restore default' reset button for setting components. */
export const resetTooltip = 'Restore default';

export enum RefreshLevel {
	UI_ONLY = 0, // React UI rerender only
	STYLES_ONLY = 1, // CSS Classes & Variables only
	FULL_VISUAL = 2, // Both Styles + UI
	PARSE_CSS = 3, // Extract Snippet Metadata + FULL_VISUAL
	SYSTEM_RELOAD = 4, // Read Disk + Apply Core Native Settings + PARSE_CSS
}

export interface RefreshOptions {
	skipAdopt?: boolean;
	skipLoad?: boolean;
}

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

export interface BridgeInternals {
	app: {
		customCss?: { theme?: string };
		vault: {
			adapter: {
				exists: (path: string) => Promise<boolean>;
				stat: (path: string) => Promise<{ mtime: number }>;
				read: (path: string) => Promise<string>;
			};
		};
	};
}

export interface RefreshDelegates {
	parseCSS?: () => void;
	systemReload?: (options?: RefreshOptions) => Promise<void>;
}

export interface ObsidianCustomCss {
	getSnippetPath?: (id: string) => string;
	snippets?: string[];
	enabledSnippets?: Set<string> | string[];
	themes?: Record<string, unknown>;
	setTheme?: (name: string, ...args: unknown[]) => void;
	requestLoadSnippets?: () => void;
	requestLoadTheme?: () => void;
	getTheme?: () => string;
	theme?: string;
	setCssEnabledStatus?: (name: string, enabled: boolean) => void;
	setSnippetEnabled?: (name: string, enabled: boolean) => void;
}

export interface ObsidianInternalApp {
	customCss: ObsidianCustomCss;
	plugins: { manifests: Record<string, unknown> };
}

export interface DeviceBucket {
	isIsolateMode: boolean;
	isolateSettings: Record<string, unknown>;
}

export interface IStore<T> {
	/**
	 * Loads the data from the underlying storage.
	 */
	load(): Promise<T | null>;

	/**
	 * Saves the data to the underlying storage.
	 */
	save(data: T): Promise<void>;
}

export type PluginManifestWithDir = StyleManagerPlugin['manifest'] & { dir?: string };

export interface UndocumentedApp {
	isMobile: boolean;
	emulateMobile: (toggle: boolean) => void;
}

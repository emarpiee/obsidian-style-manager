import type { CSSSetting } from './ui';

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

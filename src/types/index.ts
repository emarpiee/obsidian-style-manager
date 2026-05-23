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
	| 'hex';

export interface VariableColor extends Meta {
	default?: string;
	format: ColorFormat;
	'alt-format'?: Array<{ id: string; format: ColorFormat }>;
	opacity?: boolean;
}

export interface ColorGradient extends Meta {
	from: string;
	to: string;
	format: 'hsl' | 'rgb' | 'hex';
	pad?: number;
	step: number;
}

export type VariableKV = Array<{ key: string; value: string }>;

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
	license?: string;
	repo?: string;
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

export interface StyleManagerSettings {
	[key: string]: SettingValue;
	_manager_presets?: Preset[];
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

export type ErrorList = Array<{ name: string; error: string }>;

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

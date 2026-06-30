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

export type VariableKV = Array<{
	key: string;
	value: string;
	important?: boolean;
}>;

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

/** Tooltip text shown on the 'Restore default' reset button for setting components. */
export const resetTooltip = 'Restore default';

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
import {
	ACCENT_COLOR_KEY,
	APPEARANCE_KEY,
	SNIPPETS_KEY,
	THEME_KEY,
} from '../constants';
import { ParsedCSSSettings, StyleManagerSettings } from '../types';
import { IsolateModeService } from './IsolateModeService';

import { StyleGenerator } from '../core/style/StyleGenerator';
import { StyleSheetManager } from '../core/css/StyleSheetManager';

export interface StatsServiceOptions {
	getSettings: () => StyleManagerSettings;
	getSharedSettings: () => StyleManagerSettings;
	isolateModeService: IsolateModeService;
	styleGenerator: StyleGenerator;
	styleSheetManager?: StyleSheetManager;
	getSettingsList?: () => ParsedCSSSettings[];
}

/**
 * Service for calculating setting statistics and section metadata.
 */
export class StatsService {
	constructor(private options: StatsServiceOptions) {}

	public getModifiedCount(sectionId: string): number {
		const settings = this.options.getSettings();
		let count = 0;
		for (const key of Object.keys(settings)) {
			if (key.startsWith(`${sectionId}@@`)) {
				count++;
			}
		}
		return count;
	}

	public countModifiedEntries(settings: Record<string, unknown>): number {
		let count = 0;
		for (const key of Object.keys(settings)) {
			if (key.includes('@@')) {
				count++;
			}
		}
		return count;
	}

	public getTotalModifiedCount(): number {
		return this.countModifiedEntries(this.options.getSettings());
	}

	public getRawSettingsSections(): Array<{
		id: string;
		name: string;
		count: number;
		isActive: boolean;
		isIsolate: boolean;
		isShared: boolean;
	}> {
		const settings = this.options.getSettings();
		const sharedSettings = this.options.getSharedSettings();
		const isolateSettings = this.options.isolateModeService.isolateSettings;

		const sections: Record<
			string,
			{ id: string; count: number; isActive: boolean; keys: string[] }
		> = {
			__theme: { id: '__theme', count: 1, isActive: true, keys: [THEME_KEY] },
			__appearance: {
				id: '__appearance',
				count: 1,
				isActive: true,
				keys: [APPEARANCE_KEY],
			},
			__accentColor: {
				id: '__accentColor',
				count: 1,
				isActive: true,
				keys: [ACCENT_COLOR_KEY],
			},
			__snippets: {
				id: '__snippets',
				count: 0,
				isActive: true,
				keys: [SNIPPETS_KEY],
			},
		};

		Object.keys(settings).forEach((key) => {
			if (key.includes('@@')) {
				const [sectionId] = key.split('@@');
				if (!sections[sectionId]) {
					const isActive =
						this.options.styleGenerator.config[sectionId] !== undefined;
					sections[sectionId] = { id: sectionId, count: 0, isActive, keys: [] };
				}
				sections[sectionId].keys.push(key);
			} else if (
				key === THEME_KEY ||
				key === APPEARANCE_KEY ||
				key === ACCENT_COLOR_KEY ||
				key === SNIPPETS_KEY
			) {
				const sectionId =
					key === THEME_KEY
						? '__theme'
						: key === APPEARANCE_KEY
							? '__appearance'
							: key === ACCENT_COLOR_KEY
								? '__accentColor'
								: '__snippets';
				if (!sections[sectionId].keys.includes(key)) {
					sections[sectionId].keys.push(key);
				}
			}
		});

		return Object.values(sections).map((s) => {
			const keys = s.keys;
			let isIsolate = false;
			let isShared = false;

			keys.forEach((key) => {
				if (Object.prototype.hasOwnProperty.call(isolateSettings, key))
					isIsolate = true;
				if (Object.prototype.hasOwnProperty.call(sharedSettings, key))
					isShared = true;
			});

			return {
				id: s.id,
				name:
					s.id === '__theme'
						? 'Active Theme'
						: s.id === '__appearance'
							? 'Appearance'
							: s.id === '__accentColor'
								? 'Accent Color'
								: s.id === '__snippets'
									? 'Snippets'
									: this.options.getSettingsList?.().find((active) => active.id === s.id)?.name ||
									this.options.styleSheetManager?.getSectionName(s.id) ||
									s.id,
				isActive: s.isActive,
				count:
					s.id === '__theme' ||
					s.id === '__appearance' ||
					s.id === '__accentColor' ||
					s.id === '__snippets'
						? s.keys.length > 0
							? 1
							: 0
						: this.countUniqueSettings(keys),
				isIsolate,
				isShared,
			};
		});
	}

	public countUniqueSettings(keys: string[]): number {
		let count = 0;
		for (const key of keys) {
			if (key.includes('@@')) {
				count++;
			}
		}
		return count;
	}

	/**
	 * Maps raw sections to data needed for the ResetSettingsModal.
	 * Offloads the manual mapping currently in SettingsHeaderComponent.
	 */
	public getResetSectionsData(): Array<{
		id: string;
		name: string;
		count: number;
		isActive: boolean;
		isIsolate: boolean;
		isShared: boolean;
		value?: string | number | string[];
		accentColor?: string;
	}> {
		const sections = this.getRawSettingsSections();
		const currentSettings = this.options.getSettings();
		const currentAccent = currentSettings[ACCENT_COLOR_KEY] as string;

		return sections.map((s) => {
			return {
				...s,
				accentColor: currentAccent,
				value:
					s.id === '__theme'
						? (currentSettings[THEME_KEY] as string) || 'default'
						: s.id === '__appearance'
							? (currentSettings[APPEARANCE_KEY] as string) || 'system'
							: s.id === '__accentColor'
								? (currentSettings[ACCENT_COLOR_KEY] as string) || currentAccent
								: s.id === '__snippets'
									? (currentSettings[SNIPPETS_KEY] as string[]) || []
									: undefined,
			};
		});
	}
}

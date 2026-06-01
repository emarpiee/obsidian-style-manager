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
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCENT_COLOR_KEY, APPEARANCE_KEY, THEME_KEY } from '../constants';

import { StatsService } from '../application/StatsService';

describe('StatsService', () => {
	let service: StatsService;
	let mockOptions: any;

	beforeEach(() => {
		mockOptions = {
			getSettings: vi.fn().mockReturnValue({}),
			getSharedSettings: vi.fn().mockReturnValue({}),
			isolateModeService: { isolateSettings: {} },
			styleGenerator: { config: {} },
		};
		service = new StatsService(mockOptions);
	});

	it('should count modified entries correctly', () => {
		const settings = {
			'section1@@key1': 'v1',
			'section1@@key2': 'v2',
			unmodified: 'v3',
			'global-setting': 'v4',
		};
		expect(service.countModifiedEntries(settings)).toBe(2);
	});

	it('should calculate specific section count', () => {
		mockOptions.getSettings.mockReturnValue({
			'a@@key1': 'v1',
			'a@@key2': 'v2',
			'b@@key1': 'v3',
		});
		expect(service.getModifiedCount('a')).toBe(2);
		expect(service.getModifiedCount('b')).toBe(1);
		expect(service.getModifiedCount('c')).toBe(0);
	});

	describe('getRawSettingsSections', () => {
		it('should generate correct metadata for global and snippet sections', () => {
			mockOptions.getSettings.mockReturnValue({
				[THEME_KEY]: 'my-theme',
				'snippet@@color': 'blue',
			});
			mockOptions.getSharedSettings.mockReturnValue({
				[THEME_KEY]: 'my-theme',
			});
			mockOptions.isolateModeService.isolateSettings = {
				'snippet@@color': 'blue',
			};
			mockOptions.styleGenerator.config = {
				snippet: { name: 'Snippet' },
			};

			const sections = service.getRawSettingsSections();

			const themeSection = sections.find((s) => s.id === '__theme');
			expect(themeSection).toBeDefined();
			expect(themeSection!.count).toBe(1);
			expect(themeSection!.isShared).toBe(true);
			expect(themeSection!.isIsolate).toBe(false);

			const snippetSection = sections.find((s) => s.id === 'snippet');
			expect(snippetSection).toBeDefined();
			expect(snippetSection!.count).toBe(1);
			expect(snippetSection!.isShared).toBe(false);
			expect(snippetSection!.isIsolate).toBe(true);
			expect(snippetSection!.isActive).toBe(true);
		});

		it('should identify unused sections as inactive', () => {
			mockOptions.getSettings.mockReturnValue({
				'dead-snippet@@key': 'val',
			});
			mockOptions.styleGenerator.config = {}; // No config entry for 'dead-snippet'

			const sections = service.getRawSettingsSections();
			const deadSection = sections.find((s) => s.id === 'dead-snippet');
			expect(deadSection!.isActive).toBe(false);
		});

		it('should resolve human-readable names for custom sections using active settings list or stylesheet manager', () => {
			mockOptions.getSettings.mockReturnValue({
				'active-snippet@@key': 'val',
				'inactive-snippet@@key': 'val',
			});
			mockOptions.getSettingsList = vi.fn().mockReturnValue([
				{ id: 'active-snippet', name: 'Active Snippet Name' }
			]);
			mockOptions.styleSheetManager = {
				getSectionName: vi.fn().mockImplementation((id) => {
					if (id === 'inactive-snippet') return 'Inactive Snippet Name';
					return undefined;
				})
			};

			const sections = service.getRawSettingsSections();

			const activeSec = sections.find((s) => s.id === 'active-snippet');
			expect(activeSec).toBeDefined();
			expect(activeSec!.name).toBe('Active Snippet Name');

			const inactiveSec = sections.find((s) => s.id === 'inactive-snippet');
			expect(inactiveSec).toBeDefined();
			expect(inactiveSec!.name).toBe('Inactive Snippet Name');
		});
	});

	describe('getResetSectionsData', () => {
		it('should map core section IDs to human names and current values', () => {
			mockOptions.getSettings.mockReturnValue({
				[THEME_KEY]: 'obsidian',
				[APPEARANCE_KEY]: 'dark',
				[ACCENT_COLOR_KEY]: '#ff0000',
			});

			const data = service.getResetSectionsData();

			const theme = data.find((s) => s.id === '__theme');
			expect(theme!.name).toBe('Active Theme');
			expect(theme!.value).toBe('obsidian');

			const app = data.find((s) => s.id === '__appearance');
			expect(app!.name).toBe('Appearance');
			expect(app!.value).toBe('dark');
		});

		it('should use default values if settings are missing', () => {
			mockOptions.getSettings.mockReturnValue({});
			const data = service.getResetSectionsData();

			const theme = data.find((s) => s.id === '__theme');
			expect(theme!.value).toBe('default');

			const app = data.find((s) => s.id === '__appearance');
			expect(app!.value).toBe('system');
		});
	});
});

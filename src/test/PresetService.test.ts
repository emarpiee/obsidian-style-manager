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

import { PresetService } from '../application/PresetService';
import { APPEARANCE_KEY, THEME_KEY } from '../application/SettingsService';

describe('PresetService - Appearance Capture', () => {
	let presetService: PresetService;
	let mockPlugin: any;

	beforeEach(() => {
		mockPlugin = {
			settingsService: {
				settings: {
					[THEME_KEY]: 'minimal',
					[APPEARANCE_KEY]: 'dark',
					'plugin@@setting': 'val',
				},
				setSettings: vi.fn().mockImplementation((newSettings) => {
					Object.assign(mockPlugin.settingsService.settings, newSettings);
				}),
				updateMerged: vi.fn(),
				countUniqueSettings: (keys: string[]) => keys.length,
				getRawSettingsSections: () => [
					{ id: 'plugin', name: 'Plugin', count: 1, isActive: true },
					{ id: '__theme', name: 'Active Theme', count: 1, isActive: true },
					{ id: '__appearance', name: 'Appearance', count: 1, isActive: true },
				],
				notifications: {
					preset: vi.fn(),
					error: vi.fn(),
					sync: vi.fn(),
					isolate: vi.fn(),
				},
			},
			settingsList: [
				{ id: 'plugin', name: 'Plugin' },
				{ id: '__appearance', name: 'Appearance' },
			],
		};
		presetService = new PresetService(mockPlugin as any);
	});

	it('should capture appearance in getSettingsData', () => {
		const data = presetService.getSettingsData();
		expect(data[APPEARANCE_KEY]).toBe('dark');
		expect(data[THEME_KEY]).toBe('minimal');
		expect(data['plugin@@setting']).toBe('val');
		expect(data.__shared_version).toBeUndefined();
	});

	it('should include __appearance in prefixes metadata', () => {
		const metadata = presetService.getPrefixesMetadata();
		const appearanceMeta = metadata.find((m) => m.id === '__appearance');
		expect(appearanceMeta).toBeDefined();
		expect(appearanceMeta?.name).toBe('Appearance');
		expect(appearanceMeta?.value).toBe('dark');
	});

	it('should capture appearance when using "All" prefixes', async () => {
		await presetService.saveCurrentSettingsAsPreset('All Preset', ['All']);

		const call = mockPlugin.settingsService.setSettings.mock.calls[0][0];
		const newPreset = call._manager_presets[0];

		expect(newPreset.data[APPEARANCE_KEY]).toBe('dark');
		expect(newPreset.data[THEME_KEY]).toBe('minimal');
		expect(newPreset.data['plugin@@setting']).toBe('val');
		expect(newPreset.targetedPrefixes).toBeUndefined();
	});

	it('should filter appearance when requested in saveCurrentSettingsAsPreset', async () => {
		await presetService.saveCurrentSettingsAsPreset('My Preset', [
			'__appearance',
			'plugin',
		]);

		const call = mockPlugin.settingsService.setSettings.mock.calls[0][0];
		const newPreset = call._manager_presets[0];

		expect(newPreset.data[APPEARANCE_KEY]).toBe('dark');
		expect(newPreset.data['plugin@@setting']).toBe('val');
		expect(newPreset.data[THEME_KEY]).toBeUndefined();
	});
});

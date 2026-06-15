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
import {
	ACCENT_COLOR_KEY,
	ALWAYS_SHARED_PRESETS_KEY,
	APPEARANCE_KEY,
	EXPORT_DATE_FORMAT_KEY,
	EXPORT_PATH_KEY,
	PRESET_APPLY_ACTION_KEY,
	SNIPPETS_KEY,
	THEME_KEY,
} from '../constants';
import { Preset } from '../types';

describe('PresetService', () => {
	let presetService: PresetService;
	let mockPlugin: any;

	beforeEach(() => {
		mockPlugin = {
			settingsService: {
				settings: {
					[ALWAYS_SHARED_PRESETS_KEY]: false,
					[EXPORT_DATE_FORMAT_KEY]: 'YYYYMMDD',
					[EXPORT_PATH_KEY]: 'Exports',
					[PRESET_APPLY_ACTION_KEY]: 'ask',
					[THEME_KEY]: 'default-theme',
					[APPEARANCE_KEY]: 'dark',
					[SNIPPETS_KEY]: ['snippet1'],
					[ACCENT_COLOR_KEY]: '#ff0000',
					'plugin@@setting1': 'value1',
					'plugin@@setting2': 'value2',
					'other@@setting1': 'value3',
				},
				isIsolateMode: vi.fn().mockReturnValue(false),
				setSettings: vi.fn(),
				resetAllStyleSettings: vi.fn(),
				applySettingsOverlay: vi.fn(),
				updateMerged: vi.fn(),
				getRawSettingsSections: vi.fn().mockReturnValue([
					{ id: 'plugin', name: 'Plugin', count: 1 },
					{ id: 'other', name: 'Other', count: 1 },
					{ id: '__theme', name: 'Theme', count: 1 },
					{ id: '__appearance', name: 'Appearance', count: 1 },
					{ id: '__snippets', name: 'Snippets', count: 1 },
					{ id: '__accentColor', name: 'Accent Color', count: 1 },
				]),
				isolateModeService: {
					isolateSettings: {
						_manager_presets: [],
					},
				},
				sharedSettings: {
					_manager_presets: [],
				},
				bridge: {
					getNativeConfig: vi.fn().mockImplementation((key) => {
						if (key === 'trashOption') return 'trash';
						if (key === 'accentColor') return '#00ff00';
						return null;
					}),
					createFile: vi.fn().mockResolvedValue('mock-file-path'),
					trashFile: vi.fn().mockResolvedValue(undefined),
					mkdir: vi.fn().mockResolvedValue(undefined),
					fileExists: vi.fn().mockResolvedValue(false),
					snippetExists: vi.fn().mockResolvedValue(true),
				},
				identity: {
					updateLockerSettings: vi.fn(),
				},
				notifications: {
					preset: vi.fn(),
					error: vi.fn(),
				},
				on: vi.fn(),
			},
			settingsList: [
				{ id: 'plugin', name: 'Plugin' },
				{ id: 'other', name: 'Other' },
				{ id: '__theme', name: 'Theme' },
				{ id: '__appearance', name: 'Appearance' },
				{ id: '__snippets', name: 'Snippets' },
				{ id: '__accentColor', name: 'Accent Color' },
			],
			app: {},
		};
		presetService = new PresetService(mockPlugin as any);
	});


	describe('View Mode', () => {
		it('should return shared when targetView is auto and isolate mode is off', () => {
			presetService.targetView = 'auto';
			mockPlugin.settingsService.isIsolateMode.mockReturnValue(false);
			expect(presetService.getEffectiveViewMode()).toBe('shared');
		});

		it('should return isolate when targetView is auto and isolate mode is on', () => {
			presetService.targetView = 'auto';
			mockPlugin.settingsService.isIsolateMode.mockReturnValue(true);
			expect(presetService.getEffectiveViewMode()).toBe('isolate');
		});

		it('should return shared when ALWAYS_SHARED_PRESETS_KEY is true regardless of isolate mode', () => {
			presetService.targetView = 'auto';
			mockPlugin.settingsService.settings[ALWAYS_SHARED_PRESETS_KEY] = true;
			mockPlugin.settingsService.isIsolateMode.mockReturnValue(true);
			expect(presetService.getEffectiveViewMode()).toBe('shared');
		});

		it('should respect explicit targetView', () => {
			presetService.targetView = 'isolate';
			expect(presetService.getEffectiveViewMode()).toBe('isolate');
			presetService.targetView = 'shared';
			expect(presetService.getEffectiveViewMode()).toBe('shared');
		});
	});

	describe('Presets Access', () => {
		const mockPresets: Preset[] = [
			{ id: '1', name: 'P1', created: 100, data: { a: 1 } },
			{ id: '2', name: 'P2', created: 200, data: { b: 2 } },
		];

		it('should get presets from shared settings when in shared mode', () => {
			mockPlugin.settingsService.sharedSettings._manager_presets = mockPresets;
			presetService.targetView = 'shared';
			expect(presetService.presets).toEqual(mockPresets);
		});

		it('should get presets from isolate settings when in isolate mode', () => {
			mockPlugin.settingsService.isolateModeService.isolateSettings._manager_presets = mockPresets;
			presetService.targetView = 'isolate';
			expect(presetService.presets).toEqual(mockPresets);
		});

		it('should set presets in the correct mode', () => {
			const newPresets = [{ id: '3', name: 'P3', created: 300, data: { c: 3 } }];
			presetService.targetView = 'isolate';
			presetService.presets = newPresets;
			expect(mockPlugin.settingsService.setSettings).toHaveBeenCalledWith(
				{ _manager_presets: newPresets },
				{ silentUI: true, target: 'isolate' },
			);
		});

		it('should find preset by id across both shared and isolate', () => {
			mockPlugin.settingsService.sharedSettings._manager_presets = [mockPresets[0]];
			mockPlugin.settingsService.isolateModeService.isolateSettings._manager_presets = [mockPresets[1]];
			expect(presetService.getPresetById('1')).toEqual(mockPresets[0]);
			expect(presetService.getPresetById('2')).toEqual(mockPresets[1]);
			expect(presetService.getPresetById('3')).toBeUndefined();
		});
	});

	describe('Settings Data Capture', () => {
		it('should capture only relevant settings in getSettingsData', () => {
			const data = presetService.getSettingsData();
			expect(data['plugin@@setting1']).toBe('value1');
			expect(data['plugin@@setting2']).toBe('value2');
			expect(data['other@@setting1']).toBe('value3');
			expect(data[THEME_KEY]).toBe('default-theme');
			expect(data[APPEARANCE_KEY]).toBe('dark');
			expect(data[SNIPPETS_KEY]).toEqual(['snippet1']);
			expect(data[ACCENT_COLOR_KEY]).toBe('#ff0000');
			expect(data['some-other-key']).toBeUndefined();
		});

		it('should save current settings as a preset with "All"', async () => {
			await presetService.saveCurrentSettingsAsPreset('All Preset', ['All']);
			expect(mockPlugin.settingsService.setSettings).toHaveBeenCalled();
			const call = mockPlugin.settingsService.setSettings.mock.calls[0][0];
			const preset = call._manager_presets[0];
			expect(preset.name).toBe('All Preset');
			expect(preset.data[THEME_KEY]).toBe('default-theme');
			expect(preset.targetedPrefixes).toBeUndefined();
		});

		it('should save current settings as a preset with filtered prefixes', async () => {
			await presetService.saveCurrentSettingsAsPreset('Filtered Preset', ['plugin']);
			const call = mockPlugin.settingsService.setSettings.mock.calls[0][0];
			const preset = call._manager_presets[0];
			expect(preset.data['plugin@@setting1']).toBe('value1');
			expect(preset.data['other@@setting1']).toBeUndefined();
			expect(preset.data[THEME_KEY]).toBeUndefined();
			expect(preset.targetedPrefixes).toEqual(['plugin']);
		});

		it('should handle special prefixes in filtered save', async () => {
			await presetService.saveCurrentSettingsAsPreset('Special Preset', ['__theme', '__appearance']);
			const call = mockPlugin.settingsService.setSettings.mock.calls[0][0];
			const preset = call._manager_presets[0];
			expect(preset.data[THEME_KEY]).toBe('default-theme');
			expect(preset.data[APPEARANCE_KEY]).toBe('dark');
			expect(preset.data['plugin@@setting1']).toBeUndefined();
		});
	});

	describe('Vault Operations', () => {
		it('should save file to vault with correct extension and path', async () => {
			await presetService.saveFileToVault('my-preset', 'content');
			expect(mockPlugin.settingsService.bridge.mkdir).toHaveBeenCalledWith('Exports/');
			expect(mockPlugin.settingsService.bridge.createFile).toHaveBeenCalledWith(
				'Exports/my-preset.json',
				'content',
			);
		});

		it('should handle file collisions by adding timestamp', async () => {
			mockPlugin.settingsService.bridge.fileExists.mockResolvedValue(true);
			await presetService.saveFileToVault('my-preset', 'content');
			const callPath = mockPlugin.settingsService.bridge.createFile.mock.calls[0][0];
			expect(callPath).toMatch(/Exports\/my-preset_\d+\.json/);
		});

		it('should use custom extension from settings', async () => {
			mockPlugin.settingsService.settings[EXPORT_EXTENSION_KEY] = '.txt';
			await presetService.saveFileToVault('my-preset', 'content');
			expect(mockPlugin.settingsService.bridge.createFile).toHaveBeenCalledWith(
				'Exports/my-preset.txt',
				'content',
			);
		});

		it('should notify error if saving to vault fails', async () => {
			mockPlugin.settingsService.bridge.createFile.mockRejectedValue(new Error('Vault error'));
			await presetService.saveFileToVault('fail', 'content');
			expect(mockPlugin.settingsService.notifications.error).toHaveBeenCalledWith(
				'Failed to export to vault. Check console for details.',
			);
		});
	});

	describe('Preset Application', () => {
		const preset1: Preset = { id: '1', name: 'P1', created: 100, data: { a: 1, [SNIPPETS_KEY]: ['s1'] } };
		const preset2: Preset = { id: '2', name: 'P2', created: 200, data: { b: 2, [SNIPPETS_KEY]: ['s2'] } };

		beforeEach(() => {
			mockPlugin.settingsService.sharedSettings._manager_presets = [preset1, preset2];
		});

		it('should merge data from multiple presets', async () => {
			await presetService.applyPresets(['1', '2'], false);
			expect(mockPlugin.settingsService.applySettingsOverlay).toHaveBeenCalledWith(
				expect.objectContaining({ a: 1, b: 2, [SNIPPETS_KEY]: ['s1', 's2'] }),
				false,
			);
		});

		it('should reset all style settings when applying a single preset', async () => {
			await presetService.applyPresets(['1'], false);
			expect(mockPlugin.settingsService.resetAllStyleSettings).toHaveBeenCalledWith(false);
			expect(mockPlugin.settingsService.applySettingsOverlay).toHaveBeenCalled();
		});

		it('should filter out non-existent snippets during merge', async () => {
			mockPlugin.settingsService.bridge.snippetExists.mockImplementation((s: string) => s === 's1');
			await presetService.applyPresets(['1', '2'], false);
			const mergedData = mockPlugin.settingsService.applySettingsOverlay.mock.calls[0][0];
			expect(mergedData[SNIPPETS_KEY]).toEqual(['s1']);
		});

		it('should apply to locker when requested', async () => {
			await presetService.applyPresetsToLocker('dev1', ['1']);
			expect(mockPlugin.settingsService.identity.updateLockerSettings).toHaveBeenCalledWith(
				'dev1',
				expect.objectContaining({ a: 1 }),
				true,
			);
		});

		it('should return early if merged data is empty', async () => {
			mockPlugin.settingsService.sharedSettings._manager_presets = [
				{ id: 'empty', name: 'Empty', created: 100, data: {} },
			];
			await presetService.applyPresets(['empty'], false);
			expect(mockPlugin.settingsService.applySettingsOverlay).not.toHaveBeenCalled();
		});

		it('should return early for locker if merged data is empty', async () => {
			mockPlugin.settingsService.sharedSettings._manager_presets = [
				{ id: 'empty', name: 'Empty', created: 100, data: {} },
			];
			await presetService.applyPresetsToLocker('dev1', ['empty']);
			expect(mockPlugin.settingsService.identity.updateLockerSettings).not.toHaveBeenCalled();
		});

		it('should notify error if applying presets fails', async () => {
			mockPlugin.settingsService.applySettingsOverlay.mockRejectedValue(new Error('Apply error'));
			await presetService.applyPresets(['1'], false);
			expect(mockPlugin.settingsService.notifications.error).toHaveBeenCalledWith(
				'Failed to apply presets.',
			);
		});
	});

	describe('Prefix Metadata', () => {
		it('should generate metadata for settings and handle badges', () => {
			const meta = presetService.getPrefixesMetadata();
			const pluginMeta = meta.find((m) => m.id === 'plugin');
			const themeMeta = meta.find((m) => m.id === '__theme');
			const appearanceMeta = meta.find((m) => m.id === '__appearance');
			const snippetsMeta = meta.find((m) => m.id === '__snippets');
			const accentMeta = meta.find((m) => m.id === '__accentColor');

			expect(pluginMeta).toBeDefined();
			expect(themeMeta?.value).toBe('default-theme');
			expect(appearanceMeta?.value).toBe('dark');
			expect(snippetsMeta?.value).toEqual(['snippet1']);
			expect(accentMeta?.value).toBe('#ff0000');
		});

		it('should handle fallback for appearance and accent color', () => {
			mockPlugin.settingsService.settings[APPEARANCE_KEY] = 'system';
			mockPlugin.settingsService.settings[ACCENT_COLOR_KEY] = '';
			
			// Mock document.body for appearance fallback
			document.body.classList.add('theme-dark');

			const meta = presetService.getPrefixesMetadata();
			expect(meta.find((m) => m.id === '__appearance')?.value).toBe('dark');
			
			// Accent color fallback check
			expect(meta.find((m) => m.id === '__accentColor')?.value).toBe('#00ff00'); // from native config mock
		});

		it('should sort metadata by count descending and then by name alphabetically', () => {
			mockPlugin.settingsService.getRawSettingsSections.mockReturnValue([
				{ id: 'B', name: 'B', count: 10 },
				{ id: 'A', name: 'A', count: 10 },
				{ id: 'C', name: 'C', count: 5 },
			]);
			mockPlugin.settingsList = []; // Clear to avoid conflicts

			const meta = presetService.getPrefixesMetadata();
			expect(meta[0].id).toBe('A');
			expect(meta[1].id).toBe('B');
			expect(meta[2].id).toBe('C');
		});
	});

	describe('Confirmation', () => {
		it('should call onConfirm immediately with overwrite if PRESET_APPLY_ACTION_KEY is overwrite', () => {
			mockPlugin.settingsService.settings[PRESET_APPLY_ACTION_KEY] = 'overwrite';
			const onConfirm = vi.fn();
			presetService.confirmApply('Preset', onConfirm);
			expect(onConfirm).toHaveBeenCalledWith('overwrite');
		});

		it('should call onConfirm immediately with merge if PRESET_APPLY_ACTION_KEY is merge', () => {
			mockPlugin.settingsService.settings[PRESET_APPLY_ACTION_KEY] = 'merge';
			const onConfirm = vi.fn();
			presetService.confirmApply('Preset', onConfirm);
			expect(onConfirm).toHaveBeenCalledWith('merge');
		});

		it('should open ConfirmModal if PRESET_APPLY_ACTION_KEY is ask', () => {
			mockPlugin.settingsService.settings[PRESET_APPLY_ACTION_KEY] = 'ask';
			const onConfirm = vi.fn();
			presetService.confirmApply('Preset', onConfirm);
			expect(onConfirm).not.toHaveBeenCalled();
		});
	});

	describe('Miscellaneous', () => {
		it('should reset targetView to auto when isolate-mode-changed is emitted', () => {
			presetService.targetView = 'isolate';
			const callback = mockPlugin.settingsService.on.mock.calls.find(
				(call: any) => call[0] === 'isolate-mode-changed',
			)[1];
			callback();
			expect(presetService.targetView).toBe('auto');
		});

		it('should call setSettings when savePresets is called', async () => {
			presetService.targetView = 'shared';
			mockPlugin.settingsService.sharedSettings._manager_presets = [{ id: '1', name: 'P1' }];
			await presetService.savePresets();
			expect(mockPlugin.settingsService.setSettings).toHaveBeenCalledWith(
				{ _manager_presets: [{ id: '1', name: 'P1' }] },
				{ silentUI: true, target: 'shared' },
			);
		});

		it('should wrap applyPresets in applyPreset', async () => {
			const spy = vi.spyOn(presetService, 'applyPresets');
			await presetService.applyPreset('1', false);
			expect(spy).toHaveBeenCalledWith(['1'], false);
		});

		it('should return a formatted timestamp', () => {
			const timestamp = presetService.getFormattedTimestamp('YYYY');
			expect(typeof timestamp).toBe('string');
		});
	});

	describe('Trash Operations', () => {
		const mockPresets: Preset[] = [
			{ id: '1', name: 'My Preset!', created: 100, data: { a: 1 } },
		];

		it('should do nothing if trashOption is "none"', async () => {
			mockPlugin.settingsService.bridge.getNativeConfig.mockReturnValue('none');
			await presetService.trashPresets(mockPresets);
			expect(mockPlugin.settingsService.bridge.createFile).not.toHaveBeenCalled();
		});

		it('should backup and trash presets when trashOption is enabled', async () => {
			mockPlugin.settingsService.bridge.getNativeConfig.mockReturnValue('trash');
			await presetService.trashPresets(mockPresets);
			
			expect(mockPlugin.settingsService.bridge.createFile).toHaveBeenCalled();
			const filename = mockPlugin.settingsService.bridge.createFile.mock.calls[0][0];
			expect(filename).toMatch(/my-preset.*-style-manager.*\.json/);
			expect(mockPlugin.settingsService.bridge.trashFile).toHaveBeenCalled();
		});

		it('should notify error if backup fails', async () => {
			mockPlugin.settingsService.bridge.getNativeConfig.mockReturnValue('trash');
			mockPlugin.settingsService.bridge.createFile.mockRejectedValue(new Error('Disk Full'));
			
			await presetService.trashPresets(mockPresets);
			expect(mockPlugin.settingsService.notifications.error).toHaveBeenCalledWith(
				expect.stringContaining('Error backing up preset "My Preset!"'),
			);
		});
	});
});

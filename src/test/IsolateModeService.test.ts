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

import { THEME_KEY } from '../constants';

import { IsolateModeService } from '../application/IsolateModeService';

describe('IsolateModeService', () => {
	let service: IsolateModeService;
	let mockDelegate: any;

	beforeEach(() => {
		const mockSettingsService = {
			settings: {},
			notifications: { isolate: vi.fn() },
			syncSnippetState: vi.fn().mockResolvedValue(undefined),
			refreshService: { trigger: vi.fn() },
			save: vi.fn().mockResolvedValue(undefined),
			updateMerged: vi.fn(),
			applyTheme: vi.fn(),
			applyAppearance: vi.fn(),
			applyAccentColor: vi.fn(),
		};

		mockDelegate = {
			getSharedSettings: vi.fn().mockReturnValue({}),
			setSharedSettings: vi.fn(),
			save: vi.fn().mockResolvedValue(undefined),
			updateMerged: vi.fn(),
			applyTheme: vi.fn().mockResolvedValue(undefined),
			applyAppearance: vi.fn(),
			applyAccentColor: vi.fn(),
			triggerGlobal: vi.fn(),
			themeService: { isApplyingPersistentTheme: false },
			bridge: {
				getNativeConfig: vi.fn(),
				setNativeConfig: vi.fn(),
				getEnabledSnippets: vi.fn().mockReturnValue([]),
			},
			styleGenerator: {
				removeClasses: vi.fn(),
				initClasses: vi.fn(),
				setCSSVariables: vi.fn(),
				rerenderAll: vi.fn(),
			},
			viewManager: { rerenderAll: vi.fn() },
			plugin: {
				reloadAll: vi.fn().mockResolvedValue(undefined),
				parseCSS: vi.fn(),
				settingsService: mockSettingsService,
			},
		};
		service = new IsolateModeService(mockDelegate);
	});

	it('should activate Isolate Mode and take snapshot if empty', async () => {
		mockDelegate.getSharedSettings.mockReturnValue({
			[THEME_KEY]: 'shared-theme',
		});

		await service.setIsolateMode(true);

		expect(service.isIsolateMode()).toBe(true);
		expect(service.isolateSettings[THEME_KEY]).toBe('shared-theme');
		expect(mockDelegate.updateMerged).toHaveBeenCalled();
		expect(mockDelegate.triggerGlobal).toHaveBeenCalledWith(
			'isolate-mode-changed'
		);
	});

	it('should deactivate Isolate Mode and reload all', async () => {
		service.loadState(true, { 'a@@1': 'v' });

		await service.setIsolateMode(false);

		expect(service.isIsolateMode()).toBe(false);
		expect(
			mockDelegate.plugin.settingsService.refreshService.trigger
		).toHaveBeenCalled();
		expect(mockDelegate.triggerGlobal).toHaveBeenCalledWith(
			'isolate-mode-changed'
		);
	});

	it('should push Isolated settings to shared', async () => {
		service.loadState(true, { [THEME_KEY]: 'local-theme', 'a@@1': 'v' });
		mockDelegate.getSharedSettings.mockReturnValue({ orig: 'val' });

		await service.pushToShared();

		expect(service.isIsolateMode()).toBe(false);
		expect(service.isolateSettings).toEqual({});
		expect(mockDelegate.setSharedSettings).toHaveBeenCalledWith(
			expect.objectContaining({
				[THEME_KEY]: 'local-theme',
				'a@@1': 'v',
				orig: 'val',
			})
		);
		expect(mockDelegate.bridge.setNativeConfig).toHaveBeenCalledWith(
			'cssTheme',
			'local-theme'
		);
		expect(
			mockDelegate.plugin.settingsService.refreshService.trigger
		).toHaveBeenCalled();
	});

	it('should create a fresh snapshot from the shared settings', () => {
		mockDelegate.getSharedSettings.mockReturnValue({ 'snap@@1': 'val' });
		mockDelegate.bridge.getNativeConfig.mockImplementation((k: string) =>
			k === 'cssTheme' ? 'current-theme' : null
		);

		const snapshot = service.snapshotSharedToIsolate();

		expect(snapshot['snap@@1']).toBe('val');
		expect(snapshot[THEME_KEY]).toBe('current-theme');
	});

	it('should initialize state correctly via loadState', () => {
		const settings = { 'some@@key': 'value' };
		service.loadState(true, settings);

		expect(service.isIsolateMode()).toBe(true);
		expect(service.isolateSettings).toEqual(settings);
	});

	it('should reset isolate settings to a fresh shared snapshot', async () => {
		service.loadState(true, { 'old@@key': 'old' });
		mockDelegate.getSharedSettings.mockReturnValue({ 'new@@key': 'new' });

		await service.resetIsolateSettings();

		expect(service.isolateSettings['new@@key']).toBe('new');
		expect(service.isolateSettings['old@@key']).toBeUndefined();
		expect(mockDelegate.save).toHaveBeenCalled();
		expect(mockDelegate.updateMerged).toHaveBeenCalled();
		expect(
			mockDelegate.plugin.settingsService.notifications.isolate
		).toHaveBeenCalled();
	});
});

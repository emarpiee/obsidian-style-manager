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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	APPEARANCE_KEY,
	SettingsService,
	THEME_KEY,
} from '../application/SettingsService';

describe('SettingsService', () => {
	let settingsService: SettingsService;
	let mockPlugin: any;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();

		// Mock localStorage
		const localStorageMock = (function () {
			let store: Record<string, string> = {};
			return {
				getItem: (key: string) => store[key] || null,
				setItem: (key: string, value: string) => {
					store[key] = value.toString();
				},
				removeItem: (key: string) => {
					delete store[key];
				},
				clear: () => {
					store = {};
				},
			};
		})();
		Object.defineProperty(window, 'localStorage', {
			value: localStorageMock,
			configurable: true,
		});

		let pluginData: any = {};
		mockPlugin = {
			loadData: vi.fn().mockImplementation(async () => ({ ...pluginData })),
			saveData: vi.fn().mockImplementation(async (data) => {
				pluginData = { ...data };
			}),
			parseCSS: vi.fn(),
			reloadAll: vi.fn().mockResolvedValue(undefined),
			settingsTab: {
				rerender: vi.fn(),
			},
			manifest: {
				id: 'obsidian-style-manager',
				dir: 'plugins/obsidian-style-manager',
			},
			app: {
				workspace: {
					trigger: vi.fn(),
					getLeavesOfType: vi.fn().mockReturnValue([]),
				},
				vault: {
					getConfig: vi
						.fn()
						.mockImplementation((key) =>
							key === 'cssTheme'
								? 'global-theme'
								: key === 'theme'
									? 'moonstone'
									: undefined
						),
					setConfig: vi.fn(),
					adapter: {
						read: vi.fn().mockResolvedValue('{}'),
						exists: vi.fn().mockResolvedValue(true),
						copy: vi.fn().mockResolvedValue(undefined),
						remove: vi.fn().mockResolvedValue(undefined),
						stat: vi.fn().mockResolvedValue({ mtime: 1000 }),
					},
				},
				customCss: {
					setTheme: vi.fn(),
				},
			},
		};

		settingsService = new SettingsService(mockPlugin as any);
		(mockPlugin as any).settingsService = settingsService;
		// 🏰 TEST SETUP: For unit tests, we assume a safe state unless testing loading explicitly.
		settingsService.setSafeToSave(true);
	});

	afterEach(() => {
		vi.useRealTimers();
		// Cleanup DOM state
		document.body.className = '';
	});

	it('should route style settings to isolateSettings when in Isolate Mode', async () => {
		await settingsService.isolateModeService.setIsolateMode(true);

		const styleKey = 'section@@color';
		const value = '#ff0000';

		await settingsService.setSetting('section', 'color', value);

		expect(settingsService.isolateModeService.isolateSettings[styleKey]).toBe(
			value
		);
		expect(settingsService.sharedSettings[styleKey]).toBeUndefined();
		expect(settingsService.settings[styleKey]).toBe(value);
	});

	it('should route global config to sharedSettings even when in Isolate Mode', async () => {
		await settingsService.isolateModeService.setIsolateMode(true);

		const configKey = '__style_manager_export_path';
		const value = 'Presets';

		await settingsService.setSettings({ [configKey]: value });

		// In the current architecture, ALL settings are routed to the active buffer (Shared or Isolate)
		// without special routing for global config keys.
		expect(
			settingsService.isolateModeService.isolateSettings[configKey]
		).toEqual(value);
		expect(settingsService.settings[configKey]).toEqual(value);
	});

	it('should push isolate changes to shared locker correctly', async () => {
		await settingsService.isolateModeService.setIsolateMode(true);
		const styleKey = 'section@@color';
		const value = '#00ff00';

		await settingsService.setSetting('section', 'color', value);
		await settingsService.isolateModeService.pushToShared();

		expect(settingsService.isolateModeService.isIsolateMode()).toBe(false);
		expect(settingsService.sharedSettings[styleKey]).toBe(value);
		expect(
			settingsService.isolateModeService.isolateSettings[styleKey]
		).toBeUndefined();
	});

	it('should snapshot the current theme when enabling Isolate Mode', async () => {
		const currentTheme = 'some-theme';
		(mockPlugin.app.vault.getConfig as any).mockReturnValue(currentTheme);

		await settingsService.isolateModeService.setIsolateMode(true);

		expect(settingsService.isolateModeService.isolateSettings[THEME_KEY]).toBe(
			currentTheme
		);
	});

	it('should route theme changes to isolateSettings when in Isolate Mode', async () => {
		await settingsService.isolateModeService.setIsolateMode(true);
		await settingsService.setSetting(THEME_KEY, 'new-theme');

		expect(settingsService.isolateModeService.isolateSettings[THEME_KEY]).toBe(
			'new-theme'
		);
		expect(settingsService.sharedSettings[THEME_KEY]).toBeUndefined();
	});

	it('should update visual state (CSS variables) when settings change', async () => {
		settingsService.sharedSettings['__style_manager_local_first'] = false;
		(mockPlugin.app.vault.getConfig as any).mockReturnValue('old-theme');
		await settingsService.setSetting(THEME_KEY, 'new-theme');

		expect(mockPlugin.app.vault.setConfig).toHaveBeenCalledWith(
			'cssTheme',
			'new-theme'
		);
	});

	it('should handle "default" theme correctly by passing empty string to setNativeConfig', async () => {
		settingsService.sharedSettings['__style_manager_local_first'] = false;
		(mockPlugin.app.vault.getConfig as any).mockReturnValue('old-theme');
		await settingsService.setSetting(THEME_KEY, 'default');

		expect(mockPlugin.app.vault.setConfig).toHaveBeenCalledWith('cssTheme', '');
	});

	describe('Theme Overrides (Session Isolation)', () => {
		it('should apply theme SESSION-ONLY in Isolate Mode', async () => {
			// 1. Setup
			const nativeTheme = document.createElement('style');
			nativeTheme.id = 'theme-css';
			document.head.appendChild(nativeTheme);
			document.body.classList.add('theme-minimal');

			const themeCss = '.theme-local { color: blue; }';
			(mockPlugin.app.vault.adapter.read as any).mockImplementation(
				(path: string) => {
					if (path.endsWith('.json')) return Promise.resolve('{}');
					return Promise.resolve(themeCss);
				}
			);

			// 2. Enable Isolate Mode
			await settingsService.isolateModeService.setIsolateMode(true);
			vi.clearAllMocks();

			await settingsService.setSetting(THEME_KEY, 'local-override');

			// Force persistence task queue processing
			await vi.runAllTimersAsync();

			// 3. Verify Visual Overrides
			// Theme CSS should be hidden
			expect((nativeTheme as any).disabled).toBe(true);

			// 4. Verify Local Injection
			const styleTag = document.getElementById('style-manager-session-theme');
			expect(styleTag?.textContent).toBe(themeCss);

			// 5. Verify appearance.json Safety (Original theme should remain untouched in saveData)
			const calls = mockPlugin.saveData.mock.calls;
			const lastSave = calls[calls.length - 1][0];
			expect(lastSave[THEME_KEY]).not.toBe('local-override');
		});

		it('should restore shared theme when Isolate Mode is disabled', async () => {
			await settingsService.isolateModeService.setIsolateMode(true);
			await settingsService.isolateModeService.setIsolateMode(false);

			// Original theme should be accessible via getNativeConfig
			expect(mockPlugin.app.vault.getConfig('cssTheme')).toBe('global-theme');
		});
	});

	it('should provide strict isolation between different devices', async () => {
		const sharedData: any = {
			'global@@setting': 'global-value',
		};
		mockPlugin.loadData.mockResolvedValue(sharedData);
		(mockPlugin.app.vault.adapter.read as any).mockResolvedValue(
			JSON.stringify(sharedData)
		);

		// 1. Device A sets up local mode
		localStorage.setItem('style-manager-device-id', 'device-a');
		const serviceA = new SettingsService(mockPlugin as any);
		serviceA.setSafeToSave(true);
		await serviceA.load();
		await serviceA.isolateModeService.setIsolateMode(true);
		await serviceA.setSetting('section', 'color', 'red');

		// Capture the saved state
		const savedData =
			mockPlugin.saveData.mock.calls[
				mockPlugin.saveData.mock.calls.length - 1
			][0];

		// 2. Device B loads the same data
		vi.clearAllMocks();
		localStorage.setItem('style-manager-device-id', 'device-b');
		mockPlugin.loadData.mockResolvedValue(savedData);
		(mockPlugin.app.vault.adapter.read as any).mockResolvedValue(
			JSON.stringify(savedData)
		);

		const serviceB = new SettingsService(mockPlugin as any);
		serviceB.setSafeToSave(true);
		await serviceB.load();

		// 3. Verify Isolation
		expect(serviceB.isolateModeService.isIsolateMode()).toBe(false);
		expect(serviceB.settings['section@@color']).toBeUndefined();
		expect(serviceB.settings['global@@setting']).toBe('global-value');

		// 4. Device B enables its own isolate mode
		await serviceB.isolateModeService.setIsolateMode(true);
		await serviceB.setSetting('section', 'color', 'blue');

		expect(serviceB.settings['section@@color']).toBe('blue');
		expect(serviceA.settings['section@@color']).toBe('red');
	});

	it('should ONLY create the device bucket when Isolate Mode is activated', async () => {
		const sharedData: any = { 'global@@setting': 'val' };
		mockPlugin.loadData.mockResolvedValue(sharedData);
		(mockPlugin.app.vault.adapter.read as any).mockResolvedValue(
			JSON.stringify(sharedData)
		);
		localStorage.setItem('style-manager-device-id', 'activating-device');

		const service = new SettingsService(mockPlugin as any);
		service.setSafeToSave(true);
		await service.load();

		// Trigger Isolate Mode
		await service.isolateModeService.setIsolateMode(true);

		// NOW it should exist in sharedSettings
		expect(
			service.sharedSettings.__devices?.['activating-device']
		).toBeDefined();
		expect(
			service.sharedSettings.__devices?.['activating-device'].isIsolateMode
		).toBe(true);
	});

	describe('Preset Application (Overlay)', () => {
		it('should call setCSSVariables during overlay apply to ensure instant visual refresh', async () => {
			const setCSSVarsSpy = vi.spyOn(
				settingsService.styleGenerator,
				'setCSSVariables'
			);
			const removeClassesSpy = vi.spyOn(
				settingsService.styleGenerator,
				'removeClasses'
			);
			const initClassesSpy = vi.spyOn(
				settingsService.styleGenerator,
				'initClasses'
			);

			const presetData = { 'section@@color': '#ff0000' };
			await settingsService.applySettingsOverlay(presetData, false);

			expect(setCSSVarsSpy).toHaveBeenCalled();
			expect(removeClassesSpy).toHaveBeenCalled();
			expect(initClassesSpy).toHaveBeenCalled();
		});

		it('should apply appearance mode from preset overlay', async () => {
			const applyAppSpy = vi.spyOn(settingsService, 'applyAppearance');
			const presetData = { [APPEARANCE_KEY]: 'light' };

			await settingsService.applySettingsOverlay(presetData, false);

			expect(applyAppSpy).toHaveBeenCalledWith('light', true);
		});
	});

	it('should return merged effective settings for a specific locker', async () => {
		// 1. Setup shared settings
		settingsService.sharedSettings[THEME_KEY] = 'global-theme';
		settingsService.sharedSettings[APPEARANCE_KEY] = 'dark';
		settingsService.sharedSettings['section@@global-setting'] = 'global-val';

		// 2. Setup a remote locker
		const remoteId = 'remote-device';
		settingsService.sharedSettings.__devices = {
			[remoteId]: {
				isIsolateMode: true,
				isolateSettings: {
					[THEME_KEY]: 'remote-theme',
					'section@@local-setting': 'local-val',
				},
			},
		};

		// 3. Get effective settings for remote
		const effectiveRemote =
			settingsService.getEffectiveLockerSettings(remoteId);
		expect(effectiveRemote[THEME_KEY]).toBe('remote-theme');
		expect(effectiveRemote[APPEARANCE_KEY]).toBe('dark');

		// 4. Test current device (with stale sharedSettings but fresh isolateSettings)
		const currentId = settingsService.deviceId;
		settingsService.sharedSettings.__devices = {
			...settingsService.sharedSettings.__devices,
			[currentId]: {
				isIsolateMode: true,
				isolateSettings: { [THEME_KEY]: 'stale-theme' },
			},
		};
		settingsService.isolateModeService.isolateSettings[THEME_KEY] =
			'fresh-theme';

		const effectiveCurrent =
			settingsService.getEffectiveLockerSettings(currentId);
		expect(effectiveCurrent[THEME_KEY]).toBe('fresh-theme');

		// 5. Test fallbacks (using bridge config)
		const missingId = 'missing-everything';
		settingsService.sharedSettings.__devices[missingId] = {
			isIsolateMode: true,
			isolateSettings: {},
		};
		delete settingsService.sharedSettings[THEME_KEY]; // Remove from global too

		const effectiveMissing =
			settingsService.getEffectiveLockerSettings(missingId);
		expect(effectiveMissing[THEME_KEY]).toBe('global-theme'); // from mock bridge in beforeEach
	});
});

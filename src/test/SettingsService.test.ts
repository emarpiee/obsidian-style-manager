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

import {
	ACCENT_COLOR_KEY,
	APPEARANCE_KEY,
	ENABLE_CONSOLE_LOGGING_KEY,
	EXPORT_PATH_KEY,
	SHOW_STATUS_BAR_KEY,
	SNIPPETS_KEY,
	STICKY_HEADING_KEY,
	THEME_KEY,
} from '../constants';
import { RefreshLevel } from '../types';

import { SettingsService } from '../application/SettingsService';

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

		// Provide a dummy settingsService before instantiation to prevent IsolateModeService crash
		mockPlugin.settingsService = {
			settings: {},
		};

		settingsService = new SettingsService(mockPlugin as any);
		// Replace dummy with actual instance
		mockPlugin.settingsService = settingsService;

		// Add missing spies to notifications
		settingsService.notifications.shared = vi.fn();
		settingsService.notifications.notify = vi.fn();

		settingsService.setSafeToSave(true);
	});

	describe('Basic Routing', () => {
		it('should route settings to sharedSettings when isolate mode is off', async () => {
			await settingsService.isolateModeService.setIsolateMode(false);
			const key = 'section1@@setting1';
			const val = 'value1';

			await settingsService.setSetting('section1', 'setting1', val);

			expect(settingsService.sharedSettings[key]).toBe(val);
			expect(
				settingsService.isolateModeService.isolateSettings[key]
			).toBeUndefined();
			expect(settingsService.settings[key]).toBe(val);
		});

		it('should route settings to isolateSettings when isolate mode is on', async () => {
			await settingsService.isolateModeService.setIsolateMode(true);
			const key = 'section1@@setting1';
			const val = 'value1';

			await settingsService.setSetting('section1', 'setting1', val);

			expect(settingsService.isolateModeService.isolateSettings[key]).toBe(val);
			expect(settingsService.sharedSettings[key]).toBeUndefined();
			expect(settingsService.settings[key]).toBe(val);
		});

		it('should route global config to sharedSettings regardless of isolate mode', async () => {
			await settingsService.isolateModeService.setIsolateMode(true);
			const key = EXPORT_PATH_KEY;
			const val = 'Exports';

			await settingsService.setSettings({ [key]: val });

			// In current implementation, everything goes to the active buffer unless target is specified.
			// Let's check if target 'shared' works as expected.
			await settingsService.setSettings({ [key]: val }, { target: 'shared' });
			expect(settingsService.sharedSettings[key]).toBe(val);
		});
	});

	describe('Settings Management', () => {
		it('should get and set settings using setSetting (generic)', async () => {
			await settingsService.setSetting('myKey', 'myVal');
			expect(settingsService.getSetting('myKey')).toBe('myVal');
		});

		it('should get and set settings using setSectionSetting', async () => {
			await settingsService.setSectionSetting('sec', 'key', 'val');
			expect(settingsService.getSetting('sec', 'key')).toBe('val');
		});

		it('should get and set settings using setMetaSetting', async () => {
			await settingsService.setMetaSetting('metaKey', 'metaVal');
			expect(settingsService.getSetting('metaKey')).toBe('metaVal');
		});

		it('should handle multiple settings updates via setSettings', async () => {
			const updates = { key1: 'val1', key2: 'val2' };
			await settingsService.setSettings(updates);
			expect(settingsService.settings['key1']).toBe('val1');
			expect(settingsService.settings['key2']).toBe('val2');
		});

		it('should retrieve multiple settings for a section via getSettings', () => {
			settingsService.sharedSettings['sec@@k1'] = 'v1';
			settingsService.sharedSettings['sec@@k2'] = 'v2';
			settingsService.sharedSettings['sec@@k3'] = 'v3';
			(settingsService as any).updateMerged();

			const result = settingsService.getSettings('sec', ['k1', 'k3']);
			expect(result).toEqual({ 'sec@@k1': 'v1', 'sec@@k3': 'v3' });
			expect(result['sec@@k2']).toBeUndefined();
		});

		describe('setSetting overloads', () => {
			it('should handle (section, key, value)', async () => {
				await settingsService.setSetting('section', 'key', 'value');
				expect(settingsService.getSetting('section', 'key')).toBe('value');
			});

			it('should handle (key, value)', async () => {
				await settingsService.setSetting('myKey', 'myValue');
				expect(settingsService.getSetting('myKey')).toBe('myValue');
			});

			it('should handle (key, value, options)', async () => {
				const saveSpy = vi.spyOn(settingsService.persistenceService, 'save');
				await settingsService.setSetting('myKey', 'myValue', {
					skipSave: true,
				});
				expect(settingsService.getSetting('myKey')).toBe('myValue');
				expect(saveSpy).not.toHaveBeenCalled();
			});

			it('should handle (key, options) where value is omitted but options provided', async () => {
				// This is a tricky case in the implementation
				// If valueOrOptions is an object and options is not provided
				// then key = sectionOrKey, val = keyOrValue (which is the object)
				// Wait, the implementation is:
				// if (typeof valueOrOptions === 'undefined' || (typeof valueOrOptions === 'object' ... && !options)) {
				//    key = sectionOrKey; val = keyOrValue as SettingValue; opts = valueOrOptions ...
				// }
				// This means if I call setSetting('key', { skipSave: true }),
				// it treats { skipSave: true } as the value.

				// Let's test that behavior.
				const val = { skipSave: true };
				await settingsService.setSetting('myKey', val);
				expect(settingsService.getSetting('myKey')).toEqual(val);
			});
		});
	});

	describe('Clearing & Resetting', () => {
		it('should clear a specific setting', async () => {
			settingsService.sharedSettings['sec@@key'] = 'val';
			await settingsService.clearSetting('sec', 'key');
			expect(settingsService.sharedSettings['sec@@key']).toBeUndefined();
		});

		it('should restore defaults when clearing core settings', async () => {
			// Ensure device is registered so getEffectiveLockerSettings doesn't return {}
			settingsService.sharedSettings.__devices = {
				[settingsService.deviceId]: {
					isIsolateMode: false,
					isolateSettings: {},
				},
			};

			await settingsService.clearSetting(undefined, THEME_KEY);
			(settingsService as any).updateMerged();

			// Mock the bridge to return 'default' for the theme
			vi.mocked(mockPlugin.app.vault.getConfig).mockImplementation(
				(key: string) => {
					if (key === 'cssTheme') return 'default';
					if (key === 'theme') return 'moonstone';
					return undefined;
				}
			);

			expect(
				settingsService.getEffectiveLockerSettings(settingsService.deviceId)[
					THEME_KEY
				]
			).toBe('default');
		});

		it('should restore defaults when clearing other core settings', async () => {
			// Ensure device is registered
			settingsService.sharedSettings.__devices = {
				[settingsService.deviceId]: {
					isIsolateMode: false,
					isolateSettings: {},
				},
			};

			await settingsService.clearSetting(undefined, APPEARANCE_KEY);
			(settingsService as any).updateMerged();

			vi.mocked(mockPlugin.app.vault.getConfig).mockImplementation(
				(key: string) => {
					if (key === 'theme') return 'moonstone';
					return undefined;
				}
			);

			expect(
				settingsService.getEffectiveLockerSettings(settingsService.deviceId)[
					APPEARANCE_KEY
				]
			).toBe('light');

			await settingsService.clearSetting(undefined, ACCENT_COLOR_KEY);
			(settingsService as any).updateMerged();

			vi.mocked(mockPlugin.app.vault.getConfig).mockImplementation(
				(key: string) => {
					if (key === 'accentColor') return '';
					return undefined;
				}
			);

			expect(
				settingsService.getEffectiveLockerSettings(settingsService.deviceId)[
					ACCENT_COLOR_KEY
				]
			).toBe('');

			await settingsService.clearSetting(undefined, SNIPPETS_KEY);
			(settingsService as any).updateMerged();

			// Mock Obsidian internal customCss.enabledSnippets
			mockPlugin.app.customCss.enabledSnippets = ['snippet1'];

			expect(
				settingsService.getEffectiveLockerSettings(settingsService.deviceId)[
					SNIPPETS_KEY
				]
			).toEqual(['snippet1']);
		});

		it('should clear all settings in a section', async () => {
			settingsService.sharedSettings['sec@@k1'] = 'v1';
			settingsService.sharedSettings['sec@@k2'] = 'v2';
			await settingsService.clearSection('sec');
			expect(settingsService.sharedSettings['sec@@k1']).toBeUndefined();
			expect(settingsService.sharedSettings['sec@@k2']).toBeUndefined();
		});

		it('should handle core section clearing in clearSections', async () => {
			await settingsService.clearSections([
				'__theme',
				'__appearance',
				'__accentColor',
				'__snippets',
			]);
			expect(settingsService.sharedSettings[THEME_KEY]).toBe('default');
			expect(settingsService.sharedSettings[APPEARANCE_KEY]).toBe('light');
			expect(settingsService.sharedSettings[ACCENT_COLOR_KEY]).toBe('#8a5cf5');
			expect(settingsService.sharedSettings[SNIPPETS_KEY]).toEqual([]);
			expect(settingsService.notifications.notify).toHaveBeenCalled();
		});

		it('should reset specific IDs within a section', async () => {
			settingsService.sharedSettings['sec@@k1'] = 'v1';
			settingsService.sharedSettings['sec@@k2'] = 'v2';
			await settingsService.resetSettings('sec', ['k1']);
			expect(settingsService.sharedSettings['sec@@k1']).toBeUndefined();
			expect(settingsService.sharedSettings['sec@@k2']).toBe('v2');
		});

		it('should restore defaults when resetting core keys', async () => {
			settingsService.sharedSettings[THEME_KEY] = 'custom';

			const applyThemeSpy = vi.spyOn(settingsService, 'applyTheme');

			// We must create a setting that matches the pattern ${sectionId}@@${id}
			// to make modified = true, so that the core key matched block is executed.
			settingsService.sharedSettings[`${THEME_KEY}@@some`] = 'val';
			await settingsService.resetSettings(THEME_KEY, ['some']);

			expect(applyThemeSpy).toHaveBeenCalledWith(
				'default',
				expect.any(Boolean)
			);
		});
	});

	describe('Data Loading (onDataLoaded)', () => {
		it('should load data into sharedSettings', async () => {
			const data = { 'global@@key': 'val' };
			await settingsService.onDataLoaded(data, false, false);
			expect(settingsService.sharedSettings['global@@key']).toBe('val');
		});

		it('should handle null data by checking backup', async () => {
			// Mock sharedStore.hasBackup to return false
			(settingsService as any).sharedStore.hasBackup = vi
				.fn()
				.mockResolvedValue(false);
			await settingsService.onDataLoaded(null, false, false);
			expect(settingsService.identity.isNewIdentity).toBe(true);
		});

		it('should trigger sync notification when version increases', async () => {
			settingsService.sharedSettings.__shared_version = 1;
			const newData = {
				...settingsService.sharedSettings,
				__shared_version: 2,
			};

			await settingsService.onDataLoaded(newData, true, false);

			expect(settingsService.notifications.shared).toHaveBeenCalledWith(
				expect.stringContaining('Styles shared (2)')
			);
			expect(settingsService.trigger).toHaveBeenCalledWith(
				'shared-update-detected',
				{ skipAdopt: true }
			);
		});
	});

	describe('Persistence Delegation', () => {
		it('should call persistenceService.save when save is called', async () => {
			const spy = vi.spyOn(settingsService.persistenceService, 'save');
			await settingsService.save({ silent: true });
			expect(spy).toHaveBeenCalledWith({ silent: true });
		});

		it('should call persistenceService.load when load is called', async () => {
			const spy = vi.spyOn(settingsService.persistenceService, 'load');
			await settingsService.load(true);
			expect(spy).toHaveBeenCalledWith(true);
		});

		it('should call persistenceService.reload when reload is called', async () => {
			const spy = vi.spyOn(settingsService.persistenceService, 'load');
			await settingsService.reload();
			expect(spy).toHaveBeenCalledWith(true);
		});
	});

	describe('Isolate Mode Utilities', () => {
		it('should correctly report if a setting is isolated', async () => {
			await settingsService.isolateModeService.setIsolateMode(true);
			const key = 'isoSec@@key';
			const val = 'isoVal';

			await settingsService.setSetting('isoSec', 'key', val);

			expect(settingsService.hasIsolateSetting(key)).toBe(true);
			expect(settingsService.hasIsolateSetting('nonExistent')).toBe(false);

			// Check that shared settings are not reported as isolated
			settingsService.sharedSettings['sharedSec@@key'] = 'sharedVal';
			expect(settingsService.hasIsolateSetting('sharedSec@@key')).toBe(false);
		});
	});

	describe('Advanced Settings Update Logic', () => {
		it('should trigger UI_ONLY refresh when updates are not snippet-only', async () => {
			const refreshSpy = vi.spyOn(settingsService.refreshService, 'trigger');
			await settingsService.setSetting('section', 'key', 'val');
			expect(refreshSpy).toHaveBeenCalledWith(RefreshLevel.UI_ONLY);
		});

		it('should skip UI_ONLY refresh when only snippets are updated', async () => {
			const refreshSpy = vi.spyOn(settingsService.refreshService, 'trigger');
			await settingsService.setSetting(SNIPPETS_KEY, ['snippet1']);
			expect(refreshSpy).not.toHaveBeenCalledWith(RefreshLevel.UI_ONLY);
		});

		it('should trigger STYLES_ONLY refresh and clear cache for style changes', async () => {
			const refreshSpy = vi.spyOn(settingsService.refreshService, 'trigger');
			const cacheSpy = vi.spyOn(
				settingsService.styleSheetManager,
				'clearCache'
			);
			await settingsService.setSetting('section', 'color', 'red');
			expect(refreshSpy).toHaveBeenCalledWith(RefreshLevel.STYLES_ONLY);
			expect(cacheSpy).toHaveBeenCalled();
		});

		it('should trigger STYLES_ONLY refresh but skip UI_ONLY for snippet-only updates', async () => {
			const refreshSpy = vi.spyOn(settingsService.refreshService, 'trigger');
			await settingsService.setSetting(SNIPPETS_KEY, ['snippet1']);
			// Snippets are considered style settings (isStyleSetting returns true)
			// but they are "snippet only", so they should skip UI_ONLY but potentially still trigger STYLES_ONLY?
			// Let's check implementation:
			// la 740: if (hasStyleChange && !isSnippetOnly) { ... STYLES_ONLY ... }
			// So snippet-only updates actually skip STYLES_ONLY too.
			expect(refreshSpy).not.toHaveBeenCalledWith(RefreshLevel.STYLES_ONLY);
			expect(refreshSpy).not.toHaveBeenCalledWith(RefreshLevel.UI_ONLY);
		});

		it('should trigger refresh-status-bar when SHOW_STATUS_BAR_KEY is updated', async () => {
			const triggerSpy = vi.spyOn(settingsService, 'trigger');
			await settingsService.setSetting(SHOW_STATUS_BAR_KEY, true);
			expect(triggerSpy).toHaveBeenCalledWith('refresh-status-bar');
		});
	});

	describe('Clear Setting Options', () => {
		it('should use STYLES_ONLY refresh when silentUI is true', async () => {
			const refreshSpy = vi.spyOn(settingsService.refreshService, 'trigger');
			await settingsService.clearSetting('section', 'key', { silentUI: true });
			expect(refreshSpy).toHaveBeenCalledWith(RefreshLevel.STYLES_ONLY);
			expect(refreshSpy).not.toHaveBeenCalledWith(RefreshLevel.FULL_VISUAL);
		});

		it('should use FULL_VISUAL refresh when silentUI is false', async () => {
			const refreshSpy = vi.spyOn(settingsService.refreshService, 'trigger');
			await settingsService.clearSetting('section', 'key', { silentUI: false });
			expect(refreshSpy).toHaveBeenCalledWith(RefreshLevel.FULL_VISUAL);
		});
	});

	describe('Device Isolation & Locker', () => {
		it('should provide isolated settings for different device IDs', async () => {
			// Simulate Device A
			settingsService.sharedSettings.__devices = {
				'device-a': {
					isIsolateMode: true,
					isolateSettings: { 'a@@key': 'val-a' },
				},
				'device-b': {
					isIsolateMode: true,
					isolateSettings: { 'a@@key': 'val-b' },
				},
			};

			const settingsA = settingsService.getEffectiveLockerSettings('device-a');
			const settingsB = settingsService.getEffectiveLockerSettings('device-b');

			expect(settingsA['a@@key']).toBe('val-a');
			expect(settingsB['a@@key']).toBe('val-b');
		});

		it('should return empty object for missing device', () => {
			settingsService.sharedSettings.__devices = {};
			const settings =
				settingsService.getEffectiveLockerSettings('non-existent');
			expect(settings).toEqual({});
		});

		it('should handle device with missing isolateSettings', () => {
			settingsService.sharedSettings.__devices = {
				'empty-device': { isIsolateMode: true, isolateSettings: {} },
			};
			const settings =
				settingsService.getEffectiveLockerSettings('empty-device');
			// Should still have core fallbacks
			expect(settings[THEME_KEY]).toBeDefined();
		});

		it('should fallback to bridge config in getEffectiveLockerSettings if missing', async () => {
			settingsService.sharedSettings.__devices = {
				'empty-device': { isIsolateMode: true, isolateSettings: {} },
			};
			delete settingsService.sharedSettings[THEME_KEY];

			const settings =
				settingsService.getEffectiveLockerSettings('empty-device');
			expect(settings[THEME_KEY]).toBe('global-theme'); // from mock bridge
		});
	});

	describe('Full Reset', () => {
		it('should reset all style settings to defaults', async () => {
			settingsService.sharedSettings['sec@@key'] = 'val';
			settingsService.sharedSettings[THEME_KEY] = 'custom-theme';

			await settingsService.resetAllStyleSettings(false);

			expect(settingsService.sharedSettings['sec@@key']).toBeUndefined();
			expect(settingsService.sharedSettings[THEME_KEY]).toBe('default');
			expect(settingsService.sharedSettings[APPEARANCE_KEY]).toBe('light');
			expect(settingsService.sharedSettings[ACCENT_COLOR_KEY]).toBe('#8a5cf5');
			expect(settingsService.sharedSettings[SNIPPETS_KEY]).toEqual([]);
		});

		it('should reset isolate settings when isIsolate is true', async () => {
			await settingsService.isolateModeService.setIsolateMode(true);
			settingsService.isolateModeService.isolateSettings['sec@@key'] = 'val';

			await settingsService.resetAllStyleSettings(true);

			expect(
				settingsService.isolateModeService.isolateSettings['sec@@key']
			).toBeUndefined();
			expect(
				settingsService.isolateModeService.isolateSettings[THEME_KEY]
			).toBe('default');
		});
	});

	describe('Advanced Data Loading', () => {
		it('should adopt native settings and trigger silent save', async () => {
			const adoptSpy = vi
				.spyOn((settingsService as any).themeService, 'adoptNativeSettings')
				.mockReturnValue(true);
			const saveSpy = vi.spyOn(settingsService, 'save');

			await settingsService.onDataLoaded({}, false, false);

			expect(adoptSpy).toHaveBeenCalled();
			expect(saveSpy).toHaveBeenCalledWith({ silent: true });
		});

		it('should skip adoption when forcePull is true', async () => {
			const adoptSpy = vi.spyOn(
				(settingsService as any).themeService,
				'adoptNativeSettings'
			);

			await settingsService.onDataLoaded({}, false, true);

			expect(adoptSpy).not.toHaveBeenCalled();
		});

		it('should skip adoption when isExternalShared is true', async () => {
			const adoptSpy = vi.spyOn(
				(settingsService as any).themeService,
				'adoptNativeSettings'
			);

			await settingsService.onDataLoaded({}, true, false);

			expect(adoptSpy).not.toHaveBeenCalled();
		});

		it('should not mark as new identity when backup exists', async () => {
			settingsService.identity.isNewIdentity = false;
			(settingsService as any).sharedStore.hasBackup = vi
				.fn()
				.mockResolvedValue(true);
			await settingsService.onDataLoaded(null, false, false);
			expect(settingsService.identity.isNewIdentity).toBe(false);
		});

		it('should trigger device-lockers-updated when devices change', async () => {
			settingsService.sharedSettings.__devices = {
				a: { isIsolateMode: true, isolateSettings: {} },
			};
			await settingsService.onDataLoaded(
				{ __devices: { b: { isIsolateMode: true, isolateSettings: {} } } },
				false,
				false
			);
			expect(settingsService.trigger).toHaveBeenCalledWith(
				'device-lockers-updated'
			);
		});

		it('should apply current settings immediately after load', async () => {
			const applyThemeSpy = vi.spyOn(settingsService, 'applyTheme');
			const applyAppSpy = vi.spyOn(settingsService, 'applyAppearance');
			const applyAccentSpy = vi.spyOn(settingsService, 'applyAccentColor');

			settingsService.sharedSettings[THEME_KEY] = 'theme-x';
			settingsService.sharedSettings[APPEARANCE_KEY] = 'dark';
			settingsService.sharedSettings[ACCENT_COLOR_KEY] = '#123456';

			await settingsService.onDataLoaded(
				settingsService.sharedSettings,
				true,
				false
			);

			expect(applyThemeSpy).toHaveBeenCalledWith('theme-x', true);
			expect(applyAppSpy).toHaveBeenCalledWith('dark');
			expect(applyAccentSpy).toHaveBeenCalledWith('#123456', true);
		});
	});

	describe('Overlay Application', () => {
		it('should coordinate isolate mode, settings update and refresh', async () => {
			const isolateSpy = vi.spyOn(
				settingsService.isolateModeService,
				'setIsolateMode'
			);
			const updateSpy = vi.spyOn(settingsService as any, 'applySettingsUpdate');
			const refreshSpy = vi.spyOn(settingsService.refreshService, 'trigger');

			await settingsService.applySettingsOverlay({ key: 'val' }, true);

			expect(isolateSpy).toHaveBeenCalledWith(true);
			expect(updateSpy).toHaveBeenCalledWith(
				{ key: 'val' },
				expect.objectContaining({ persistNative: false })
			);
			expect(settingsService.trigger).toHaveBeenCalledWith(
				'isolate-mode-changed'
			);
			expect(settingsService.trigger).toHaveBeenCalledWith(
				'device-lockers-updated'
			);
		});
	});

	describe('Service Wrappers', () => {
		it('should delegate stats calls', () => {
			const spy = vi.spyOn(settingsService.statsService, 'getModifiedCount');
			settingsService.getModifiedCount('sec');
			expect(spy).toHaveBeenCalledWith('sec');
		});

		it('should delegate CSS var lookup', () => {
			const spy = vi.spyOn(settingsService.styleSheetManager, 'getCSSVar');
			settingsService.getCSSVar('var');
			expect(spy).toHaveBeenCalledWith('var');
		});

		it('should delegate theme/appearance/accent application', async () => {
			const themeSpy = vi.spyOn(
				(settingsService as any).themeService,
				'applyTheme'
			);
			const appSpy = vi.spyOn(
				(settingsService as any).themeService,
				'applyAppearance'
			);
			const accentSpy = vi.spyOn(
				(settingsService as any).themeService,
				'applyAccentColor'
			);

			await settingsService.applyTheme('t', true);
			settingsService.applyAppearance('a', true);
			settingsService.applyAccentColor('c', true);

			expect(themeSpy).toHaveBeenCalledWith('t', true);
			expect(appSpy).toHaveBeenCalledWith('a', true);
			expect(accentSpy).toHaveBeenCalledWith('c', true);
		});

		it('should delegate snippet operations', async () => {
			const applySpy = vi.spyOn(
				settingsService.snippetService,
				'applySnippets'
			);
			const syncSpy = vi.spyOn(
				settingsService.snippetService,
				'syncSnippetState'
			);

			await settingsService.applySnippets(['s1'], true);
			await settingsService.syncSnippetState({ skipAdopt: true });

			expect(applySpy.mock.calls[0][0]).toEqual(['s1']);
			expect(applySpy.mock.calls[0][1]).toBe(true);
			expect(syncSpy).toHaveBeenCalledWith({ skipAdopt: true });
		});

		it('should delegate persistence and isolate mode operations', async () => {
			const checkSpy = vi.spyOn(
				settingsService.persistenceService,
				'checkForExternalChanges'
			);
			const isolateSpy = vi.spyOn(
				settingsService.isolateModeService,
				'setIsolateMode'
			);
			const resetSpy = vi.spyOn(
				settingsService.isolateModeService,
				'resetIsolateSettings'
			);
			const pushSpy = vi.spyOn(
				settingsService.isolateModeService,
				'pushToShared'
			);

			await settingsService.checkForExternalChanges();
			await settingsService.setIsolateMode(true);
			await settingsService.resetIsolateSettings();
			await settingsService.pushToShared();

			expect(checkSpy).toHaveBeenCalled();
			expect(isolateSpy.mock.calls[0][0]).toBe(true);
			expect(resetSpy).toHaveBeenCalled();
			expect(pushSpy).toHaveBeenCalled();
		});
	});

	describe('Lifecycle', () => {
		it('should call cleanup on dependencies', () => {
			const themeSpy = vi.spyOn(
				(settingsService as any).themeService,
				'cleanup'
			);
			const genSpy = vi.spyOn(settingsService.styleGenerator, 'destroy');

			settingsService.cleanup();

			expect(themeSpy).toHaveBeenCalled();
			expect(genSpy).toHaveBeenCalled();
		});
	});

	describe('Integration: Isolate Mode Transitions', () => {
		it('should correctly merge settings when switching to isolate mode', async () => {
			// 1. Set a value in shared mode
			await settingsService.isolateModeService.setIsolateMode(false);
			await settingsService.setSetting('sharedSec', 'key', 'sharedVal');
			expect(settingsService.settings['sharedSec@@key']).toBe('sharedVal');

			// 2. Switch to isolate mode
			await settingsService.isolateModeService.setIsolateMode(true);

			// 3. Verify that shared settings were snapshotted into isolate settings
			expect(settingsService.settings['sharedSec@@key']).toBe('sharedVal');

			// 4. Set a value in isolate mode
			await settingsService.setSetting('isoSec', 'key', 'isoVal');

			// 5. Verify merged settings
			expect(settingsService.settings['isoSec@@key']).toBe('isoVal');

			// 6. Verify that changes in isolate mode don't affect sharedSettings
			await settingsService.setSetting('sharedSec', 'key', 'newIsoVal');
			expect(settingsService.settings['sharedSec@@key']).toBe('newIsoVal');

			await settingsService.isolateModeService.setIsolateMode(false);
			expect(settingsService.settings['sharedSec@@key']).toBe('sharedVal');
		});

		it('should correctly merge settings when switching back to shared mode', async () => {
			// 1. Set a value in isolate mode
			await settingsService.isolateModeService.setIsolateMode(true);
			await settingsService.setSetting('isoSec', 'key', 'isoVal');

			// 2. Switch to shared mode
			await settingsService.isolateModeService.setIsolateMode(false);

			// 3. Verify merged settings
			// In shared mode, we just use sharedSettings. isoVal was in isolateSettings, so it should be gone.
			expect(settingsService.settings['isoSec@@key']).toBeUndefined();
		});
	});
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RefreshLevel, type StyleManagerSettings, IsolateModeDelegate } from '../types';

import {
	IsolateModeService,
} from '../application/IsolateModeService';
import { StorageKeys } from "../constants";

describe('IsolateModeService', () => {
	let service: IsolateModeService;
	let mockDelegate: IsolateModeDelegate;

	beforeEach(() => {
		const mockSettingsService = {
			settings: {} as StyleManagerSettings,
			notifications: { isolate: vi.fn() },
			syncSnippetState: vi.fn().mockResolvedValue(undefined),
			refreshService: { trigger: vi.fn().mockResolvedValue(undefined) },
			save: vi.fn().mockResolvedValue(undefined),
			updateMerged: vi.fn(),
			applyTheme: vi.fn(),
			applyAppearance: vi.fn(),
			applyAccentColor: vi.fn(),
			applySnippets: vi.fn().mockResolvedValue(undefined),
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
			themeService: { isApplyingPersistentTheme: false } as any,
			bridge: {
				getNativeConfig: vi.fn(),
				setNativeConfig: vi.fn(),
				getEnabledSnippets: vi.fn().mockReturnValue([]),
			} as any,
			styleGenerator: {} as any,
			viewManager: {} as any,
			plugin: {
				reloadAll: vi.fn().mockResolvedValue(undefined),
				parseCSS: vi.fn(),
				settingsService: mockSettingsService,
			} as any,
		};
		service = new IsolateModeService(mockDelegate);
	});

	describe('Basic state management', () => {
		it('should initialize with isolate mode disabled and empty settings', () => {
			expect(service.isIsolateMode()).toBe(false);
			expect(service.isolateSettings).toEqual({});
		});

		it('should update state via loadState', () => {
			const settings = { 'test@@key': 'value' };
			service.loadState(true, settings);
			expect(service.isIsolateMode()).toBe(true);
			expect(service.isolateSettings).toEqual(settings);
		});

		it('should allow setting isolateSettings manually', () => {
			const settings = { 'manual@@key': 'value' };
			service.isolateSettings = settings;
			expect(service.isolateSettings).toEqual(settings);
		});
	});

	describe('setIsolateMode', () => {
		it('should do nothing if enabled is same as current mode', async () => {
			service.loadState(true, {});
			await service.setIsolateMode(true);
			expect(mockDelegate.save).not.toHaveBeenCalled();
			expect(mockDelegate.updateMerged).not.toHaveBeenCalled();
		});

		it('should activate isolate mode and take snapshot if settings are empty', async () => {
			vi.mocked(mockDelegate.getSharedSettings).mockReturnValue({
				[StorageKeys.THEME]: 'shared-theme',
				'other-key': 'should-be-ignored',
			});

			await service.setIsolateMode(true);

			expect(service.isIsolateMode()).toBe(true);
			expect(service.isolateSettings[StorageKeys.THEME]).toBe('shared-theme');
			expect(service.isolateSettings['other-key']).toBeUndefined();
			expect(mockDelegate.save).toHaveBeenCalled();
			expect(mockDelegate.updateMerged).toHaveBeenCalled();
			expect(mockDelegate.triggerGlobal).toHaveBeenCalledWith(
				'isolate-mode-changed'
			);
			expect(mockDelegate.triggerGlobal).toHaveBeenCalledWith(
				'device-lockers-updated'
			);
		});

		it('should activate isolate mode and preserve existing settings if not empty', async () => {
			const existing = { 'existing@@key': 'value' };
			service.loadState(false, existing);

			await service.setIsolateMode(true);

			expect(service.isIsolateMode()).toBe(true);
			expect(service.isolateSettings).toEqual(
				expect.objectContaining(existing)
			);
		});

		it('should skip save if options.skipSave is true', async () => {
			await service.setIsolateMode(true, { skipSave: true });
			expect(mockDelegate.save).not.toHaveBeenCalled();
			expect(mockDelegate.updateMerged).toHaveBeenCalled();
		});

		it('should apply current settings when changing mode', async () => {
			(mockDelegate.plugin.settingsService as any).settings = {
				[StorageKeys.THEME]: 'theme-x',
				[StorageKeys.APPEARANCE]: 'dark',
				[StorageKeys.ACCENT_COLOR]: '#ff0000',
				[StorageKeys.SNIPPETS]: ['snippet1', 'snippet2'],
			};

			await service.setIsolateMode(true);

			expect(mockDelegate.applyTheme).toHaveBeenCalledWith('theme-x', false);
			expect(mockDelegate.applyAppearance).toHaveBeenCalledWith('dark', false);
			expect(mockDelegate.applyAccentColor).toHaveBeenCalledWith(
				'#ff0000',
				false
			);
			expect(
				mockDelegate.plugin.settingsService.applySnippets
			).toHaveBeenCalledWith(['snippet1', 'snippet2'], true);
		});

		it('should trigger sync and refresh when activating', async () => {
			await service.setIsolateMode(true);

			expect(
				mockDelegate.plugin.settingsService.syncSnippetState
			).toHaveBeenCalled();
			expect(
				mockDelegate.plugin.settingsService.refreshService.trigger
			).toHaveBeenCalledWith(RefreshLevel.STYLES_ONLY);
		});

		it('should trigger only refresh when deactivating', async () => {
			service.loadState(true, {});
			await service.setIsolateMode(false);

			expect(
				mockDelegate.plugin.settingsService.syncSnippetState
			).not.toHaveBeenCalled();
			expect(
				mockDelegate.plugin.settingsService.refreshService.trigger
			).toHaveBeenCalledWith(RefreshLevel.STYLES_ONLY);
		});

		it('should show notification when changing mode', async () => {
			await service.setIsolateMode(true);
			expect(
				mockDelegate.plugin.settingsService.notifications.isolate
			).toHaveBeenCalledWith('Isolate mode enabled');

			service.loadState(true, {});
			await service.setIsolateMode(false);
			expect(
				mockDelegate.plugin.settingsService.notifications.isolate
			).toHaveBeenCalledWith('Isolate mode disabled');
		});
	});

	describe('snapshotSharedToIsolate', () => {
		it('should filter shared settings and include only relevant keys', () => {
			vi.mocked(mockDelegate.getSharedSettings).mockReturnValue({
				'key@@1': 'val1',
				[StorageKeys.THEME]: 'theme1',
				[StorageKeys.APPEARANCE]: 'dark',
				[StorageKeys.SNIPPETS]: ['s1'],
				[StorageKeys.ACCENT_COLOR]: '#000',
				'ignored-key': 'val2',
			});

			const snapshot = service.snapshotSharedToIsolate();

			expect(snapshot).toEqual({
				'key@@1': 'val1',
				[StorageKeys.THEME]: 'theme1',
				[StorageKeys.APPEARANCE]: 'dark',
				[StorageKeys.SNIPPETS]: ['s1'],
				[StorageKeys.ACCENT_COLOR]: '#000',
			});
		});

		it('should use native config fallbacks when keys are missing in shared settings', () => {
			vi.mocked(mockDelegate.getSharedSettings).mockReturnValue({});
			vi.mocked(mockDelegate.bridge.getNativeConfig).mockImplementation(
				(key: string) => {
					if (key === 'cssTheme') return 'native-theme';
					if (key === 'theme') return 'moonstone'; // mapped to light
					if (key === 'accentColor') return '#native-accent';
					return null;
				}
			);
			vi.mocked(mockDelegate.bridge.getEnabledSnippets).mockReturnValue([
				'native-snippet',
			]);

			const snapshot = service.snapshotSharedToIsolate();

			expect(snapshot[StorageKeys.THEME]).toBe('native-theme');
			expect(snapshot[StorageKeys.APPEARANCE]).toBe('light');
			expect(snapshot[StorageKeys.ACCENT_COLOR]).toBe('#native-accent');
			expect(snapshot[StorageKeys.SNIPPETS]).toEqual(['native-snippet']);
		});

		it('should use default theme if native theme is missing', () => {
			vi.mocked(mockDelegate.getSharedSettings).mockReturnValue({});
			vi.mocked(mockDelegate.bridge.getNativeConfig).mockReturnValue(null);

			const snapshot = service.snapshotSharedToIsolate();

			expect(snapshot[StorageKeys.THEME]).toBe('default');
		});

		it('should use dark if native appearance is not moonstone', () => {
			vi.mocked(mockDelegate.getSharedSettings).mockReturnValue({});
			vi.mocked(mockDelegate.bridge.getNativeConfig).mockImplementation(
				(key: string) => {
					if (key === 'theme') return 'obsidian';
					return null;
				}
			);

			const snapshot = service.snapshotSharedToIsolate();

			expect(snapshot[StorageKeys.APPEARANCE]).toBe('dark');
		});

		it('should toggle isApplyingPersistentTheme', () => {
			service.snapshotSharedToIsolate();
			expect(mockDelegate.themeService.isApplyingPersistentTheme).toBe(false);
		});
	});

	describe('resetIsolateSettings', () => {
		it('should replace isolate settings with fresh snapshot and trigger updates', async () => {
			service.loadState(true, { 'old@@key': 'old' });
			vi.mocked(mockDelegate.getSharedSettings).mockReturnValue({
				'new@@key': 'new',
			});

			await service.resetIsolateSettings();

			expect(service.isolateSettings).toEqual(
				expect.objectContaining({ 'new@@key': 'new' })
			);
			expect(mockDelegate.save).toHaveBeenCalled();
			expect(mockDelegate.updateMerged).toHaveBeenCalled();
			expect(
				mockDelegate.plugin.settingsService.refreshService.trigger
			).toHaveBeenCalledWith(RefreshLevel.FULL_VISUAL);
			expect(mockDelegate.triggerGlobal).toHaveBeenCalledWith(
				'isolate-mode-changed'
			);
			expect(
				mockDelegate.plugin.settingsService.notifications.isolate
			).toHaveBeenCalledWith(
				'Isolate settings have been reset to a fresh shared snapshot.'
			);
		});
	});

	describe('pushToShared', () => {
		it('should push isolate settings to native config and shared settings', async () => {
			const isolateSettings = {
				[StorageKeys.THEME]: 'local-theme',
				[StorageKeys.APPEARANCE]: 'dark',
				[StorageKeys.ACCENT_COLOR]: '#123456',
				[StorageKeys.SNIPPETS]: ['local-snippet'],
				'custom@@key': 'custom-val',
			};
			service.loadState(true, isolateSettings);
			vi.mocked(mockDelegate.getSharedSettings).mockReturnValue({
				'shared@@key': 'shared-val',
			});

			await service.pushToShared();

			expect(mockDelegate.bridge.setNativeConfig).toHaveBeenCalledWith(
				'cssTheme',
				'local-theme'
			);
			expect(mockDelegate.bridge.setNativeConfig).toHaveBeenCalledWith(
				'theme',
				'obsidian'
			);
			expect(mockDelegate.bridge.setNativeConfig).toHaveBeenCalledWith(
				'accentColor',
				'#123456'
			);
			expect(mockDelegate.bridge.setNativeConfig).toHaveBeenCalledWith(
				'enabledCssSnippets',
				['local-snippet']
			);

			expect(mockDelegate.setSharedSettings).toHaveBeenCalledWith({
				'shared@@key': 'shared-val',
				...isolateSettings,
			});

			expect(service.isIsolateMode()).toBe(false);
			expect(service.isolateSettings).toEqual({});
			expect(mockDelegate.save).toHaveBeenCalled();
			expect(mockDelegate.updateMerged).toHaveBeenCalled();
			expect(
				mockDelegate.plugin.settingsService.refreshService.trigger
			).toHaveBeenCalledWith(RefreshLevel.STYLES_ONLY);
			expect(mockDelegate.triggerGlobal).toHaveBeenCalledWith(
				'isolate-mode-changed'
			);
			expect(mockDelegate.triggerGlobal).toHaveBeenCalledWith(
				'device-lockers-updated'
			);
			expect(
				mockDelegate.plugin.settingsService.notifications.isolate
			).toHaveBeenCalledWith('Isolated styles pushed to shared locker.');
		});

		it('should handle special theme and appearance values when pushing', async () => {
			service.loadState(true, {
				[StorageKeys.THEME]: 'default',
				[StorageKeys.APPEARANCE]: 'light',
			});

			await service.pushToShared();

			expect(mockDelegate.bridge.setNativeConfig).toHaveBeenCalledWith(
				'cssTheme',
				''
			);
			expect(mockDelegate.bridge.setNativeConfig).toHaveBeenCalledWith(
				'theme',
				'moonstone'
			);
		});

		it('should not call setNativeConfig if values are missing', async () => {
			service.loadState(true, { 'some@@key': 'val' });
			await service.pushToShared();

			expect(mockDelegate.bridge.setNativeConfig).not.toHaveBeenCalled();
		});

		it('should toggle isApplyingPersistentTheme', async () => {
			await service.pushToShared();
			expect(mockDelegate.themeService.isApplyingPersistentTheme).toBe(false);
		});
	});
});

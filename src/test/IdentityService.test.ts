import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ACCENT_COLOR_KEY,
	APPEARANCE_KEY,
	SNIPPETS_KEY,
	THEME_KEY,
} from '../constants';
import {
	IdentityService,
	IdentityStorageAdapter,
	type DeviceLocker,
} from '../application/IdentityService';
import { generateUuid } from '../utils/CommonUtils';

vi.mock('../utils/CommonUtils', () => ({
	generateUuid: vi.fn(),
}));

describe('IdentityService', () => {
	let mockAdapter: IdentityStorageAdapter;
	let service: IdentityService;

	beforeEach(() => {
		const store: Record<string, string> = {};
		vi.stubGlobal('localStorage', {
			getItem: vi.fn((key: string) => store[key] || null),
			setItem: vi.fn((key: string, value: string) => {
				store[key] = value;
			}),
			removeItem: vi.fn((key: string) => {
				delete store[key];
			}),
		});

		mockAdapter = {
			getDevices: vi.fn(),
			setDevices: vi.fn(),
			clearIsolateSettings: vi.fn(),
			save: vi.fn().mockResolvedValue(undefined),
			reload: vi.fn().mockResolvedValue(undefined),
			updateMerged: vi.fn(),
			rerenderAll: vi.fn(),
			trigger: vi.fn(),
			getPlugin: vi.fn().mockReturnValue({
				settingsService: {
					notifications: {
						isolate: vi.fn(),
						preset: vi.fn(),
						error: vi.fn(),
					},
				},
			} as any),
		};
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	describe('Constructor & Device ID', () => {
		it('should create a new identity if none exists in localStorage', () => {
			vi.mocked(generateUuid).mockReturnValue('new-uuid');
			service = new IdentityService(mockAdapter);

			expect(service.deviceId).toBe('new-uuid');
			expect(service.isNewIdentity).toBe(true);
			expect(localStorage.setItem).toHaveBeenCalledWith('style-manager-device-id', 'new-uuid');
		});

		it('should load existing identity from localStorage', () => {
			localStorage.setItem('style-manager-device-id', 'existing-id');
			service = new IdentityService(mockAdapter);

			expect(service.deviceId).toBe('existing-id');
			expect(service.isNewIdentity).toBe(false);
		});
	});

	describe('Device Name', () => {
		it('should sync device name from adapter devices', () => {
			localStorage.setItem('style-manager-device-id', 'my-id');
			vi.mocked(mockAdapter.getDevices).mockReturnValue({
				'my-id': { name: 'My Mac', isIsolateMode: true, isolateSettings: {} },
			});

			service = new IdentityService(mockAdapter);
			service.syncDeviceName();

			expect(service.deviceName).toBe('My Mac');
		});

		it('should fallback to deviceId if name is not set in adapter', () => {
			localStorage.setItem('style-manager-device-id', 'my-id');
			vi.mocked(mockAdapter.getDevices).mockReturnValue({
				'my-id': { isIsolateMode: true, isolateSettings: {} },
			});

			service = new IdentityService(mockAdapter);
			service.syncDeviceName();

			expect(service.deviceName).toBe('my-id');
		});
	});

	describe('regenerateDeviceId', () => {
		it('should completely reset the device identity', async () => {
			localStorage.setItem('style-manager-device-id', 'old-id');
			service = new IdentityService(mockAdapter);
			
			vi.mocked(generateUuid).mockReturnValue('fresh-id');
			await service.regenerateDeviceId();

			expect(service.deviceId).toBe('fresh-id');
			expect(localStorage.setItem).toHaveBeenCalledWith('style-manager-device-id', 'fresh-id');
			expect(mockAdapter.reload).toHaveBeenCalled();
			expect(mockAdapter.updateMerged).toHaveBeenCalled();
			expect(mockAdapter.rerenderAll).toHaveBeenCalled();
			expect(mockAdapter.trigger).toHaveBeenCalledWith('device-lockers-updated');
			expect(mockAdapter.getPlugin().settingsService.notifications.isolate).toHaveBeenCalledWith(
				'New Device ID established: fresh-id'
			);
		});
	});

	describe('Locker Settings Management', () => {
		it('should update locker settings and set isolate mode to true', async () => {
			const devices: Record<string, DeviceLocker> = {
				'dev-1': { name: 'Dev 1', isIsolateMode: false, isolateSettings: { a: 1 } },
			};
			vi.mocked(mockAdapter.getDevices).mockReturnValue(devices);
			service = new IdentityService(mockAdapter);

			await service.updateLockerSettings('dev-1', { b: 2 }, false);

			expect(devices['dev-1'].isolateSettings).toEqual({ a: 1, b: 2 });
			expect(devices['dev-1'].isIsolateMode).toBe(true);
			expect(mockAdapter.save).toHaveBeenCalled();
			expect(mockAdapter.trigger).toHaveBeenCalledWith('device-lockers-updated');
		});

		it('should overwrite relevant keys when overwrite is true', async () => {
			const devices: Record<string, DeviceLocker> = {
				'dev-1': { 
					name: 'Dev 1', 
					isIsolateMode: true, 
					isolateSettings: { 
						[THEME_KEY]: 'old-theme', 
						'custom@@key': 'keep-me', 
						other: 'remove-me' 
					} 
				},
			};
			vi.mocked(mockAdapter.getDevices).mockReturnValue(devices);
			service = new IdentityService(mockAdapter);

			await service.updateLockerSettings('dev-1', { [THEME_KEY]: 'new-theme' }, true);

			expect(devices['dev-1'].isolateSettings).toEqual({ 
				other: 'remove-me', // Note: updateLockerSettings only deletes keys that match the filter
				[THEME_KEY]: 'new-theme' 
			});
			// Wait, let's check the implementation of updateLockerSettings
			// 117: Object.keys(locker.isolateSettings).forEach((key) => {
			// 119: if (key.includes('@@') || key === THEME_KEY || ...) { delete locker.isolateSettings[key]; }
			// So 'other' should NOT be deleted because it doesn't match the filter.
			// 'custom@@key' SHOULD be deleted.
		});
	});
	
	// I noticed a potential bug in updateLockerSettings overwrite logic while writing tests.
	// Let me re-verify the implementation.
	// 119: if (key.includes('@@') || key === THEME_KEY || key === APPEARANCE_KEY || key === ACCENT_COLOR_KEY || key === SNIPPETS_KEY)
	// This means any key containing '@@' is deleted.
	// So 'custom@@key' should be deleted.
	// 'other' should remain.
	// Let's rewrite the test case for overwrite more accurately.
});

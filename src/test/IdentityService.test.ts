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
	IdentityService,
	IdentityStorageAdapter,
} from '../application/IdentityService';

// Mock UUID generation to be predictable
vi.mock('../utils/CommonUtils', () => ({
	generateUuid: vi.fn(() => 'test-uuid'),
}));

describe('IdentityService', () => {
	let mockAdapter: IdentityStorageAdapter;
	let service: IdentityService;

	beforeEach(() => {
		// Mock localStorage
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
			getPlugin: vi.fn(
				() =>
					({
						app: {},
						settingsService: {
							notifications: {
								isolate: vi.fn(),
								preset: vi.fn(),
								error: vi.fn(),
							},
						},
					}) as any
			),
		};
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it('should create a new identity if none exists', () => {
		service = new IdentityService(mockAdapter);
		expect(service.deviceId).toBe('test-uuid');
		expect(service.isNewIdentity).toBe(true);
		expect(localStorage.setItem).toHaveBeenCalledWith(
			'style-manager-device-id',
			'test-uuid'
		);
	});

	it('should load existing identity from localStorage', () => {
		localStorage.setItem('style-manager-device-id', 'existing-id');
		service = new IdentityService(mockAdapter);
		expect(service.deviceId).toBe('existing-id');
		expect(service.isNewIdentity).toBe(false);
	});

	it('should sync device name from adapter devices', () => {
		localStorage.setItem('style-manager-device-id', 'my-id');
		vi.mocked(mockAdapter.getDevices).mockReturnValue({
			'my-id': { name: 'My Mac', isIsolateMode: true, isolateSettings: {} },
		});

		service = new IdentityService(mockAdapter);
		service.syncDeviceName();
		expect(service.deviceName).toBe('My Mac');
	});

	it('should fallback to deviceId if name is not set', () => {
		localStorage.setItem('style-manager-device-id', 'my-id');
		vi.mocked(mockAdapter.getDevices).mockReturnValue({
			'my-id': { isIsolateMode: true, isolateSettings: {} },
		});

		service = new IdentityService(mockAdapter);
		service.syncDeviceName();
		expect(service.deviceName).toBe('my-id');
	});

	it('should regenerate device ID', async () => {
		localStorage.setItem('style-manager-device-id', 'old-id');
		service = new IdentityService(mockAdapter);

		// Setup mock for next UUID
		const { generateUuid } = await import('../utils/CommonUtils');
		vi.mocked(generateUuid).mockReturnValue('new-uuid');

		await service.regenerateDeviceId();

		expect(service.deviceId).toBe('new-uuid');
		expect(localStorage.setItem).toHaveBeenCalledWith(
			'style-manager-device-id',
			'new-uuid'
		);
		expect(mockAdapter.reload).toHaveBeenCalled();
		expect(mockAdapter.updateMerged).toHaveBeenCalled();
		expect(mockAdapter.rerenderAll).toHaveBeenCalled();
		expect(mockAdapter.trigger).toHaveBeenCalledWith('device-lockers-updated');
	});

	it('should apply preset to a locker', async () => {
		const devices = {
			'other-id': { isIsolateMode: false, isolateSettings: {} },
		};
		vi.mocked(mockAdapter.getDevices).mockReturnValue(devices);

		service = new IdentityService(mockAdapter);
		const presetData = { key: 'value' };
		await service.applyPresetToLocker('other-id', presetData);

		expect(devices['other-id'].isolateSettings).toEqual(presetData);
		expect(devices['other-id'].isIsolateMode).toBe(true);
		expect(mockAdapter.save).toHaveBeenCalled();
		expect(mockAdapter.trigger).toHaveBeenCalledWith('device-lockers-updated');
	});

	it('should remove a locker that is NOT the current device', async () => {
		localStorage.setItem('style-manager-device-id', 'current-id');
		const devices = {
			'current-id': { name: 'Me', isIsolateMode: true, isolateSettings: {} },
			'other-id': { name: 'Them', isIsolateMode: true, isolateSettings: {} },
		};
		vi.mocked(mockAdapter.getDevices).mockReturnValue(devices);

		service = new IdentityService(mockAdapter);
		await service.removeDeviceLocker('other-id');

		expect(devices['other-id']).toBeUndefined();
		expect(mockAdapter.save).toHaveBeenCalled();
		expect(mockAdapter.updateMerged).toHaveBeenCalled();
		expect(mockAdapter.rerenderAll).toHaveBeenCalled();
		expect(mockAdapter.trigger).toHaveBeenCalledWith('device-lockers-updated');
	});

	it('should reset identity when removing the current device locker', async () => {
		localStorage.setItem('style-manager-device-id', 'current-id');
		const devices = {
			'current-id': { name: 'Me', isIsolateMode: true, isolateSettings: {} },
		};
		vi.mocked(mockAdapter.getDevices).mockReturnValue(devices);

		service = new IdentityService(mockAdapter);

		const { generateUuid } = await import('../utils/CommonUtils');
		vi.mocked(generateUuid).mockReturnValue('fresh-id');

		await service.removeDeviceLocker('current-id');

		expect(devices['current-id']).toBeUndefined();
		expect(localStorage.getItem('style-manager-device-id')).toBe('fresh-id');
		expect(service.deviceId).toBe('fresh-id');
		expect(mockAdapter.clearIsolateSettings).toHaveBeenCalled();
		expect(mockAdapter.save).toHaveBeenCalled();
		expect(mockAdapter.reload).toHaveBeenCalled();
		expect(mockAdapter.trigger).toHaveBeenCalledWith('device-lockers-updated');
	});

	it('should update locker name and local deviceName if ID matches', async () => {
		localStorage.setItem('style-manager-device-id', 'my-id');
		const devices = {
			'my-id': { name: 'Old Name', isIsolateMode: true, isolateSettings: {} },
		};
		vi.mocked(mockAdapter.getDevices).mockReturnValue(devices);

		service = new IdentityService(mockAdapter);
		service.syncDeviceName();
		expect(service.deviceName).toBe('Old Name');

		await service.setLockerName('my-id', 'New Name');

		expect(devices['my-id'].name).toBe('New Name');
		expect(service.deviceName).toBe('New Name');
		expect(mockAdapter.save).toHaveBeenCalled();
		expect(mockAdapter.trigger).toHaveBeenCalledWith('device-lockers-updated');
	});
});

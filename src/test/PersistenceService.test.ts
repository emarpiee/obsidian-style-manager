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

import { PersistenceService } from '../application/PersistenceService';

describe('PersistenceService', () => {
	let service: PersistenceService;
	let mockOptions: any;

	beforeEach(() => {
		mockOptions = {
			sharedStore: {
				readRaw: vi.fn().mockResolvedValue(null),
				save: vi.fn().mockResolvedValue(undefined),
				load: vi.fn().mockResolvedValue(null),
				createBackup: vi.fn().mockResolvedValue(true),
				hasBackup: vi.fn().mockResolvedValue(false),
				restoreFromBackup: vi.fn().mockResolvedValue(false),
			},
			sharedStateService: {
				hasContentChanged: vi.fn().mockReturnValue(true),
				applyConflictMerge: vi.fn().mockImplementation((local) => local),
				setSyncState: vi.fn(),
				generateNextVersion: vi.fn().mockReturnValue(123),
				isExternalShared: vi.fn().mockReturnValue(false),
			},
			notifications: { error: vi.fn() },
			getDeviceId: () => 'dev-1',
			getDeviceName: () => 'Device 1',
			getSharedSettings: vi.fn().mockReturnValue({ [THEME_KEY]: 'current' }),
			setSharedSettings: vi.fn(),
			getIsolateSettings: () => ({}),
			getIsIsolateMode: () => false,
			onDataLoaded: vi.fn().mockResolvedValue(undefined),
		};
		service = new PersistenceService(mockOptions);
		service.setSafeToSave(true);
	});

	it('should save data successfully', async () => {
		await service.save();
		expect(mockOptions.sharedStore.save).toHaveBeenCalled();
		expect(mockOptions.sharedStateService.setSyncState).toHaveBeenCalled();

		const savedData = mockOptions.sharedStore.save.mock.calls[0][0];
		expect(savedData.__shared_version).toBeDefined();
		expect(savedData.__shared_version).toBeGreaterThan(0);
	});

	it('should block save if not safe', async () => {
		service.setSafeToSave(false);
		await service.save();
		expect(mockOptions.sharedStore.save).not.toHaveBeenCalled();
	});

	it('should trigger conflict merge if disk content changed', async () => {
		mockOptions.sharedStore.readRaw.mockResolvedValueOnce(
			JSON.stringify({ [THEME_KEY]: 'external' })
		);
		mockOptions.sharedStateService.hasContentChanged.mockReturnValue(true);

		await service.save();

		expect(
			mockOptions.sharedStateService.applyConflictMerge
		).toHaveBeenCalled();
		expect(mockOptions.setSharedSettings).toHaveBeenCalled();
	});

	it('should perform initial backup on first save', async () => {
		await service.save();
		expect(mockOptions.sharedStore.createBackup).toHaveBeenCalled();

		vi.clearAllMocks();
		await service.save();
		expect(mockOptions.sharedStore.createBackup).not.toHaveBeenCalled();
	});

	it('should load data and trigger onDataLoaded', async () => {
		const loadedData = { [THEME_KEY]: 'loaded' };
		mockOptions.sharedStore.load.mockResolvedValue(loadedData);
		mockOptions.sharedStore.readRaw.mockResolvedValue(
			JSON.stringify(loadedData)
		);

		await service.load();

		expect(mockOptions.onDataLoaded).toHaveBeenCalledWith(
			loadedData,
			expect.any(Boolean),
			expect.any(Boolean)
		);
		expect(mockOptions.sharedStateService.setSyncState).toHaveBeenCalled();
	});

	it('should include isolate settings in device bucket when in Isolate Mode', async () => {
		mockOptions.getIsIsolateMode = () => true;
		mockOptions.getIsolateSettings = () => ({ 'local@@key': 'local-val' });

		await service.save();

		const savedData = mockOptions.sharedStore.save.mock.calls[0][0];
		expect(savedData.__devices['dev-1']).toBeDefined();
		expect(savedData.__devices['dev-1'].isIsolateMode).toBe(true);
		expect(savedData.__devices['dev-1'].isolateSettings['local@@key']).toBe(
			'local-val'
		);
	});

	it('should update __shared_version to a new version on each save', async () => {
		mockOptions.getSharedSettings.mockReturnValue({
			[THEME_KEY]: 'current',
			__shared_version: 50,
		});
		mockOptions.sharedStateService.generateNextVersion.mockReturnValue(100);

		await service.save();

		const savedData = mockOptions.sharedStore.save.mock.calls[0][0];
		expect(savedData.__shared_version).toBe(100);
	});

	describe('Safe Mode & Protection', () => {
		it('should attempt recovery and trigger Safe Mode if recovery fails', async () => {
			mockOptions.sharedStore.load.mockResolvedValue(null);
			mockOptions.sharedStore.hasBackup.mockResolvedValue(true);
			mockOptions.sharedStore.restoreFromBackup.mockResolvedValue(false);

			await service.load();

			expect(mockOptions.sharedStore.restoreFromBackup).toHaveBeenCalled();
			expect(service.isSafeToSave).toBe(false);
			expect(mockOptions.notifications.error).toHaveBeenCalledWith(
				expect.stringContaining('backup recovery failed')
			);
		});

		it('should trigger Safe Mode if settings file is empty', async () => {
			mockOptions.sharedStore.load.mockResolvedValue({});

			await service.load();

			expect(service.isSafeToSave).toBe(false);
		});

		it('should block save when in Safe Mode', async () => {
			service.setSafeToSave(false);
			await service.save();
			expect(mockOptions.sharedStore.save).not.toHaveBeenCalled();
		});
	});
});

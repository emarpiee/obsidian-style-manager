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
import { beforeEach, describe, expect, it } from 'vitest';

import { SharedStateService } from '../application/SharedStateService';

describe('SharedStateService', () => {
	let service: SharedStateService;

	beforeEach(() => {
		service = new SharedStateService();
	});

	describe('Version Detection', () => {
		it('should detect external shared changes when disk version is higher', () => {
			service.setSyncState({ __shared_version: 100, data: 'v1' });
			expect(service.isExternalShared({ __shared_version: 150 })).toBe(true);
		});

		it('should NOT detect external shared changes when disk version is lower or equal', () => {
			service.setSyncState({ __shared_version: 100, data: 'v1' });
			expect(service.isExternalShared({ __shared_version: 50 })).toBe(false);
			expect(service.isExternalShared({ __shared_version: 100 })).toBe(false);
		});

		it('should NOT detect external shared changes if local version is 0 (first load)', () => {
			expect(service.isExternalShared({ __shared_version: 100 })).toBe(false);
		});

		it('should generate a valid non-zero version number', () => {
			const version = service.generateNextVersion();
			expect(version).toBeGreaterThan(0);
			expect(version).not.toBeNull();
		});
	});

	describe('Content Change Detection', () => {
		it('should detect changes regardless of key order', () => {
			service.setSyncState({ a: 1, b: 2 });
			expect(service.hasContentChanged({ b: 2, a: 1 })).toBe(false);
			expect(service.hasContentChanged({ a: 1, b: 3 })).toBe(true);
		});
	});

	describe('3-way Merge (applyConflictMerge)', () => {
		const deviceId = 'my-device';

		it('should perform a simple merge when no baseline exists', () => {
			const local = { 'a@@1': 'v1-local' };
			const disk = { 'b@@1': 'v1-disk' };
			const result = service.applyConflictMerge(local, disk, null, deviceId);

			expect(result).toEqual({
				'a@@1': 'v1-local',
				'b@@1': 'v1-disk',
			});
		});

		it('should adopt disk changes if local matches baseline', () => {
			const baseline = { 'a@@1': 'orig', 'b@@1': 'orig' };
			const local = { 'a@@1': 'orig', 'b@@1': 'orig' };
			const disk = { 'a@@1': 'new-disk', 'b@@1': 'orig' };

			const result = service.applyConflictMerge(
				local,
				disk,
				baseline,
				deviceId
			);
			expect(result['a@@1']).toBe('new-disk');
			expect(result['b@@1']).toBe('orig');
		});

		it('should respect disk deletions if local matches baseline', () => {
			const baseline = { 'a@@1': 'orig', 'b@@1': 'orig' };
			const local = { 'a@@1': 'orig', 'b@@1': 'orig' };
			const disk = { 'b@@1': 'orig' }; // 'a' was deleted

			const result = service.applyConflictMerge(
				local,
				disk,
				baseline,
				deviceId
			);
			expect(result).not.toHaveProperty('a@@1');
			expect(result['b@@1']).toBe('orig');
		});

		it('should preserve local changes in case of a conflict', () => {
			const baseline = { 'a@@1': 'orig' };
			const local = { 'a@@1': 'changed-local' };
			const disk = { 'a@@1': 'changed-disk' };

			const result = service.applyConflictMerge(
				local,
				disk,
				baseline,
				deviceId
			);
			expect(result['a@@1']).toBe('changed-local');
		});

		it('should merge __devices correctly, excluding current device from disk', () => {
			const baseline = {
				__devices: {
					'other-1': { name: 'Other 1' },
				},
			};
			const local = {
				__devices: {
					'my-device': { name: 'My New Name' },
					'other-1': { name: 'Other 1' },
				},
			};
			const disk = {
				__devices: {
					'my-device': { name: 'Stale My Name' },
					'other-1': { name: 'Other 1' },
					'other-2': { name: 'Added Other 2' },
				},
			};

			const result = service.applyConflictMerge(
				local,
				disk,
				baseline,
				deviceId
			) as any;

			expect(result.__devices['my-device'].name).toBe('My New Name'); // Local wins for current device
			expect(result.__devices['other-1'].name).toBe('Other 1');
			expect(result.__devices['other-2'].name).toBe('Added Other 2'); // disk addition accepted
		});

		it('should respect device deletions from disk', () => {
			const baseline = {
				__devices: {
					'other-1': { name: 'Other 1' },
					'other-2': { name: 'Other 2' },
				},
			};
			const local = {
				__devices: {
					'my-device': { name: 'Me' },
					'other-1': { name: 'Other 1' },
					'other-2': { name: 'Other 2' },
				},
			};
			const disk = {
				__devices: {
					'my-device': { name: 'Me' },
					'other-1': { name: 'Other 1' },
					// 'other-2' was deleted
				},
			};

			const result = service.applyConflictMerge(
				local,
				disk,
				baseline,
				deviceId
			) as any;
			expect(result.__devices).not.toHaveProperty('other-2');
			expect(result.__devices['other-1'].name).toBe('Other 1');
		});
	});
});

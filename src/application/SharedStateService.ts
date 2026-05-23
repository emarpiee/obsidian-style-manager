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
import { DataUtils } from '../utils/CommonUtils';

/**
 * Handles multi-device shared state logic, including version tracking,
 * conflict resolution, and change detection.
 */
export class SharedStateService {
	private lastKnownVersion: number = 0;
	private lastKnownDataString: string = '';

	/**
	 * Set the in-memory sync state after a successful load or save.
	 */
	public setSyncState(data: unknown): void {
		this.lastKnownVersion =
			Number((data as Record<string, unknown>)?.__shared_version) || 0;
		this.lastKnownDataString = SharedStateService.getCanonicalString(data);
	}

	/**
	 * Determines if a data object from disk represents an external shared update.
	 * Uses strict version comparison (Disk Version > Memory Version).
	 */
	public isExternalShared(diskData: unknown): boolean {
		const diskVersion =
			Number((diskData as Record<string, unknown>)?.__shared_version) || 0;
		// If disk version is newer than ours, it's definitely an external update.
		return diskVersion > this.lastKnownVersion && this.lastKnownVersion > 0;
	}

	/**
	 * Determines if the row data from disk has actually changed compared to memory.
	 */
	public hasContentChanged(diskData: unknown): boolean {
		const diskString = SharedStateService.getCanonicalString(diskData);
		return diskString !== this.lastKnownDataString;
	}

	/**
	 * Generates a unique, collision-resistant version number for the next save.
	 */
	public generateNextVersion(): number {
		return Date.now();
	}

	/**
	 * Resolves conflicts between physical disk state and the local baseline using a 3-way merge.
	 */
	public applyConflictMerge(
		localData: Record<string, unknown>,
		diskData: Record<string, unknown>,
		baselineData: Record<string, unknown> | null,
		deviceId: string
	): Record<string, unknown> {
		if (!baselineData) {
			return { ...localData, ...diskData };
		}

		const result: Record<string, unknown> = { ...localData };

		// 1. Handle Deletions: if a key was in baseline but is NOT in diskData,
		// it means another machine deleted it. We respect that if we haven't changed it locally.
		Object.keys(baselineData).forEach((key) => {
			if (key === '__devices') return;
			if (!Object.prototype.hasOwnProperty.call(diskData, key)) {
				const localVal = localData[key];
				const baseVal = baselineData[key];
				if (JSON.stringify(localVal) === JSON.stringify(baseVal)) {
					delete result[key];
				}
			}
		});

		// 2. Handle Adds and Updates:
		Object.keys(diskData).forEach((key) => {
			if (key === '__devices') {
				const diskDevices =
					(diskData.__devices as Record<string, unknown>) || {};
				const baseDevices =
					(baselineData.__devices as Record<string, unknown>) || {};
				if (!result.__devices) result.__devices = {};
				const resultDevices = result.__devices as Record<string, unknown>;

				// Add or update other devices from disk
				Object.keys(diskDevices).forEach((devId) => {
					if (devId !== deviceId) {
						resultDevices[devId] = diskDevices[devId];
					}
				});

				// Delete other devices that were deleted on disk
				Object.keys(baseDevices).forEach((devId) => {
					if (
						devId !== deviceId &&
						!Object.prototype.hasOwnProperty.call(diskDevices, devId)
					) {
						delete resultDevices[devId];
					}
				});
				return;
			}

			const diskVal = diskData[key];
			const baseVal = baselineData[key];
			const localVal = localData[key];

			// If local hasn't changed since baseline, we accept the disk's version (new or null)
			if (JSON.stringify(localVal) === JSON.stringify(baseVal)) {
				if (diskVal !== undefined) {
					result[key] = diskVal;
				} else {
					delete result[key];
				}
			}
		});

		return result;
	}

	/**
	 * Sorts keys and stringifies JSON to ensure stable comparisons.
	 */
	public static getCanonicalString(data: unknown): string {
		return DataUtils.getCanonicalString(data);
	}
}

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
import { IStore } from './IStore';

/**
 * Interface representing the structure of a device's isolated bucket.
 */
export interface DeviceBucket {
	isIsolateMode: boolean;
	isolateSettings: Record<string, unknown>;
}

/**
 * Store implementation for device-specific isolated settings.
 * These settings are stored within a special "__devices" key in the central data.json,
 * ensuring they sync across the vault but remain inactive on other devices.
 */
export class DeviceBucketStore implements IStore<DeviceBucket> {
	constructor(
		private vaultStore: IStore<
			{
				__devices?: Record<
					string,
					{ isIsolateMode?: boolean; isolateSettings?: Record<string, unknown> }
				>;
			} & Record<string, unknown>
		>,
		private deviceId: string
	) {}

	/**
	 * Loads the device bucket from the vault data.
	 * Returns a default empty bucket if not found.
	 */
	async load(): Promise<DeviceBucket> {
		const vaultData = await this.vaultStore.load();
		const devices = vaultData?.__devices || {};
		const rawBucket = devices[this.deviceId];

		if (!rawBucket) {
			return { isIsolateMode: false, isolateSettings: {} };
		}

		return {
			isIsolateMode: rawBucket.isIsolateMode || false,
			isolateSettings: rawBucket.isolateSettings
				? { ...rawBucket.isolateSettings }
				: {},
		};
	}

	/**
	 * Saves the device bucket back into the vault data.
	 */
	async save(bucket: DeviceBucket): Promise<void> {
		let vaultData = await this.vaultStore.load();

		if (!vaultData) {
			vaultData = {};
		}

		if (!vaultData.__devices) {
			vaultData.__devices = {};
		}

		vaultData.__devices[this.deviceId] = {
			isIsolateMode: bucket.isIsolateMode,
			isolateSettings: { ...bucket.isolateSettings },
		};

		await this.vaultStore.save(vaultData);
	}

	/**
	 * Deletes the device bucket from the vault data.
	 */
	async delete(): Promise<void> {
		const vaultData = await this.vaultStore.load();
		if (
			vaultData &&
			vaultData.__devices &&
			vaultData.__devices[this.deviceId]
		) {
			delete vaultData.__devices[this.deviceId];
			await this.vaultStore.save(vaultData);
		}
	}
}

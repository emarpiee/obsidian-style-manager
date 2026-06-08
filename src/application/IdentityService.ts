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
import type StyleManagerPlugin from '../main';

import { 
	SNIPPETS_KEY, 
	THEME_KEY, 
	APPEARANCE_KEY, 
	ACCENT_COLOR_KEY 
} from '../constants';
import { generateUuid } from '../utils/CommonUtils';

const DEVICE_ID_KEY = 'style-manager-device-id';

export interface DeviceLocker {
	name?: string;
	isIsolateMode: boolean;
	isolateSettings: Record<string, unknown>;
}

export interface IdentityStorageAdapter {
	getDevices(): Record<string, DeviceLocker> | undefined;
	setDevices(
		devices: Record<
			string,
			{
				name?: string;
				isIsolateMode: boolean;
				isolateSettings: Record<string, unknown>;
			}
		>
	): void;
	clearIsolateSettings(): void;
	save(): Promise<void>;
	reload(): Promise<void>;
	updateMerged(): void;
	rerenderAll(): void;
	trigger(event: string): void;
	getPlugin(): StyleManagerPlugin;
}

export class IdentityService {
	public deviceId: string;
	public deviceName: string = '';
	public isNewIdentity: boolean = false;

	constructor(private adapter: IdentityStorageAdapter) {
		this.deviceId = this.readOrCreateDeviceId();
	}

	public readOrCreateDeviceId(): string {
		let id = localStorage.getItem(DEVICE_ID_KEY);
		if (!id) {
			this.isNewIdentity = true;
			id = generateUuid();
			localStorage.setItem(DEVICE_ID_KEY, id);
		}
		return id;
	}

	public syncDeviceName(): void {
		const devices = this.adapter.getDevices();
		this.deviceName = devices?.[this.deviceId]?.name || this.deviceId;
	}

	public async regenerateDeviceId(): Promise<void> {
		const newId = generateUuid();
		localStorage.setItem(DEVICE_ID_KEY, newId);
		this.deviceId = newId;
		this.deviceName = newId;

		await this.adapter.reload();
		this.adapter.updateMerged();
		this.adapter.rerenderAll();
		this.adapter.trigger('device-lockers-updated');

		this.adapter
			.getPlugin()
			.settingsService.notifications.isolate(
				`New Device ID established: ${newId}`
			);
	}

	public async applyPresetToLocker(
		deviceId: string,
		data: Record<string, unknown>
	): Promise<void> {
		await this.updateLockerSettings(deviceId, data, true);
	}

	public async updateLockerSettings(
		deviceId: string,
		settings: Record<string, unknown>,
		overwrite: boolean = false
	): Promise<void> {
		const devices = this.adapter.getDevices();
		if (devices && devices[deviceId]) {
			const locker = devices[deviceId];

			if (overwrite) {
				Object.keys(locker.isolateSettings).forEach((key) => {
					if (
						key.includes('@@') ||
						key === THEME_KEY ||
						key === APPEARANCE_KEY ||
						key === ACCENT_COLOR_KEY ||
						key === SNIPPETS_KEY
					) {
						delete locker.isolateSettings[key];
					}
				});
			}

			locker.isolateSettings = { ...locker.isolateSettings, ...settings };
			locker.isIsolateMode = true;
			await this.adapter.save();
			this.adapter.trigger('device-lockers-updated');
		}
	}

	public getAllDeviceIds(): string[] {
		return Object.keys(this.adapter.getDevices() || {});
	}

	public getLockerData(id: string): DeviceLocker | undefined {
		return this.adapter.getDevices()?.[id];
	}

	public getLockerName(id: string): string {
		return this.adapter.getDevices()?.[id]?.name || id;
	}

	public async setLockerName(
		id: string,
		name: string,
		options?: { silent?: boolean }
	): Promise<void> {
		const devices = this.adapter.getDevices();
		if (devices && devices[id]) {
			devices[id].name = name;
			if (id === this.deviceId) {
				this.deviceName = name;
			}
			await this.adapter.save();
			if (!options?.silent) {
				this.adapter.trigger('device-lockers-updated');
			}
		}
	}

	public async removeDeviceLocker(id: string): Promise<void> {
		const devices = this.adapter.getDevices();
		if (devices && devices[id]) {
			delete devices[id];

			if (id === this.deviceId) {
				localStorage.removeItem(DEVICE_ID_KEY);
				this.adapter.clearIsolateSettings();

				const newId = generateUuid();
				localStorage.setItem(DEVICE_ID_KEY, newId);
				this.deviceId = newId;
				this.deviceName = newId;

				await this.adapter.save();
				await this.adapter.reload();
				this.adapter.trigger('device-lockers-updated');
				this.adapter
					.getPlugin()
					.settingsService.notifications.isolate(
						`Isolate identity reset. Old ID ${id} removed.`
					);
			} else {
				await this.adapter.save();
				this.adapter.updateMerged();
				this.adapter.rerenderAll();
				this.adapter.trigger('device-lockers-updated');
				this.adapter
					.getPlugin()
					.settingsService.notifications.isolate(
						`Locker for ${id} permanently removed.`
					);
			}
		}
	}
}

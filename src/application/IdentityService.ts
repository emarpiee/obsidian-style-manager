
import { generateUuid } from '../utils/CommonUtils';
import { DeviceLocker, IdentityStorageAdapter } from "../types";
import { StorageKeys } from "../constants";

const DEVICE_ID_KEY = 'style-manager-device-id';

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
						key === StorageKeys.THEME ||
						key === StorageKeys.APPEARANCE ||
						key === StorageKeys.ACCENT_COLOR ||
						key === StorageKeys.SNIPPETS
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

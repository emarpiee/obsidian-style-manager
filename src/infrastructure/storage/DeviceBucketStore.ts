import { DeviceBucket, IStore } from '../../types';

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

import { PersistenceServiceOptions, StyleManagerSettings } from '../types';

import { DataUtils } from '../utils/CommonUtils';
import { Logger } from '../utils/Logger';

/**
 * Service for managing settings persistence, sync, and lifecycle.
 */
export class PersistenceService {
	private saveQueue: Promise<void> = Promise.resolve();
	public isSafeToSave: boolean = false;
	private hasPerformedInitialBackup: boolean = false;
	private lastLoadedData: Record<string, unknown> | null = null;

	constructor(private options: PersistenceServiceOptions) {}

	/**
	 * Produces a stable JSON string by sorting all object keys recursively.
	 */
	public static canonicalize(data: unknown): unknown {
		return DataUtils.canonicalize(data);
	}

	public static getCanonicalString(data: unknown): string {
		return DataUtils.getCanonicalString(data);
	}

	public async enqueue<T>(task: () => Promise<T>): Promise<T> {
		const result = this.saveQueue.then(task);
		this.saveQueue = result
			.then((): void => {})
			.catch((e): void => {
				Logger.error('Style Manager | Save enqueue error:', e);
			});
		return result;
	}

	public async save(options?: {
		silent?: boolean;
		skipMerge?: boolean;
		force?: boolean;
	}): Promise<void> {
		return this.enqueue(() => this.doSave(options));
	}

	private async doSave(options?: {
		silent?: boolean;
		skipMerge?: boolean;
		force?: boolean;
	}): Promise<void> {
		if (!this.isSafeToSave) {
			Logger.warn(
				'Style Manager | Save blocked: Manager is in a suspected failed-load state.'
			);
			return;
		}

		Logger.time('StyleManager:SaveCycle');

		const rawOnDisk = await this.options.sharedStore.readRaw();
		let sharedSettings = this.options.getSharedSettings();

		if (!options?.skipMerge && rawOnDisk !== null) {
			const diskData = JSON.parse(rawOnDisk) as StyleManagerSettings;
			if (this.options.sharedStateService.hasContentChanged(diskData)) {
				Logger.log(
					'Style Manager | Conflict detected during save! Merging with external disk state.'
				);
				sharedSettings = this.options.sharedStateService.applyConflictMerge(
					sharedSettings,
					diskData,
					this.lastLoadedData,
					this.options.getDeviceId()
				);
				this.options.setSharedSettings(sharedSettings);
			}
		}

		const dataToSave = this.prepareDataForSave();

		const currentOnDisk = await this.options.sharedStore.readRaw();
		if (currentOnDisk !== null) {
			try {
				JSON.parse(currentOnDisk);
				if (
					!options?.force &&
					!this.options.sharedStateService.hasContentChanged(dataToSave)
				) {
					Logger.log(
						'Style Manager | doSave() skipped: content identical to disk (sync-loop guard).'
					);
					Logger.timeEnd('StyleManager:SaveCycle');
					return;
				}
			} catch (e) {
				Logger.warn(
					'Style Manager | Could not parse disk JSON during idempotency check:',
					e
				);
			}
		}

		if (!this.hasPerformedInitialBackup) {
			await this.options.sharedStore.createBackup();
			this.hasPerformedInitialBackup = true;
		}

		await this.options.sharedStore.save(dataToSave);
		const writtenRaw = (await this.options.sharedStore.readRaw()) || '{}';
		const finalData = JSON.parse(writtenRaw) as StyleManagerSettings;

		this.options.sharedStateService.setSyncState(finalData);
		this.lastLoadedData = finalData;
		Logger.timeEnd('StyleManager:SaveCycle');
	}

	public async load(forcePull: boolean = false): Promise<void> {
		return this.enqueue(() => this.doLoad(forcePull));
	}

	private async doLoad(forcePull: boolean = false): Promise<void> {
		const loadedData = await this.options.sharedStore.load();
		const isExternalShared =
			loadedData !== null &&
			this.options.sharedStateService.isExternalShared(loadedData);

		const isMissing = loadedData === null;
		const hasBackup = await this.options.sharedStore.hasBackup();

		if (isMissing && !hasBackup) {
			this.isSafeToSave = true;
		} else if (isMissing && hasBackup) {
			Logger.warn(
				'Style Manager | Settings file is missing or corrupted but a backup exists. Attempting recovery...'
			);
			const restored = await this.options.sharedStore.restoreFromBackup();
			if (restored) {
				Logger.log('Style Manager | Successfully restored from backup.');
				this.options.notifications.shared(
					'Style Manager: Recovered settings from backup'
				);
				return this.doLoad(forcePull); // Retry loading after restore
			} else {
				this.isSafeToSave = false;
				this.options.notifications.error(
					'Style Manager | Warning: Settings file is missing and backup recovery failed. Save disabled.'
				);
			}
		} else if (loadedData !== null && Object.keys(loadedData).length === 0) {
			this.isSafeToSave = false;
			this.options.notifications.error(
				'Style Manager | Warning: Settings file appears empty. Save disabled.'
			);
		} else {
			this.isSafeToSave = true;
			const loadedRaw = (await this.options.sharedStore.readRaw()) || '{}';
			const finalData = JSON.parse(loadedRaw) as StyleManagerSettings;
			this.options.sharedStateService.setSyncState(finalData);
			this.lastLoadedData = finalData;
		}

		await this.options.onDataLoaded(loadedData, isExternalShared, forcePull);

		if (this.isSafeToSave && !this.hasPerformedInitialBackup) {
			await this.options.sharedStore.createBackup();
			this.hasPerformedInitialBackup = true;
		}
	}

	private prepareDataForSave(): StyleManagerSettings {
		const sharedSettings = this.options.getSharedSettings();
		const deviceId = this.options.getDeviceId();
		const deviceName = this.options.getDeviceName();
		const isIsolate = this.options.getIsIsolateMode();

		sharedSettings.__shared_version =
			this.options.sharedStateService.generateNextVersion();

		if (isIsolate || sharedSettings.__devices?.[deviceId]) {
			if (!sharedSettings.__devices) {
				sharedSettings.__devices = {};
			}
			sharedSettings.__devices[deviceId] = {
				name: deviceName || deviceId,
				isIsolateMode: isIsolate,
				isolateSettings: { ...this.options.getIsolateSettings() },
			};
		}
		return sharedSettings;
	}

	public async checkForExternalChanges(): Promise<boolean | undefined> {
		return this.enqueue(() => this.doCheckForExternalChanges());
	}

	private async doCheckForExternalChanges(): Promise<boolean | undefined> {
		if (!this.isSafeToSave) return;

		const raw = await this.options.sharedStore.readRaw();
		if (raw === null) return;

		const diskData = JSON.parse(raw) as StyleManagerSettings;
		if (this.options.sharedStateService.hasContentChanged(diskData)) {
			Logger.log(
				'Style Manager | External content change detected. Syncing...'
			);
			await this.doLoad(true);
			return true;
		}
		return false;
	}

	public setSafeToSave(safe: boolean): void {
		this.isSafeToSave = safe;
	}
}

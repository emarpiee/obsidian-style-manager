import { Menu } from 'obsidian';

import { PreferencesKeys } from '../../../constants';
import StyleManagerPlugin from '../../../main';
import { DeviceSelectionModal } from '../../modals/DeviceSelectionModal';
import { PresetScheduleModal } from '../../modals/PresetScheduleModal';

/**
 * Data source for applying settings. Can be a Preset object or raw isolate data.
 */
export interface ApplySource {
	name: string;
	data: Record<string, unknown>;
	id?: string;
}

export interface ApplyMenuOptions {
	onApplied?: () => void;
	/** Optional override for the "Shared" application action (useful for Isolate Mode teardown) */
	onApplyShared?: (action: 'overwrite' | 'merge') => Promise<void>;
	/** Optional override for the "Isolate" application action */
	onApplyIsolate?: (action: 'overwrite' | 'merge') => Promise<void>;
	/** Optional override for the "Remote" application action */
	onApplyRemote?: (
		deviceId: string,
		action: 'overwrite' | 'merge'
	) => Promise<void>;
	/** Skip default confirmation dialogs (useful for bulk actions that implement their own) */
	skipConfirm?: boolean;
	applyActionKey?: string;
	hideShared?: boolean;
	hideIsolate?: boolean;
	hideRemote?: boolean;
	hideSchedule?: boolean;
}

export function addApplyOptionsToMenu(
	menu: Menu,
	plugin: StyleManagerPlugin,
	source: ApplySource,
	options?: ApplyMenuOptions
): void {
	const onApplied = options?.onApplied;
	const onApplyShared = options?.onApplyShared;
	const onApplyIsolate = options?.onApplyIsolate;
	const onApplyRemote = options?.onApplyRemote;
	const skipConfirm = options?.skipConfirm;

	if (options?.hideShared !== true) {
		menu.addItem((item) =>
			item
				.setTitle('Apply to shared locker')
				.setIcon('globe')
				.onClick(() => {
					const perform = async (
						action: 'overwrite' | 'merge' = 'overwrite'
					): Promise<void> => {
						if (onApplyShared) {
							await onApplyShared(action);
						} else if (source.id) {
							await plugin.presetService.applyPreset(source.id, false, action);
						} else {
							await plugin.settingsService.applySettingsOverlay(
								source.data,
								false
							);
						}
						if (onApplied) onApplied();
					};

					if (skipConfirm) {
						const actionKeyToUse =
							options?.applyActionKey || PreferencesKeys.PRESET_APPLY_ACTION;
						const defaultAction =
							(plugin.settingsService.settings[actionKeyToUse] as string) ===
							'merge'
								? 'merge'
								: 'overwrite';
						perform(defaultAction);
					} else {
						plugin.presetService.confirmApply(
							source.name,
							perform,
							'shared',
							options?.applyActionKey
						);
					}
				})
		);
	}

	if (options?.hideIsolate !== true) {
		menu.addItem((item) =>
			item
				.setTitle('Apply to this device (isolate)')
				.setIcon('lock')
				.onClick(() => {
					const perform = async (
						action: 'overwrite' | 'merge' = 'overwrite'
					): Promise<void> => {
						if (onApplyIsolate) {
							await onApplyIsolate(action);
						} else if (source.id) {
							await plugin.presetService.applyPreset(source.id, true, action);
						} else {
							await plugin.settingsService.applySettingsOverlay(
								source.data,
								true
							);
						}
						if (onApplied) onApplied();
					};

					if (skipConfirm) {
						const actionKeyToUse =
							options?.applyActionKey || PreferencesKeys.PRESET_APPLY_ACTION;
						const defaultAction =
							(plugin.settingsService.settings[actionKeyToUse] as string) ===
							'merge'
								? 'merge'
								: 'overwrite';
						perform(defaultAction);
					} else {
						plugin.presetService.confirmApply(
							source.name,
							perform,
							'isolate',
							options?.applyActionKey
						);
					}
				})
		);
	}

	const otherDeviceIds = plugin.settingsService.identity
		.getAllDeviceIds()
		.filter((id) => id !== plugin.settingsService.deviceId);

	if (options?.hideRemote !== true && otherDeviceIds.length > 0) {
		menu.addItem((item) =>
			item
				.setTitle('Apply to other device (isolate)')
				.setIcon('share-2')
				.onClick(() => {
					new DeviceSelectionModal(
						plugin.app,
						plugin.settingsService,
						async (deviceId) => {
							const perform = async (
								action: 'overwrite' | 'merge' = 'overwrite'
							): Promise<void> => {
								if (onApplyRemote) {
									await onApplyRemote(deviceId, action);
								} else if (source.id) {
									await plugin.presetService.applyPresetsToLocker(
										deviceId,
										[source.id],
										action
									);
									plugin.settingsService.notifications.isolate(
										`Preset "${source.name}" applied to isolate locker.`
									);
								} else {
									await plugin.settingsService.identity.applyPresetToLocker(
										deviceId,
										source.data
									);
									plugin.settingsService.notifications.isolate(
										`Settings for "${source.name}" applied to isolate locker.`
									);
								}
								if (onApplied) onApplied();
							};

							if (skipConfirm) {
								const actionKeyToUse =
									options?.applyActionKey ||
									PreferencesKeys.PRESET_APPLY_ACTION;
								const defaultAction =
									(plugin.settingsService.settings[
										actionKeyToUse
									] as string) === 'merge'
										? 'merge'
										: 'overwrite';
								perform(defaultAction);
							} else {
								const deviceName =
									plugin.settingsService.identity.getLockerName(deviceId);
								plugin.presetService.confirmApply(
									source.name,
									perform,
									'remote',
									options?.applyActionKey,
									deviceName
								);
							}
						}
					).open();
				})
		);
	}

	if (source.id && options?.hideSchedule !== true) {
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle('Schedule preset')
				.setIcon('calendar-clock')
				.onClick(() => {
					new PresetScheduleModal(
						plugin.app,
						plugin,
						source.id
					).open();
				})
		);
	}
}

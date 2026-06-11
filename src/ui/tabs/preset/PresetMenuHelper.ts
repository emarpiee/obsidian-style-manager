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
import { Menu } from 'obsidian';

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
	onApplyShared?: () => Promise<void>;
	/** Optional override for the "Isolate" application action */
	onApplyIsolate?: () => Promise<void>;
	/** Optional override for the "Remote" application action */
	onApplyRemote?: (deviceId: string) => Promise<void>;
	/** Skip default confirmation dialogs (useful for bulk actions that implement their own) */
	skipConfirm?: boolean;
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
					const perform = async (): Promise<void> => {
						if (onApplyShared) {
							await onApplyShared();
						} else if (source.id) {
							await plugin.presetService.applyPreset(source.id);
						} else {
							await plugin.settingsService.applySettingsOverlay(
								source.data,
								false
							);
						}
						if (onApplied) onApplied();
					};

					if (skipConfirm) {
						perform();
					} else {
						plugin.presetService.confirmApply(source.name, perform);
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
					const perform = async (): Promise<void> => {
						if (onApplyIsolate) {
							await onApplyIsolate();
						} else if (source.id) {
							await plugin.presetService.applyPreset(source.id, true);
						} else {
							await plugin.settingsService.applySettingsOverlay(
								source.data,
								true
							);
						}
						if (onApplied) onApplied();
					};

					if (skipConfirm) {
						perform();
					} else {
						plugin.presetService.confirmApply(source.name, perform, true);
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
							if (onApplyRemote) {
								await onApplyRemote(deviceId);
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
						source.id as string
					).open();
				})
		);
	}
}

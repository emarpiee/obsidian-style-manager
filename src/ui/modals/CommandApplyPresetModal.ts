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
import { App } from 'obsidian';

import { DeviceSelectionModal } from './DeviceSelectionModal';
import { PresetSuggestModal } from './PresetSuggestModal';

import { PresetService } from '../../application/PresetService';
import { Preset } from '../../types';

export type ApplyPresetTarget = 'shared' | 'this-device' | 'other-device';

export class CommandApplyPresetModal extends PresetSuggestModal {
	target: ApplyPresetTarget;

	constructor(
		app: App,
		presetService: PresetService,
		target: ApplyPresetTarget
	) {
		super(app, presetService, 'Search presets...');
		this.target = target;
	}

	onChooseSuggestion(preset: Preset, _evt: MouseEvent | KeyboardEvent): void {
		switch (this.target) {
			case 'shared':
				this.presetService.confirmApply(
					preset.name,
					async (action) => {
						await this.presetService.applyPreset(preset.id, false, action);
						this.close();
					},
					'shared'
				);
				break;
			case 'this-device':
				this.presetService.confirmApply(
					preset.name,
					async (action) => {
						await this.presetService.applyPreset(preset.id, true, action);
						this.close();
					},
					'isolate'
				);
				break;
			case 'other-device':
				new DeviceSelectionModal(
					this.app,
					this.presetService.plugin.settingsService,
					async (deviceId) => {
						const deviceName = this.presetService.plugin.settingsService.identity.getLockerName(deviceId);
						this.presetService.confirmApply(
							preset.name,
							async (action) => {
								await this.presetService.applyPresetsToLocker(
									deviceId,
									[preset.id],
									action
								);
								this.presetService.plugin.settingsService.notifications.isolate(
									`Settings for "${preset.name}" applied to isolate locker.`
								);
								this.close();
							},
							'remote',
							undefined,
							deviceName
						);
					}
				).open();
				break;
		}
	}
}

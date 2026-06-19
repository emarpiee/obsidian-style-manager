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
						const deviceName =
							this.presetService.plugin.settingsService.identity.getLockerName(
								deviceId
							);
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

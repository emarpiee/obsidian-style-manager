import { App } from 'obsidian';

import { PresetScheduleModal } from './PresetScheduleModal';
import { PresetSuggestModal } from './PresetSuggestModal';

import { PresetService } from '../../application/PresetService';
import { Preset } from '../../types';

export class CommandSchedulePresetModal extends PresetSuggestModal {
	constructor(app: App, presetService: PresetService) {
		super(app, presetService, 'Search presets to schedule...');
	}

	onChooseSuggestion(preset: Preset, _evt: MouseEvent | KeyboardEvent): void {
		new PresetScheduleModal(
			this.app,
			this.presetService.plugin,
			preset.id
		).open();
		this.close();
	}
}

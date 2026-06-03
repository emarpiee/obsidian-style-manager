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
import { App, SuggestModal } from 'obsidian';

import { DeviceSelectionModal } from './DeviceSelectionModal';

import { PresetService } from '../../application/PresetService';
import { Preset } from '../../types';

export type ApplyPresetTarget = 'shared' | 'this-device' | 'other-device';

export class CommandApplyPresetModal extends SuggestModal<Preset> {
	presetService: PresetService;
	target: ApplyPresetTarget;

	constructor(
		app: App,
		presetService: PresetService,
		target: ApplyPresetTarget
	) {
		super(app);
		this.presetService = presetService;
		this.target = target;
	}

	onOpen(): void {
		this.setPlaceholder('Search presets...');
		if (this.inputEl) {
			this.inputEl.value = '';
			this.inputEl.dispatchEvent(new Event('input'));
		}
	}

	getSuggestions(query: string): Preset[] {
		if (!query) return this.presetService.presets;

		return this.presetService.presets.filter((preset) =>
			preset.name.toLowerCase().includes(query.toLowerCase())
		);
	}

	onChooseSuggestion(preset: Preset, _evt: MouseEvent | KeyboardEvent): void {
		switch (this.target) {
			case 'shared':
				this.presetService.confirmApply(
					preset.name,
					async () => {
						await this.presetService.applyPreset(preset.id, false);
						this.close();
					},
					false
				);
				break;
			case 'this-device':
				this.presetService.confirmApply(
					preset.name,
					async () => {
						await this.presetService.applyPreset(preset.id, true);
						this.close();
					},
					true
				);
				break;
			case 'other-device':
				new DeviceSelectionModal(
					this.app,
					this.presetService.plugin.settingsService,
					async (deviceId) => {
						await this.presetService.plugin.settingsService.identity.applyPresetToLocker(
							deviceId,
							preset.data
						);
						this.presetService.plugin.settingsService.notifications.isolate(
							`Settings for "${preset.name}" applied to isolate locker.`
						);
						this.close();
					}
				).open();
				break;
		}
	}

	renderSuggestion(preset: Preset, el: HTMLElement): void {
		el.createEl('div', { text: preset.name });
	}
}

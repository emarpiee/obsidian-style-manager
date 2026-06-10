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

import { PresetScheduleModal } from './PresetScheduleModal';
import { PresetService } from '../../application/PresetService';
import { Preset } from '../../types';

export class CommandSchedulePresetModal extends SuggestModal<Preset> {
	presetService: PresetService;

	constructor(
		app: App,
		presetService: PresetService
	) {
		super(app);
		this.presetService = presetService;
	}

	onOpen(): void {
		this.setPlaceholder('Search presets to schedule...');
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
		new PresetScheduleModal(
			this.app,
			this.presetService.plugin,
			preset.id
		).open();
		this.close();
	}

	renderSuggestion(preset: Preset, el: HTMLElement): void {
		el.createEl('div', { text: preset.name });
	}
}

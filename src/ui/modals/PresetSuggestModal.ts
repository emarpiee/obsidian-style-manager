import { App, SuggestModal } from 'obsidian';

import { PresetService } from '../../application/PresetService';
import { Preset } from '../../types';

export abstract class PresetSuggestModal extends SuggestModal<Preset> {
	presetService: PresetService;
	placeholder: string;

	constructor(app: App, presetService: PresetService, placeholder: string) {
		super(app);
		this.presetService = presetService;
		this.placeholder = placeholder;
	}

	onOpen(): void {
		this.setPlaceholder(this.placeholder);
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

	renderSuggestion(preset: Preset, el: HTMLElement): void {
		el.createEl('div', { text: preset.name });
	}
}

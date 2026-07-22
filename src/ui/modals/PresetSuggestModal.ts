import { App, SuggestModal, setIcon } from 'obsidian';

import { ExportKeys, StorageKeys } from '../../constants';
import { PresetService } from '../../application/PresetService';
import { Preset } from '../../types';
import { formatPresetDate } from '../../utils/CommonUtils';
import {
	renderAppearanceBadge,
	renderCountBadge,
	renderSnippetBadge,
	renderThemeBadge,
} from '../components/BadgeUtils';

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
		const plugin = this.presetService.plugin;

		// — Title row: name + badges —
		const titleRow = el.createDiv({ cls: 'style-manager-suggest-title-row' });

		if (preset.isFavorite) {
			const starIcon = titleRow.createDiv({
				cls: 'style-manager-preset-star-icon is-favorite',
			});
			setIcon(starIcon, 'star');
		}

		titleRow.createSpan({
			cls: 'style-manager-suggest-name',
			text: preset.name,
		});

		const badges = titleRow.createDiv({ cls: 'style-manager-badge-container' });

		const appearance = preset.data[StorageKeys.APPEARANCE] as string | undefined;
		if (appearance) {
			renderAppearanceBadge(badges, appearance);
		}

		const theme = preset.data[StorageKeys.THEME] as string | undefined;
		if (theme) {
			renderThemeBadge(badges, plugin, theme, preset.data[StorageKeys.ACCENT_COLOR] as string);
		}

		const count = plugin.settingsService.countModifiedEntries(preset.data);
		renderCountBadge(badges, count);

		renderSnippetBadge(badges, plugin, preset.data[StorageKeys.SNIPPETS] as string[]);

		// — Subtitle row: created date —
		const dateStr = preset.created
			? formatPresetDate(
					preset.created,
					plugin.settingsService.settings[ExportKeys.CREATED_DATE_FORMAT] as string
				)
			: 'Unknown date';

		el.createDiv({
			cls: 'style-manager-suggest-subtitle suggestion-note',
			text: `Created: ${dateStr}`,
		});
	}
}

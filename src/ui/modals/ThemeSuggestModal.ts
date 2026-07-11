import { App, SuggestModal } from 'obsidian';

import { StorageKeys } from '../../constants';
import StyleManagerPlugin from '../../main';

export interface ThemeOption {
	id: string;
	name: string;
}

export class ThemeSuggestModal extends SuggestModal<ThemeOption> {
	plugin: StyleManagerPlugin;
	themes: ThemeOption[];
	onDone: () => void;

	constructor(
		app: App,
		plugin: StyleManagerPlugin,
		themes: ThemeOption[],
		onDone: () => void
	) {
		super(app);
		this.plugin = plugin;
		this.themes = themes;
		this.onDone = onDone;
	}

	onOpen(): void {
		this.setPlaceholder('Search for a theme...');
		if (this.inputEl) {
			this.inputEl.value = '';
			this.inputEl.dispatchEvent(new Event('input'));
		}
	}

	getSuggestions(query: string): ThemeOption[] {
		if (!query) return this.themes;

		return this.themes.filter((theme) =>
			theme.name.toLowerCase().includes(query.toLowerCase())
		);
	}

	renderSuggestion(theme: ThemeOption, el: HTMLElement): void {
		const row = el.createDiv('style-manager-theme-suggestion-row');
		row.createEl('div', { text: theme.name });

		const activeThemeId = this.plugin.settingsService.getSetting(
			StorageKeys.THEME
		) as string;
		if (theme.id === activeThemeId) {
			row.createEl('span', {
				text: 'ACTIVE',
				cls: 'style-manager-theme-active-badge',
			});
		}
	}

	onChooseSuggestion(
		theme: ThemeOption,
		_evt: MouseEvent | KeyboardEvent
	): void {
		void this.plugin.settingsService
        			.setSetting(StorageKeys.THEME, theme.id, { silentUI: true })
        			.then(() => {
        				this.onDone();
        			});
	}
}

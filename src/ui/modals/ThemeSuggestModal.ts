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

import { THEME_KEY } from '../../application/SettingsService';
import StyleManagerPlugin from '../../main';

export interface ThemeOption {
	id: string;
	name: string;
}

export class ThemeSuggestModal extends SuggestModal<ThemeOption> {
	plugin: StyleManagerPlugin;
	themes: ThemeOption[];
	onDone: () => void;

	constructor(app: App, plugin: StyleManagerPlugin, themes: ThemeOption[], onDone: () => void) {
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

		const activeThemeId = this.plugin.settingsService.getSetting(THEME_KEY) as string;
		if (theme.id === activeThemeId) {
			row.createEl('span', {
				text: 'ACTIVE',
				cls: 'style-manager-theme-active-badge',
			});
		}
	}

	onChooseSuggestion(theme: ThemeOption, _evt: MouseEvent | KeyboardEvent): void {
		this.plugin.settingsService.setSetting(THEME_KEY, theme.id, { silentUI: true }).then(() => {
			this.onDone();
		});
	}
}

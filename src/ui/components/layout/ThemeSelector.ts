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
import { setIcon, setTooltip } from 'obsidian';

import { THEME_KEY } from '../../../application/SettingsService';
import StyleManagerPlugin from '../../../main';
import { ThemeOption, ThemeSuggestModal } from '../../modals/ThemeSuggestModal';

export function renderThemeSelect(
	plugin: StyleManagerPlugin,
	containerEl: HTMLElement,
	onDone: () => void
): void {
	const currentValue =
		(plugin.settingsService.getSetting(THEME_KEY) as string) || 'default';
	const currentThemeName =
		currentValue === 'default' ? 'Default' : currentValue;

	const triggerContainer = containerEl.createDiv('style-manager-theme-trigger');
	setTooltip(triggerContainer, 'Change theme');
	const iconEl = triggerContainer.createSpan(
		'style-manager-theme-trigger-icon'
	);
	setIcon(iconEl, 'palette');
	const nameEl = triggerContainer.createSpan({
		text: currentThemeName,
		cls: 'style-manager-theme-current-name',
	});

	plugin.settingsService.themeBuilderService.getThemes().then((themes) => {
		if (currentValue !== 'default' && themes[currentValue]) {
			nameEl.setText(themes[currentValue].name);
		}
	});

	triggerContainer.onclick = async (_e: MouseEvent): Promise<void> => {
		const themes: ThemeOption[] = [
			{ id: 'default', name: 'Default' },
		];

		try {
			const themeObjects = await plugin.settingsService.themeBuilderService.getThemes();
			for (const id in themeObjects) {
				themes.push({ id, name: themeObjects[id].name });
			}
		} catch (e) {
			console.error('Style Manager | Error loading themes for suggest modal:', e);
		}

		new ThemeSuggestModal(plugin.app, plugin, themes, onDone).open();
	};
}

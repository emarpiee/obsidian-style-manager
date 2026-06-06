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
import { Menu, setIcon, setTooltip } from 'obsidian';

import { THEME_KEY } from '../../../application/SettingsService';
import StyleManagerPlugin from '../../../main';

export function addThemeOptionsToMenu(
	plugin: StyleManagerPlugin,
	menu: Menu,
	currentValue: string,
	onDone: () => void
): void {
	const customCss = (
		plugin.app as unknown as {
			customCss: { themes: Record<string, { name: string }> };
		}
	).customCss;
	const themes = customCss.themes;

	menu.addItem((item) => {
		item
			.setTitle('Default')
			.setChecked(currentValue === 'default')
			.onClick(async () => {
				await plugin.settingsService.setSetting(THEME_KEY, 'default', { silentUI: true });
				onDone();
			});
	});

	for (const themeId in themes) {
		const themeName = themes[themeId].name;
		menu.addItem((item) => {
			item
				.setTitle(themeName)
				.setChecked(currentValue === themeId)
				.onClick(async () => {
					await plugin.settingsService.setSetting(THEME_KEY, themeId, { silentUI: true });
					onDone();
				});
		});
	}
}

export function renderThemeSelect(
	plugin: StyleManagerPlugin,
	containerEl: HTMLElement,
	onDone: () => void
): void {
	const currentValue =
		(plugin.settingsService.getSetting(THEME_KEY) as string) || 'default';

	const customCss = (
		plugin.app as unknown as {
			customCss: { themes: Record<string, { name: string }> };
		}
	).customCss;
	const themes = customCss.themes;
	const currentThemeName =
		currentValue === 'default'
			? 'Default'
			: themes[currentValue]?.name || currentValue;

	const triggerContainer = containerEl.createDiv('style-manager-theme-trigger');
	setTooltip(triggerContainer, 'Change theme');
	const iconEl = triggerContainer.createSpan(
		'style-manager-theme-trigger-icon'
	);
	setIcon(iconEl, 'palette');
	triggerContainer.createSpan({
		text: currentThemeName,
		cls: 'style-manager-theme-current-name',
	});

	triggerContainer.onclick = (e: MouseEvent): void => {
		const menu = new Menu();

		addThemeOptionsToMenu(plugin, menu, currentValue, onDone);

		menu.showAtMouseEvent(e);
	};
}

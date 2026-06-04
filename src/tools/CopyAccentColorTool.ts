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
import { Plugin } from 'obsidian';
import { ACCENT_COLOR_KEY } from '../constants';
import { SettingsService } from '../application/SettingsService';

export class CopyAccentColorTool {
	constructor(private plugin: Plugin) {}

	async copy(): Promise<void> {
		const settingsService = (this.plugin as unknown as { settingsService: SettingsService }).settingsService;
		const color = settingsService.settings[ACCENT_COLOR_KEY] || 
			settingsService.bridge.getNativeConfig('accentColor');
		if (color) {
			await navigator.clipboard.writeText(color as string);
			settingsService.notifications.util(`Accent color ${color} copied to clipboard`);
		} else {
			settingsService.notifications.error('No accent color set');
		}
	}
}

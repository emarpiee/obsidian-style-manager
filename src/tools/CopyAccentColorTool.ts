import { Plugin } from 'obsidian';

import { ACCENT_COLOR_KEY } from '../constants';

import { SettingsService } from '../application/SettingsService';

export class CopyAccentColorTool {
	constructor(private plugin: Plugin) {}

	async copy(): Promise<void> {
		const settingsService = (
			this.plugin as unknown as { settingsService: SettingsService }
		).settingsService;
		const color =
			settingsService.settings[ACCENT_COLOR_KEY] ||
			settingsService.bridge.getNativeConfig('accentColor');
		if (color) {
			await navigator.clipboard.writeText(color as string);
			settingsService.notifications.util(
				`Accent color ${color} copied to clipboard`
			);
		} else {
			settingsService.notifications.error('No accent color set');
		}
	}
}

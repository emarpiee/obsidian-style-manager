import { Plugin } from 'obsidian';

import { StorageKeys } from '../constants';

import { SettingsService } from '../application/SettingsService';

export class CopyAccentColorTool {
	constructor(private plugin: Plugin) {}

	async copy(): Promise<void> {
		const settingsService = (
			this.plugin as unknown as { settingsService: SettingsService }
		).settingsService;
		const color =
			settingsService.settings[StorageKeys.ACCENT_COLOR] ||
			settingsService.bridge.getNativeConfig('accentColor');
		if (color) {
			await navigator.clipboard.writeText(color as string);
			settingsService.notifications.util(
				`Accent color ${color as string} copied to clipboard`
			);
		} else {
			settingsService.notifications.error('No accent color set');
		}
	}
}

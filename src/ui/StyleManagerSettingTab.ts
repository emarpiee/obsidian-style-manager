import { App, PluginSettingTab } from 'obsidian';

import StyleManagerPlugin from '../main';
import { ParseLogList, ParsedCSSSettings } from '../types';
import { StyleManagerLayoutRenderer } from './StyleManagerLayoutRenderer';

export class StyleManagerSettingTab extends PluginSettingTab {
	settingsMarkup: StyleManagerLayoutRenderer | null;
	plugin: StyleManagerPlugin;
	settings: ParsedCSSSettings[];
	parseLogs: ParseLogList;

	constructor(app: App, plugin: StyleManagerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	rerender(): void {
		this.settingsMarkup?.rerender();
	}

	setSettings(settings: ParsedCSSSettings[], parseLogs: ParseLogList): void {
		this.settings = settings;
		this.parseLogs = parseLogs;
		if (this.settingsMarkup) {
			this.settingsMarkup.setSettings(settings, parseLogs);
		}
	}

	display(): void {
		if (this.settingsMarkup) {
			this.plugin.removeChild(this.settingsMarkup);
		}
		this.settingsMarkup = this.plugin.addChild(
			new StyleManagerLayoutRenderer(this.app, this.plugin, this.containerEl)
		);
		if (this.settings) {
			this.settingsMarkup.setSettings(this.settings, this.parseLogs);
		}
	}

	hide(): void {
		if (this.settingsMarkup) {
			this.plugin.removeChild(this.settingsMarkup);
		}
		this.settingsMarkup = null;
	}
}

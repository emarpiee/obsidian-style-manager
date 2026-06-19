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

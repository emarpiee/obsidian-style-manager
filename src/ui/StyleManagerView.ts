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
import { ItemView, WorkspaceLeaf } from 'obsidian';

import StyleManagerPlugin from '../main';
import { ParseLogList, ParsedCSSSettings } from '../types';
import { StyleManagerLayoutRenderer } from './StyleManagerLayoutRenderer';

export const viewType = 'style-manager-view';

export class StyleManagerView extends ItemView {
	settingsMarkup: StyleManagerLayoutRenderer | null;
	plugin: StyleManagerPlugin;

	constructor(plugin: StyleManagerPlugin, leaf: WorkspaceLeaf) {
		super(leaf);
		this.plugin = plugin;
	}

	rerender(): void {
		this.settingsMarkup?.rerender();
	}

	settings: ParsedCSSSettings[];
	parseLogs: ParseLogList;
	setSettings(settings: ParsedCSSSettings[], parseLogs: ParseLogList): void {
		this.settings = settings;
		this.parseLogs = parseLogs;
		if (this.settingsMarkup) {
			this.settingsMarkup.setSettings(settings, parseLogs);
		}
	}

	onload(): void {
		this.settingsMarkup = this.addChild(
			new StyleManagerLayoutRenderer(
				this.plugin.app,
				this.plugin,
				this.contentEl,
				true
			)
		);
		if (this.settings) {
			this.settingsMarkup.setSettings(this.settings, this.parseLogs);
		}
	}

	onunload(): void {
		this.settingsMarkup = null;
	}

	getViewType(): string {
		return viewType;
	}

	getIcon(): string {
		return 'gear';
	}

	getDisplayText(): string {
		return 'Style Manager';
	}
}

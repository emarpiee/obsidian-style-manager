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
import { App } from 'obsidian';

import { ParseLogList, ParsedCSSSettings } from '../types';
import { StyleManagerSettingTab } from './StyleManagerSettingTab';
import { StyleManagerView, viewType } from './StyleManagerView';

/**
 * Orchestrates UI updates across the Settings Tab and the Leaf View.
 * Centralizes re-rendering to ensure consistency when settings change.
 */
export class ViewManager {
	public settingsTab: StyleManagerSettingTab | null = null;
	private expandedHeadings: Set<string> = new Set();

	constructor(private app: App) {}

	public isHeadingExpanded(id: string): boolean {
		return this.expandedHeadings.has(id);
	}

	public setHeadingExpanded(id: string, expanded: boolean): void {
		if (expanded) {
			this.expandedHeadings.add(id);
		} else {
			this.expandedHeadings.delete(id);
		}
	}

	public registerSettingsTab(tab: StyleManagerSettingTab): void {
		this.settingsTab = tab;
	}

	/**
	 * Re-renders both the Settings Tab (if open) and any active Style Manager leaves.
	 */
	public rerenderAll(): void {
		if (this.settingsTab) {
			this.settingsTab.rerender();
		}

		const leaves = this.app.workspace.getLeavesOfType(viewType);
		for (const leaf of leaves) {
			if (leaf.view instanceof StyleManagerView) {
				leaf.view.rerender();
			}
		}
	}

	/**
	 * Updates the data displayed in the UI components.
	 */
	public updateData(
		settingsList: ParsedCSSSettings[],
		parseLogs: ParseLogList
	): void {
		if (this.settingsTab) {
			this.settingsTab.setSettings(settingsList, parseLogs);
		}

		const leaves = this.app.workspace.getLeavesOfType(viewType);
		for (const leaf of leaves) {
			if (leaf.view instanceof StyleManagerView) {
				leaf.view.setSettings(settingsList, parseLogs);
			}
		}
	}
}

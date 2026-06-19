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

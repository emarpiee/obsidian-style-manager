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
		// Ensure only one instance of the style manager view exists
		const leaves = this.plugin.app.workspace.getLeavesOfType(viewType);
		for (const leaf of leaves) {
			if (leaf !== this.leaf) {
				leaf.detach();
			}
		}

		this.contentEl.addClass('is-style-manager-view');
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
		if (this.settingsMarkup) {
			this.removeChild(this.settingsMarkup);
			this.settingsMarkup = null;
		}
		this.contentEl.removeClass('is-style-manager-view');
		this.contentEl.empty();
	}

	getViewType(): string {
		return viewType;
	}

	getIcon(): string {
		return 'gear';
	}

	getDisplayText(): string {
		return 'Style manager';
	}
}

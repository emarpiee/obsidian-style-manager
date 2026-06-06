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

import {
	APPEARANCE_KEY,
	SHOW_STATUS_BAR_KEY,
	SNIPPETS_KEY,
	THEME_KEY,
} from '../../constants';
import StyleManagerPlugin from '../../main';
import { addThemeOptionsToMenu } from '../components/layout/ThemeSelector';

/**
 * Manages the Obsidian status bar integration for Style Manager.
 */
export class StatusBarManager {
	private statusBarItem: HTMLElement | null = null;

	constructor(private plugin: StyleManagerPlugin) {}

	/**
	 * Initializes the status bar item if enabled in settings.
	 */
	public init(): void {
		this.refresh();

		// Refresh when settings or state changes
		this.plugin.registerEvent(
			this.plugin.settingsService.on('refresh-status-bar', () => this.refresh())
		);
		this.plugin.registerEvent(
			this.plugin.settingsService.on('isolate-mode-changed', () =>
				this.refresh()
			)
		);
	}

	/**
	 * Destroys the status bar item.
	 */
	public cleanup(): void {
		this.statusBarItem?.remove();
		this.statusBarItem = null;
	}

	/**
	 * Refreshes the status bar item based on current settings and state.
	 */
	public refresh(): void {
		const showStatusBar =
			this.plugin.settingsService.settings[SHOW_STATUS_BAR_KEY] !== false;

		if (!showStatusBar) {
			this.cleanup();
			return;
		}

		if (!this.statusBarItem) {
			this.statusBarItem = this.plugin.addStatusBarItem();
			this.statusBarItem.addClass('style-manager-status-bar-item');
			this.statusBarItem.onclick = (e: MouseEvent): void => this.showMenu(e);
		}

		const isIsolate = this.plugin.settingsService.isIsolateMode();
		const modifiedCount = this.plugin.settingsService.getTotalModifiedCount();
		const enabledSnippets =
			(this.plugin.settingsService.settings[SNIPPETS_KEY] as string[]) || [];
		const activeTheme =
			(this.plugin.settingsService.settings[THEME_KEY] as string) || 'Default';

		// Update Icon
		this.statusBarItem.empty();
		setIcon(this.statusBarItem, 'paintbrush');

		// Visual Indicator for Isolate Mode
		this.statusBarItem.toggleClass('is-isolate', isIsolate);

		// Precise Tooltip: Mode > Theme > Modified > Snippets
		const modeText = isIsolate ? 'Isolate Mode' : 'Sync Mode';
		const snippetText =
			enabledSnippets.length === 1
				? '1 snippet'
				: `${enabledSnippets.length} snippets`;
		const modifiedText =
			modifiedCount === 1
				? '1 setting modified'
				: `${modifiedCount} settings modified`;

		setTooltip(
			this.statusBarItem,
			`Style Manager (${modeText})\n` +
				`Theme: ${activeTheme}\n` +
				`${modifiedText}\n` +
				`${snippetText} enabled`
		);
	}

	/**
	 * Shows the status bar menu.
	 */
	private showMenu(e: MouseEvent): void {
		const menu = new Menu();
		const isIsolate = this.plugin.settingsService.isIsolateMode();
		const modifiedCount = this.plugin.settingsService.getTotalModifiedCount();
		const enabledSnippets =
			(this.plugin.settingsService.settings[SNIPPETS_KEY] as string[]) || [];
		const activeTheme =
			(this.plugin.settingsService.settings[THEME_KEY] as string) || 'default';

		// 1. Mode Information & Toggle
		menu.addItem((item) => {
			item
				.setTitle(`Mode: ${isIsolate ? 'Isolate' : 'Shared'}`)
				.setIcon(isIsolate ? 'lock' : 'lock-open')
				.onClick(async () => {
					await this.plugin.settingsService.setIsolateMode(!isIsolate);
					this.refresh();
				});
			(item as unknown as { dom: HTMLElement }).dom.addClass(
				'style-manager-menu-info'
			);
			setTooltip((item as unknown as { dom: HTMLElement }).dom, 'Switch mode');
		});

		menu.addSeparator();

		menu.addItem((item) => {
			item
				.setTitle(
					`Theme: ${activeTheme === 'default' ? 'Default' : activeTheme}`
				)
				.setIcon('palette');

			const themeMenu = (
				item as unknown as { setSubmenu?: () => Menu }
			).setSubmenu?.();
			if (themeMenu) {
				addThemeOptionsToMenu(this.plugin, themeMenu, activeTheme, () =>
					this.refresh()
				);
			} else {
				// Fallback for older Obsidian versions: toggle directly or show notice
				item.onClick(() => {
					this.plugin.activateView();
				});
			}
		});

		// 3. Appearance Toggle
		const appearance = this.plugin.settingsService.settings[
			APPEARANCE_KEY
		] as string;
		menu.addItem((item) => {
			let icon = '';
			if (appearance === 'light') icon = 'sun';
			if (appearance === 'dark') icon = 'moon';

			item
				.setTitle(
					`Appearance: ${appearance.charAt(0).toUpperCase() + appearance.slice(1)}`
				)
				.setIcon(icon)
				.onClick(async () => {
					const next = appearance === 'light' ? 'dark' : 'light';
					await this.plugin.settingsService.setSetting(APPEARANCE_KEY, next, { silentUI: true });
					this.refresh();
				});
		});

		menu.addSeparator();

		// 4. Stats (Modified)
		menu.addItem((item) => {
			item
				.setTitle(`${modifiedCount} customized settings`)
				.setIcon('check-circle')
				.onClick(() => {
					this.plugin.activateView('styles');
				});
			(item as unknown as { dom: HTMLElement }).dom.addClass(
				'style-manager-menu-info'
			);
		});

		// 5. Stats (Snippets)
		menu.addItem((item) => {
			item
				.setTitle(`${enabledSnippets.length} enabled snippets`)
				.setIcon('file-code')
				.onClick(() => {
					this.plugin.activateView('snippets');
				});
			(item as unknown as { dom: HTMLElement }).dom.addClass(
				'style-manager-menu-info'
			);
			if (enabledSnippets.length > 0) {
				const list = enabledSnippets.join('\n');
				setTooltip(
					(item as unknown as { dom: HTMLElement }).dom,
					`Go to Snippets Tab\n\nEnabled:\n${list}`
				);
			} else {
				setTooltip(
					(item as unknown as { dom: HTMLElement }).dom,
					'Go to Snippets Tab'
				);
			}
		});

		menu.addSeparator();

		// Action
		menu.addItem((item) => {
			item
				.setTitle('Open Style Manager')
				.setIcon('external-link')
				.onClick(() => {
					this.plugin.activateView();
				});
		});

		menu.showAtMouseEvent(e);
	}
}

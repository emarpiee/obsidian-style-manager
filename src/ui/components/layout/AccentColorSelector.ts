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
import Pickr from '@simonwep/pickr';
import { Menu, setTooltip } from 'obsidian';

import { ACCENT_COLOR_KEY } from '../../../constants';
import StyleManagerPlugin from '../../../main';
import { getPickrSettings, onPickrCancel } from '../../../utils/UIUtils';

/**
 * Renders the accent color selector circle in the main toolbar.
 * This circle manages both Sync and Isolate mode accent colors.
 */
export function renderAccentColorSelect(
	plugin: StyleManagerPlugin,
	containerEl: HTMLElement,
	onRerender: () => void
): void {
	const accentColor =
		(plugin.settingsService.getSetting(ACCENT_COLOR_KEY) as string) || '';
	const vConfigAccent = plugin.settingsService.bridge.getNativeConfig(
		'accentColor'
	) as string;
	const nativeAccent = getComputedStyle(document.body)
		.getPropertyValue('--accent-color')
		.trim();
	const displayColor = (accentColor ||
		vConfigAccent ||
		nativeAccent ||
		'#8a5cf5') as string;

	const triggerContainer = containerEl.createDiv({
		cls: 'style-manager-accent-trigger-container',
	});
	setTooltip(triggerContainer, 'Change Accent Color (Right-click to Reset)');

	const circle = triggerContainer.createDiv({
		cls: 'style-manager-accent-trigger',
	});
	circle.style.setProperty('--sm-accent-trigger-color', displayColor);

	// We use Pickr but we need to ensure it doesn't conflict with the circle's own styling
	const pickr = Pickr.create(
		getPickrSettings({
			isView: false,
			el: circle,
			containerEl: containerEl,
			swatches: accentColor ? [accentColor] : [],
			opacity: false,
			defaultColor: displayColor,
			position: 'bottom-end',
		})
	);

	pickr.on('save', async (color: Pickr.HSVaColor | null) => {
		const hexValue = color ? color.toHEXA().toString() : '';
		await plugin.settingsService.setSetting(ACCENT_COLOR_KEY, hexValue);
		// Visual application is handled by the setSetting -> applyAccentColor flow
		plugin.settingsService.applyAccentColor(hexValue);
		pickr.hide();
		onRerender();
	});

	pickr.on('cancel', () => onPickrCancel(pickr));

	// Handle right-click for quick reset
	triggerContainer.addEventListener('contextmenu', (e: MouseEvent) => {
		e.preventDefault();
		const menu = new Menu();
		menu.addItem((item) => {
			item
				.setTitle('Reset to Obsidian Default')
				.setIcon('rotate-ccw')
				.onClick(async () => {
					// Explicitly set to #8a5cf5 to ensure the setting persists for all UI components
					await plugin.settingsService.setSetting(ACCENT_COLOR_KEY, '#8a5cf5');
					plugin.settingsService.applyAccentColor('#8a5cf5');
					onRerender();
				});
		});
		menu.showAtMouseEvent(e);
	});
}

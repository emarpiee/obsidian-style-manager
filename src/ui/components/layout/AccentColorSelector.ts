import ColorPicker from '../../../lib/colorpicker/colorpicker.min.js';
import { Menu, setTooltip } from 'obsidian';

import { ACCENT_COLOR_KEY } from '../../../constants';
import StyleManagerPlugin from '../../../main';
import { getColorPickerConfig } from '../../../utils/UIUtils';

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
	setTooltip(triggerContainer, 'Change accent color (right-click to reset)');

	const circle = triggerContainer.createDiv({
		cls: 'style-manager-accent-trigger',
	});
	circle.style.setProperty('--sm-accent-trigger-color', displayColor);

	// We use jscolorpicker but we need to ensure it doesn't conflict with the circle's own styling
	const pickerToggle = circle.createEl('button', { cls: 'color-picker-reset' });
	const pickr = new ColorPicker(
		pickerToggle,
		getColorPickerConfig({
			isView: false,
			container: containerEl,
			opacity: false,
			defaultColor: displayColor,
		})
	);

	pickr.on('pick', async (color) => {
		const hexValue = color ? color.string('hex').toUpperCase() : '';
		await plugin.settingsService.setSetting(ACCENT_COLOR_KEY, hexValue, {
			silentUI: true,
		});
		// Visual application is handled by the setSetting -> applyAccentColor flow
		plugin.settingsService.applyAccentColor(hexValue);
		onRerender();
	});

	// Handle right-click for quick reset
	triggerContainer.addEventListener('contextmenu', (e: MouseEvent) => {
		e.preventDefault();
		const menu = new Menu();
		menu.addItem((item) => {
			item
				.setTitle('Reset to Obsidian default')
				.setIcon('rotate-ccw')
				.onClick(async () => {
					// Explicitly set to #8a5cf5 to ensure the setting persists for all UI components
					await plugin.settingsService.setSetting(ACCENT_COLOR_KEY, '#8a5cf5', {
						silentUI: true,
					});
					plugin.settingsService.applyAccentColor('#8a5cf5');
					onRerender();
				});
		});
		menu.showAtMouseEvent(e);
	});
}

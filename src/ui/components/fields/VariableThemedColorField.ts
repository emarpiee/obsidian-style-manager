/*
		Style Settings - Obsidian Plugin
    Copyright (c) 2023 mgmeyers

    Style Manager - Obsidian Plugin
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
import ColorPicker from '../../../lib/colorpicker/colorpicker.min.js';
import { ButtonComponent, Setting } from 'obsidian';

import { VariableThemedColor, resetTooltip } from '../../../types';
import { getDescription, getTitle } from '../../../utils/CommonUtils';
import {
	getColorPickerConfig,
	resolveDefaultColor,
	isColorValid,
} from '../../../utils/UIUtils';
import { AbstractSettingComponent } from '../base/AbstractSettingComponent';

export class VariableThemedColorField extends AbstractSettingComponent {
	settingEl: Setting;
	setting: VariableThemedColor;
	pickerLight: ColorPicker | null;
	pickerDark: ColorPicker | null;
	themeLightWrapper: HTMLElement | null = null;
	themeDarkWrapper: HTMLElement | null = null;

	render(): void {
		if (!this.containerEl) return;
		const title = getTitle(this.setting);
		const description = getDescription(this.setting);

		const idLight = `${this.setting.id}@@light`;
		const idDark = `${this.setting.id}@@dark`;
		const valueLight = this.settingsService.getSetting(this.sectionId, idLight);
		const valueDark = this.settingsService.getSetting(this.sectionId, idDark);
		// Resolve schema defaults for the color picker (CSS vars like var(--x) are not parseable)
		const resolvedDefaultLight = resolveDefaultColor(
			this.setting['default-light']
		);
		const resolvedDefaultDark = resolveDefaultColor(
			this.setting['default-dark']
		);

		this.settingEl = new Setting(this.containerEl);
		this.settingEl.setClass('style-manager-style-settings-item');
		this.settingEl.setName(title);

		// Construct description
		this.settingEl.descEl.createSpan({}, (span) => {
			if (description) {
				span.appendChild(document.createTextNode(description));
			}
		});

		this.settingEl.descEl.createDiv({}, (div) => {
			div.createEl('small', {}, (sm) => {
				sm.appendChild(createEl('strong', { text: 'Default (light): ' }));
				sm.appendChild(document.createTextNode(this.setting['default-light']));
			});
			div.createEl('br');
			div.createEl('small', {}, (sm) => {
				sm.appendChild(createEl('strong', { text: 'Default (dark): ' }));
				sm.appendChild(document.createTextNode(this.setting['default-dark']));
			});
		});

		const wrapper = this.settingEl.controlEl.createDiv({
			cls: 'themed-color-wrapper',
		});

		// Create light color picker
		this.createColorPickerLight(
			wrapper,
			this.containerEl,
			(valueLight as string) || '',
			idLight,
			resolvedDefaultLight
		);

		// Create dark color picker
		this.createColorPickerDark(
			wrapper,
			this.containerEl,
			(valueDark as string) || '',
			idDark,
			resolvedDefaultDark
		);

		this.settingEl.settingEl.dataset.id = this.setting.id;
		this.updateModifiedClass();
	}

	destroy(): void {
		this.pickerLight?.destroy();
		this.pickerDark?.destroy();
		this.pickerLight = null;
		this.pickerDark = null;
		this.settingEl?.settingEl.remove();
	}

	private updateVisualsLight(color: string | null): void {
		if (!this.themeLightWrapper) return;

		const resolvedDefault = resolveDefaultColor(this.setting['default-light']);

	}

	private updateVisualsDark(color: string | null): void {
		if (!this.themeDarkWrapper) return;

		const resolvedDefault = resolveDefaultColor(this.setting['default-dark']);

	}

	refresh(): void {
		// Light theme
		const defaultLightRaw = this.setting['default-light'];
		const resolvedDefaultLight = resolveDefaultColor(defaultLightRaw);
		if (this.pickerLight) {
			if (isColorValid(resolvedDefaultLight)) {
				this.pickerLight.setColor(resolvedDefaultLight, false);
				this.updateVisualsLight(resolvedDefaultLight);
			} else {
				this.pickerLight.setColor(null, false);
				this.updateVisualsLight(null);
			}
		}

		// Dark theme
		const defaultDarkRaw = this.setting['default-dark'];
		const resolvedDefaultDark = resolveDefaultColor(defaultDarkRaw);
		if (this.pickerDark) {
			if (isColorValid(resolvedDefaultDark)) {
				this.pickerDark.setColor(resolvedDefaultDark, false);
				this.updateVisualsDark(resolvedDefaultDark);
			} else {
				this.pickerDark.setColor(null, false);
				this.updateVisualsDark(null);
			}
		}

		this.updateModifiedClass();
	}

	private createColorPickerLight(
		wrapper: HTMLDivElement,
		containerEl: HTMLElement,
		valueLight: number | string | boolean,
		idLight: string,
		resolvedDefault: string
	): void {
		this.themeLightWrapper = wrapper.createDiv({ cls: 'theme-light' });

		// fix, so that the color is correctly shown before the color picker has been opened
		const defaultColor =
			valueLight !== undefined && valueLight !== ''
				? (valueLight as string)
				: resolvedDefault;

		const toggleElLight = this.themeLightWrapper.createEl('button');
		const pickerLight = (this.pickerLight = new ColorPicker(
			toggleElLight,
			getColorPickerConfig({
				isView: this.isView,
				container: containerEl,
				opacity: this.setting.opacity,
				defaultColor: defaultColor,
				toggleStyle: 'button',
				dialogPlacement: 'top-start',
			})
		));

		pickerLight.on('open', () => {
			// Do not auto-focus result input as it opens the keyboard on mobile
		});

		pickerLight.on('pick', (color) => {
			this.onSave(idLight, color, pickerLight);
			this.updateVisualsLight(color ? color.string('hex').toUpperCase() : null);
		});

		const themeLightReset = new ButtonComponent(
			this.themeLightWrapper.createDiv({ cls: 'color-picker-reset' })
		);
		themeLightReset.setIcon('reset');
		themeLightReset.onClick(() => {
			const defaultColorRaw = this.setting['default-light'];
			const resolvedDefaultValue = resolveDefaultColor(defaultColorRaw || '');

			this.settingsService.clearSetting(this.sectionId, idLight, {
				silentUI: true,
			});

			if (isColorValid(resolvedDefaultValue)) {
				pickerLight.setColor(resolvedDefaultValue, false);
				this.updateVisualsLight(resolvedDefaultValue);
			} else {
				pickerLight.setColor(null, false);
				this.updateVisualsLight(null);
			}

			this.updateModifiedClass();
		});
		themeLightReset.setTooltip(resetTooltip);
	}

	private createColorPickerDark(
		wrapper: HTMLDivElement,
		containerEl: HTMLElement,
		valueDark: number | string | boolean,
		idDark: string,
		resolvedDefault: string
	): void {
		this.themeDarkWrapper = wrapper.createDiv({ cls: 'theme-dark' });

		// fix, so that the color is correctly shown before the color picker has been opened
		const defaultColor =
			valueDark !== undefined && valueDark !== ''
				? (valueDark as string)
				: resolvedDefault;

		const toggleElDark = this.themeDarkWrapper.createEl('button');
		const pickerDark = (this.pickerDark = new ColorPicker(
			toggleElDark,
			getColorPickerConfig({
				isView: this.isView,
				container: containerEl,
				opacity: this.setting.opacity,
				defaultColor: defaultColor,
				toggleStyle: 'button',
				dialogPlacement: 'top-start',
			})
		));

		pickerDark.on('open', () => {
			// Do not auto-focus result input as it opens the keyboard on mobile
		});

		pickerDark.on('pick', (color) => {
			this.onSave(idDark, color, pickerDark);
			this.updateVisualsDark(color ? color.string('hex').toUpperCase() : null);
		});

		const themeDarkReset = new ButtonComponent(
			this.themeDarkWrapper.createDiv({ cls: 'color-picker-reset' })
		);
		themeDarkReset.setIcon('reset');
		themeDarkReset.onClick(() => {
			const defaultColorRaw = this.setting['default-dark'];
			const resolvedDefaultValue = resolveDefaultColor(defaultColorRaw || '');

			this.settingsService.clearSetting(this.sectionId, idDark, {
				silentUI: true,
			});

			if (isColorValid(resolvedDefaultValue)) {
				pickerDark.setColor(resolvedDefaultValue, false);
				this.updateVisualsDark(resolvedDefaultValue);
			} else {
				pickerDark.setColor(null, false);
				this.updateVisualsDark(null);
			}

			this.updateModifiedClass();
		});
		themeDarkReset.setTooltip(resetTooltip);
	}

	private onColorChange(
		id: string,
		color: InstanceType<typeof ColorPicker.Color> | null,
		_instance: ColorPicker
	): void {
		if (!color) {
			this.settingsService.clearSetting(this.sectionId, id, { silentUI: true });
		} else {
			const hexValue = color.string('hex').toUpperCase();
			const normalizedHex = hexValue.toLowerCase();

			const isLight = id.endsWith('@@light');
			const defaultColor = isLight
				? this.setting['default-light']
				: this.setting['default-dark'];
			const normalizedDefault = (defaultColor || '').toLowerCase();

			if (normalizedHex === normalizedDefault) {
				this.settingsService.clearSetting(this.sectionId, id, {
					silentUI: true,
				});
			} else {
				this.settingsService.setSetting(this.sectionId, id, hexValue, {
					silentUI: true,
				});
			}
		}

		this.updateModifiedClass();
	}

	private onSave(
		id: string,
		color: InstanceType<typeof ColorPicker.Color> | null,
		instance: ColorPicker
	): void {
		this.onColorChange(id, color, instance);
	}

	isModified(): boolean {
		const idLight = `${this.setting.id}@@light`;
		const idDark = `${this.setting.id}@@dark`;

		const valueLight = this.settingsService.getSetting(this.sectionId, idLight);
		const valueDark = this.settingsService.getSetting(this.sectionId, idDark);

		return valueLight !== undefined || valueDark !== undefined;
	}

	getMatchCount(showModifiedOnly: boolean): number {
		if (showModifiedOnly) {
			let count = 0;
			const idLight = `${this.setting.id}@@light`;
			const idDark = `${this.setting.id}@@dark`;

			if (
				this.settingsService.getSetting(this.sectionId, idLight) !== undefined
			)
				count++;
			if (this.settingsService.getSetting(this.sectionId, idDark) !== undefined)
				count++;

			return count > 0 ? count : 1; // Fallback to 1 if it matched via text search instead
		}
		return 1;
	}

	/**
	 * Adds or removes the 'is-modified' class based on whether the themed colors are customized.
	 */
	updateModifiedClass(el?: HTMLElement): void {
		const target = el ?? this.settingEl?.settingEl;
		if (!target) return;

		if (this.isModified()) {
			target.addClass('is-modified');
		} else {
			target.removeClass('is-modified');
		}

		// Also update the parent heading's count badge if it exists
		let currentParent: unknown = this.parent;
		while (currentParent) {
			if (
				typeof (currentParent as { updateCountBadge?: () => void })
					.updateCountBadge === 'function'
			) {
				(currentParent as { updateCountBadge: () => void }).updateCountBadge();
			}
			currentParent = (currentParent as { parent?: unknown }).parent;
		}
	}
}

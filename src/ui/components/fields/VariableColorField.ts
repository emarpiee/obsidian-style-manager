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

import { VariableColor, resetTooltip } from '../../../types';
import {
	getDescription,
	getTitle,
	isValidDefaultColor,
} from '../../../utils/CommonUtils';
import {
	createDescription,
	getColorPickerConfig,
	resolveDefaultColor,
	isColorValid,
} from '../../../utils/UIUtils';
import { AbstractSettingComponent } from '../base/AbstractSettingComponent';

export class VariableColorField extends AbstractSettingComponent {
	settingEl: Setting;
	setting: VariableColor;
	picker: ColorPicker | null;
	singleColorWrapper: HTMLElement | null = null;

	render(): void {
		if (!this.containerEl) return;
		const title = getTitle(this.setting);
		const description = getDescription(this.setting);

		if (
			typeof this.setting.default !== 'string' ||
			!isValidDefaultColor(this.setting.default)
		) {
			this.setting.default = this.settingsService
				.getCSSVar(this.setting.id)
				?.current?.trim();
		}

		const value = this.settingsService.getSetting(
			this.sectionId,
			this.setting.id
		);
		// Resolve the schema default for the color picker (CSS vars are not parseable)
		const resolvedDefault = resolveDefaultColor(this.setting.default || '');

		this.settingEl = new Setting(this.containerEl);
		this.settingEl.setClass('style-manager-style-settings-item');
		this.settingEl.setName(title);
		this.settingEl.setDesc(
			createDescription(description, this.setting.default)
		);

		const wrapper = this.settingEl.controlEl.createDiv({
			cls: 'single-color-wrapper',
		});

		this.singleColorWrapper = wrapper.createDiv({
			cls: 'single-color',
		});

		// fix, so that the color is correctly shown before the color picker has been opened
		const defaultColor =
			value !== undefined ? (value as string) : resolvedDefault;

		const toggleEl = this.singleColorWrapper.createEl('button');
		const picker = (this.picker = new ColorPicker(
			toggleEl,
			getColorPickerConfig({
				isView: this.isView,
				container: this.containerEl,
				opacity: this.setting.opacity,
				defaultColor: defaultColor,
				toggleStyle: 'button',
				dialogPlacement: 'top-start',
			})
		));

		const onColorChange = (
			color: InstanceType<typeof ColorPicker.Color> | null
		): void => {
			if (!color) {
				this.settingsService.clearSetting(this.sectionId, this.setting.id, {
					silentUI: true,
				});
			} else {
				const hexValue = color.string('hex').toUpperCase();
				const normalizedHex = hexValue.toLowerCase();
				const normalizedDefault = (this.setting.default || '').toLowerCase();

				if (normalizedHex === normalizedDefault) {
					this.settingsService.clearSetting(this.sectionId, this.setting.id, {
						silentUI: true,
					});
				} else {
					this.settingsService.setSetting(
						this.sectionId,
						this.setting.id,
						hexValue,
						{ silentUI: true }
					);
				}
			}

			this.updateVisuals();
			this.updateModifiedClass();
		};

		picker.on('pick', (color) => {
			onColorChange(color);
		});

		picker.on('open', () => {
			// Do not auto-focus result input as it opens the keyboard on mobile
		});

		const resetButton = new ButtonComponent(
			this.singleColorWrapper.createDiv({ cls: 'color-picker-reset' })
		);
		resetButton.setIcon('reset');
		resetButton.onClick(() => {
			const defaultColorRaw = this.setting.default;
			const resolvedDefaultValue = resolveDefaultColor(defaultColorRaw || '');

			this.settingsService.clearSetting(this.sectionId, this.setting.id, {
				silentUI: true,
			});

			if (isColorValid(resolvedDefaultValue)) {
				picker.setColor(resolvedDefaultValue, false);
				this.updateVisuals();
			} else {
				picker.setColor(null, false);
				this.updateVisuals();
			}

			this.updateModifiedClass();
		});
		resetButton.setTooltip(resetTooltip);

		this.settingEl.settingEl.dataset.id = this.setting.id;
		this.updateModifiedClass();
	}

	destroy(): void {
		this.picker?.destroy();
		this.picker = null;
		this.settingEl?.settingEl.remove();
	}

	private updateVisuals(): void {
		if (!this.singleColorWrapper) return;
	}

	refresh(): void {
		if (!this.picker) return;

		const defaultColorRaw = this.setting.default;
		const resolvedDefaultValue = resolveDefaultColor(defaultColorRaw || '');

		if (isColorValid(resolvedDefaultValue)) {
			this.picker.setColor(resolvedDefaultValue, false);
			this.updateVisuals();
		} else {
			this.picker.setColor(null, false);
			this.updateVisuals();
		}

		this.updateModifiedClass();
	}
}

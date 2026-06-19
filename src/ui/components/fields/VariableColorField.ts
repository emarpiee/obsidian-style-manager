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
import Pickr from '@simonwep/pickr';
import { ButtonComponent, Setting } from 'obsidian';

import { VariableColor, resetTooltip } from '../../../types';
import {
	getDescription,
	getTitle,
	isValidDefaultColor,
} from '../../../utils/CommonUtils';
import {
	createDescription,
	getPickrSettings,
	onPickrCancel,
	resolveDefaultColor,
} from '../../../utils/UIUtils';
import { AbstractSettingComponent } from '../base/AbstractSettingComponent';

export class VariableColorField extends AbstractSettingComponent {
	settingEl: Setting;
	setting: VariableColor;
	pickr: Pickr | null;
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
		const swatches: string[] = [];

		// Resolve the schema default for Pickr (CSS vars are not parseable by Pickr)
		const resolvedDefault = resolveDefaultColor(this.setting.default || '');
		if (resolvedDefault) {
			swatches.push(resolvedDefault);
		}

		if (value !== undefined) {
			swatches.push(value as string);
		}

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
		this.singleColorWrapper.style.setProperty('--pcr-color', defaultColor);

		const pickr = (this.pickr = Pickr.create(
			getPickrSettings({
				isView: this.isView,
				el: this.singleColorWrapper.createDiv({ cls: 'picker' }),
				containerEl: this.containerEl,
				swatches: swatches,
				opacity: this.setting.opacity,
				defaultColor: defaultColor,
			})
		));

		const onColorChange = (
			color: Pickr.HSVaColor | null,
			instance: Pickr
		): void => {
			if (!color) {
				this.settingsService.clearSetting(this.sectionId, this.setting.id, {
					silentUI: true,
				});
			} else {
				const hexValue = color.toHEXA().toString();
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
					// only add swatch if not already present
					instance.addSwatch(hexValue);
				}
			}

			this.updateVisuals(color ? color.toHEXA().toString() : null);
			this.updateModifiedClass();
		};

		pickr.on('save', (color: Pickr.HSVaColor | null, instance: Pickr) => {
			onColorChange(color, instance);
			instance.hide();
		});

		pickr.on('show', () => {
			// Do not auto-focus result input as it opens the keyboard on mobile
		});

		pickr.on('cancel', onPickrCancel);

		const resetButton = new ButtonComponent(
			this.singleColorWrapper.createDiv({ cls: 'pickr-reset' })
		);
		resetButton.setIcon('reset');
		resetButton.onClick(() => {
			const defaultColorRaw = this.setting.default;
			const resolvedDefaultValue = resolveDefaultColor(defaultColorRaw || '');
			const isColorValid = (color: string | undefined): color is string =>
				!!color && color.trim() !== '' && color.trim() !== '#';

			this.settingsService.clearSetting(this.sectionId, this.setting.id, {
				silentUI: true,
			});

			if (isColorValid(resolvedDefaultValue)) {
				pickr.setColor(resolvedDefaultValue, true);
				this.updateVisuals(resolvedDefaultValue);
			} else {
				pickr.setColor('#00000000', true);
				this.updateVisuals(null);
			}

			this.updateModifiedClass();
		});
		resetButton.setTooltip(resetTooltip);

		this.settingEl.settingEl.dataset.id = this.setting.id;
		this.updateModifiedClass();
	}

	destroy(): void {
		this.pickr?.destroyAndRemove();
		this.pickr = null;
		this.settingEl?.settingEl.remove();
	}

	private updateVisuals(color: string | null): void {
		if (!this.singleColorWrapper || !this.pickr) return;

		const resolvedDefault = resolveDefaultColor(this.setting.default || '');
		const displayColor = color || resolvedDefault || 'transparent';

		this.singleColorWrapper.style.setProperty('--pcr-color', displayColor);

		const pickrRoot = (this.pickr.getRoot() as { root: HTMLElement }).root;
		if (pickrRoot) {
			pickrRoot.style.setProperty('--pcr-color', displayColor);
			const button = pickrRoot.querySelector('.pcr-button') as HTMLElement;
			if (button) {
				button.style.setProperty('--pcr-color', displayColor);
			}
		}
	}

	refresh(): void {
		if (!this.pickr) return;

		const defaultColorRaw = this.setting.default;
		const resolvedDefaultValue = resolveDefaultColor(defaultColorRaw || '');
		const isColorValid = (color: string | undefined): color is string =>
			!!color && color.trim() !== '' && color.trim() !== '#';

		if (isColorValid(resolvedDefaultValue)) {
			this.pickr.setColor(resolvedDefaultValue, true);
			this.updateVisuals(resolvedDefaultValue);
		} else {
			this.pickr.setColor('#00000000', true);
			this.updateVisuals(null);
		}

		this.updateModifiedClass();
	}
}

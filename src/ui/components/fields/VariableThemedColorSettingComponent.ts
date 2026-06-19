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
import { ButtonComponent, Setting } from 'obsidian';

import { VariableThemedColor, resetTooltip } from '../../../types';
import {
	getDescription,
	getTitle,
} from '../../../utils/CommonUtils';
import {
	getPickrSettings,
	onPickrCancel,
	resolveDefaultColor,
} from '../../../utils/UIUtils';
import { AbstractSettingComponent } from '../base/AbstractSettingComponent';

export class VariableThemedColorSettingComponent extends AbstractSettingComponent {
	settingEl: Setting;
	setting: VariableThemedColor;
	pickrLight: Pickr | null;
	pickrDark: Pickr | null;
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
		const swatchesLight: string[] = [];
		const swatchesDark: string[] = [];

		// Resolve schema defaults for Pickr (CSS vars like var(--x) are not parseable by Pickr)
		const resolvedDefaultLight = resolveDefaultColor(
			this.setting['default-light']
		);
		const resolvedDefaultDark = resolveDefaultColor(
			this.setting['default-dark']
		);

		if (resolvedDefaultLight) {
			swatchesLight.push(resolvedDefaultLight);
		}

		if (valueLight !== undefined) {
			swatchesLight.push(valueLight as string);
		}

		if (resolvedDefaultDark) {
			swatchesDark.push(resolvedDefaultDark);
		}

		if (valueDark !== undefined) {
			swatchesDark.push(valueDark as string);
		}

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
			swatchesLight,
			(valueLight as string) || '',
			idLight,
			resolvedDefaultLight
		);

		// Create dark color picker
		this.createColorPickerDark(
			wrapper,
			this.containerEl,
			swatchesDark,
			(valueDark as string) || '',
			idDark,
			resolvedDefaultDark
		);

		this.settingEl.settingEl.dataset.id = this.setting.id;
		this.updateModifiedClass();
	}

	destroy(): void {
		this.pickrLight?.destroyAndRemove();
		this.pickrDark?.destroyAndRemove();
		this.pickrLight = null;
		this.pickrDark = null;
		this.settingEl?.settingEl.remove();
	}

	private updateVisualsLight(color: string | null): void {
		if (!this.themeLightWrapper || !this.pickrLight) return;

		const resolvedDefault = resolveDefaultColor(this.setting['default-light']);
		const displayColor = color || resolvedDefault || 'transparent';

		this.themeLightWrapper.style.setProperty('--pcr-color', displayColor);

		const pickrRoot = (
			this.pickrLight.getRoot() as unknown as { root: HTMLElement }
		).root;
		if (pickrRoot) {
			pickrRoot.style.setProperty('--pcr-color', displayColor);
			const button = pickrRoot.querySelector('.pcr-button') as HTMLElement;
			if (button) {
				button.style.setProperty('--pcr-color', displayColor);
			}
		}
	}

	private updateVisualsDark(color: string | null): void {
		if (!this.themeDarkWrapper || !this.pickrDark) return;

		const resolvedDefault = resolveDefaultColor(this.setting['default-dark']);
		const displayColor = color || resolvedDefault || 'transparent';

		this.themeDarkWrapper.style.setProperty('--pcr-color', displayColor);

		const pickrRoot = (
			this.pickrDark.getRoot() as unknown as { root: HTMLElement }
		).root;
		if (pickrRoot) {
			pickrRoot.style.setProperty('--pcr-color', displayColor);
			const button = pickrRoot.querySelector('.pcr-button') as HTMLElement;
			if (button) {
				button.style.setProperty('--pcr-color', displayColor);
			}
		}
	}

	refresh(): void {
		const isColorValid = (color: string | undefined): color is string =>
			!!color && color.trim() !== '' && color.trim() !== '#';

		// Light theme
		const defaultLightRaw = this.setting['default-light'];
		const resolvedDefaultLight = resolveDefaultColor(defaultLightRaw);
		if (this.pickrLight) {
			if (isColorValid(resolvedDefaultLight)) {
				this.pickrLight.setColor(resolvedDefaultLight, true);
				this.updateVisualsLight(resolvedDefaultLight);
			} else {
				this.pickrLight.setColor('#00000000', true);
				this.updateVisualsLight(null);
			}
		}

		// Dark theme
		const defaultDarkRaw = this.setting['default-dark'];
		const resolvedDefaultDark = resolveDefaultColor(defaultDarkRaw);
		if (this.pickrDark) {
			if (isColorValid(resolvedDefaultDark)) {
				this.pickrDark.setColor(resolvedDefaultDark, true);
				this.updateVisualsDark(resolvedDefaultDark);
			} else {
				this.pickrDark.setColor('#00000000', true);
				this.updateVisualsDark(null);
			}
		}

		this.updateModifiedClass();
	}

	private createColorPickerLight(
		wrapper: HTMLDivElement,
		containerEl: HTMLElement,
		swatchesLight: string[],
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
		this.themeLightWrapper.style.setProperty('--pcr-color', defaultColor);

		const pickrLight = (this.pickrLight = Pickr.create(
			getPickrSettings({
				isView: this.isView,
				el: this.themeLightWrapper.createDiv({ cls: 'picker' }),
				containerEl,
				swatches: swatchesLight,
				opacity: this.setting.opacity,
				defaultColor: defaultColor,
			})
		));

		pickrLight.on('show', () => {
			// Do not auto-focus result input as it opens the keyboard on mobile
		});

		pickrLight.on('save', (color: Pickr.HSVaColor | null, instance: Pickr) => {
			this.onSave(idLight, color, instance);
			this.updateVisualsLight(color ? color.toHEXA().toString() : null);
		});

		pickrLight.on('cancel', onPickrCancel);

		const themeLightReset = new ButtonComponent(
			this.themeLightWrapper.createDiv({ cls: 'pickr-reset' })
		);
		themeLightReset.setIcon('reset');
		themeLightReset.onClick(() => {
			const defaultColorRaw = this.setting['default-light'];
			const resolvedDefaultValue = resolveDefaultColor(defaultColorRaw || '');
			const isColorValid = (color: string | undefined): color is string =>
				!!color && color.trim() !== '' && color.trim() !== '#';

			this.settingsService.clearSetting(this.sectionId, idLight, {
				silentUI: true,
			});

			if (isColorValid(resolvedDefaultValue)) {
				pickrLight.setColor(resolvedDefaultValue, true);
				this.updateVisualsLight(resolvedDefaultValue);
			} else {
				pickrLight.setColor('#00000000', true);
				this.updateVisualsLight(null);
			}

			this.updateModifiedClass();
		});
		themeLightReset.setTooltip(resetTooltip);
	}

	private createColorPickerDark(
		wrapper: HTMLDivElement,
		containerEl: HTMLElement,
		swatchesDark: string[],
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
		this.themeDarkWrapper.style.setProperty('--pcr-color', defaultColor);

		const pickrDark = (this.pickrDark = Pickr.create(
			getPickrSettings({
				isView: this.isView,
				el: this.themeDarkWrapper.createDiv({ cls: 'picker' }),
				containerEl,
				swatches: swatchesDark,
				opacity: this.setting.opacity,
				defaultColor: defaultColor,
			})
		));

		pickrDark.on('show', () => {
			// Do not auto-focus result input as it opens the keyboard on mobile
		});

		pickrDark.on('save', (color: Pickr.HSVaColor | null, instance: Pickr) => {
			this.onSave(idDark, color, instance);
			this.updateVisualsDark(color ? color.toHEXA().toString() : null);
		});

		pickrDark.on('cancel', onPickrCancel);

		const themeDarkReset = new ButtonComponent(
			this.themeDarkWrapper.createDiv({ cls: 'pickr-reset' })
		);
		themeDarkReset.setIcon('reset');
		themeDarkReset.onClick(() => {
			const defaultColorRaw = this.setting['default-dark'];
			const resolvedDefaultValue = resolveDefaultColor(defaultColorRaw || '');
			const isColorValid = (color: string | undefined): color is string =>
				!!color && color.trim() !== '' && color.trim() !== '#';

			this.settingsService.clearSetting(this.sectionId, idDark, {
				silentUI: true,
			});

			if (isColorValid(resolvedDefaultValue)) {
				pickrDark.setColor(resolvedDefaultValue, true);
				this.updateVisualsDark(resolvedDefaultValue);
			} else {
				pickrDark.setColor('#00000000', true);
				this.updateVisualsDark(null);
			}

			this.updateModifiedClass();
		});
		themeDarkReset.setTooltip(resetTooltip);
	}

	private onColorChange(
		id: string,
		color: Pickr.HSVaColor | null,
		instance: Pickr
	): void {
		if (!color) {
			this.settingsService.clearSetting(this.sectionId, id, { silentUI: true });
		} else {
			const hexValue = color.toHEXA().toString();
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
				instance.addSwatch(hexValue);
			}
		}

		this.updateModifiedClass();
	}

	private onSave(
		id: string,
		color: Pickr.HSVaColor | null,
		instance: Pickr
	): void {
		this.onColorChange(id, color, instance);
		instance.hide();
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

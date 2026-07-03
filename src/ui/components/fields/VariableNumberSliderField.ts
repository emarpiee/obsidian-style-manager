/*
    Style Manager - Obsidian Plugin
    Copyright (c) 2026 emarpiee

		Style Settings - Obsidian Plugin
    Copyright (c) 2023 mgmeyers

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
import { Setting, SliderComponent, debounce, ButtonComponent } from 'obsidian';

import { VariableNumberSlider, resetTooltip } from '../../../types';
import { getDescription, getTitle } from '../../../utils/CommonUtils';
import { createDescription } from '../../../utils/UIUtils';
import { AbstractSettingComponent } from '../base/AbstractSettingComponent';

export class VariableNumberSliderField extends AbstractSettingComponent {
	settingEl: Setting;
	sliderComponents: Record<string, SliderComponent> = {};

	render(): void {
		if (!this.containerEl) return;
		const title = getTitle(this.setting);
		const description = getDescription(this.setting);

		this.settingEl = new Setting(this.containerEl);
		this.settingEl.setClass('style-manager-style-settings-item');
		this.settingEl.setName(title);

		const modes = this.setting.themed ? ['light', 'dark'] : ['default'];
		
		this.settingEl.setDesc(
			createDescription(description, modes.map(m => {
				const key = m === 'default' ? 'default' : `default-${m}`;
				return this.setting.themed ? `${m}: ${this.setting[key as keyof VariableNumberSlider]}` : `${this.setting.default}`;
			}).join(', '))
		);

		let wrapper = this.settingEl.controlEl;
		if (this.setting.themed) {
			wrapper = this.settingEl.controlEl.createDiv({ cls: 'themed-field-wrapper' });
		}

		modes.forEach(mode => {
			const settingId = mode === 'default' ? this.setting.id : `${this.setting.id}@@${mode}`;
			const defaultKey = mode === 'default' ? 'default' : `default-${mode}`;
			const defaultValue = this.setting[defaultKey as keyof VariableNumberSlider] as number;
			
			const targetWrapper = this.setting.themed ? wrapper.createDiv({ cls: `theme-${mode}` }) : wrapper;
			
			const slider = new SliderComponent(targetWrapper);
			this.sliderComponents[mode] = slider;

			const value = this.settingsService.getSetting(this.sectionId, settingId);
			
			const onChange = debounce(
				(val: number) => {
					if (val === defaultValue) {
						this.settingsService.clearSetting(this.sectionId, settingId, { silentUI: true });
					} else {
						this.settingsService.setSetting(this.sectionId, settingId, val, { silentUI: true });
					}
					this.updateModifiedClass();
				},
				250,
				true
			);

			slider.setDynamicTooltip();
			slider.setLimits(this.setting.min, this.setting.max, this.setting.step);
			slider.setValue(value !== undefined ? (value as number) : defaultValue);
			slider.onChange(onChange);

			if (this.setting.themed) {
				const resetBtn = new ButtonComponent(targetWrapper.createDiv({ cls: 'setting-item-control-reset' }));
				resetBtn.setIcon('reset');
				resetBtn.onClick(() => {
					slider.setValue(defaultValue);
					this.settingsService.clearSetting(this.sectionId, settingId, { silentUI: true });
					this.updateModifiedClass();
				});
				resetBtn.setTooltip(resetTooltip);
			}
		});

		if (!this.setting.themed) {
			this.settingEl.addExtraButton((b) => {
				b.setIcon('reset');
				b.onClick(() => {
					modes.forEach(mode => {
						const settingId = mode === 'default' ? this.setting.id : `${this.setting.id}@@${mode}`;
						const defaultKey = mode === 'default' ? 'default' : `default-${mode}`;
						const defaultValue = this.setting[defaultKey as keyof VariableNumberSlider] as number;
						this.sliderComponents[mode].setValue(defaultValue);
						this.settingsService.clearSetting(this.sectionId, settingId, { silentUI: true });
					});
					this.updateModifiedClass();
				});
				b.setTooltip(resetTooltip);
			});
		}

		this.settingEl.settingEl.dataset.id = this.setting.id;
		this.updateModifiedClass();
	}

	destroy(): void {
		this.settingEl?.settingEl.remove();
	}

	refresh(): void {
		const modes = this.setting.themed ? ['light', 'dark'] : ['default'];
		modes.forEach(mode => {
			const defaultKey = mode === 'default' ? 'default' : `default-${mode}`;
			const defaultValue = this.setting[defaultKey as keyof VariableNumberSlider] as number;
			this.sliderComponents[mode]?.setValue(defaultValue);
		});
		this.updateModifiedClass();
	}
	
	isModified(): boolean {
		const modes = this.setting.themed ? ['light', 'dark'] : ['default'];
		return modes.some(mode => {
			const settingId = mode === 'default' ? this.setting.id : `${this.setting.id}@@${mode}`;
			return this.settingsService.getSetting(this.sectionId, settingId) !== undefined;
		});
	}

	getMatchCount(showModifiedOnly: boolean): number {
		if (showModifiedOnly) {
			let count = 0;
			const modes = this.setting.themed ? ['light', 'dark'] : ['default'];
			modes.forEach(mode => {
				const settingId = mode === 'default' ? this.setting.id : `${this.setting.id}@@${mode}`;
				if (this.settingsService.getSetting(this.sectionId, settingId) !== undefined) count++;
			});
			return count > 0 ? count : 1;
		}
		return 1;
	}
}

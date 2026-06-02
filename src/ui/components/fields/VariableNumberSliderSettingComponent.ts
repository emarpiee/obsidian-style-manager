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
import { Setting, SliderComponent, debounce } from 'obsidian';

import { t } from '../../../infrastructure/lang/helpers';
import { VariableNumberSlider, resetTooltip } from '../../../types';
import { getDescription, getTitle } from '../../../utils/CommonUtils';
import { createDescription } from '../../../utils/UIUtils';
import { AbstractSettingComponent } from '../base/AbstractSettingComponent';
import { Logger } from '../../../utils/Logger';

export class VariableNumberSliderSettingComponent extends AbstractSettingComponent {
	settingEl: Setting;
	sliderComponent: SliderComponent;
	setting: VariableNumberSlider;

	render(): void {
		if (!this.containerEl) return;
		const title = getTitle(this.setting);
		const description = getDescription(this.setting);

		if (typeof this.setting.default !== 'number') {
			Logger.error(`${t('Error:')} ${title} ${t('missing default value')}`);
			return;
		}

		this.settingEl = new Setting(this.containerEl);
		this.settingEl.setClass('style-manager-style-settings-item');
		this.settingEl.setName(title);
		this.settingEl.setDesc(
			createDescription(description, this.setting.default.toString(10))
		);

		this.settingEl.addSlider((slider) => {
			const value = this.settingsService.getSetting(
				this.sectionId,
				this.setting.id
			);
			const onChange = debounce(
				(value: number) => {
					if (value === this.setting.default) {
						this.settingsService.clearSetting(this.sectionId, this.setting.id, {
							silentUI: true,
						});
					} else {
						this.settingsService.setSetting(
							this.sectionId,
							this.setting.id,
							value,
							{ silentUI: true }
						);
					}
					this.updateModifiedClass();
				},
				250,
				true
			);

			slider.setDynamicTooltip();
			slider.setLimits(this.setting.min, this.setting.max, this.setting.step);
			slider.setValue(
				value !== undefined ? (value as number) : this.setting.default
			);
			slider.onChange(onChange);

			this.sliderComponent = slider;
		});

		this.settingEl.addExtraButton((b) => {
			b.setIcon('reset');
			b.onClick(() => {
				this.sliderComponent.setValue(this.setting.default);
				this.settingsService.clearSetting(this.sectionId, this.setting.id, {
					silentUI: true,
				});
				this.updateModifiedClass();
			});
			b.setTooltip(resetTooltip);
		});

		this.settingEl.settingEl.dataset.id = this.setting.id;
		this.updateModifiedClass();
	}

	destroy(): void {
		this.settingEl?.settingEl.remove();
	}
}

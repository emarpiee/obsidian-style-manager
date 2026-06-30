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
import { Setting, ToggleComponent } from 'obsidian';

import { ClassToggle, resetTooltip } from '../../../types';
import { getDescription, getTitle } from '../../../utils/CommonUtils';
import { AbstractSettingComponent } from '../base/AbstractSettingComponent';

export class ClassToggleField extends AbstractSettingComponent {
	settingEl: Setting;
	toggleComponent: ToggleComponent;
	setting: ClassToggle;

	render(): void {
		if (!this.containerEl) return;
		const title = getTitle(this.setting);
		const description = getDescription(this.setting);

		this.settingEl = new Setting(this.containerEl);
		this.settingEl.setClass('style-manager-style-settings-item');
		this.settingEl.setName(title);
		this.settingEl.setDesc(description ?? '');

		this.settingEl.addToggle((toggle) => {
			const value = this.settingsService.getSetting(
				this.sectionId,
				this.setting.id
			);

			toggle.setValue(value !== undefined ? !!value : !!this.setting.default);
			toggle.onChange((value) => {
				if (value === !!this.setting.default) {
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
			});

			this.toggleComponent = toggle;
		});

		this.settingEl.addExtraButton((b) => {
			b.setIcon('reset');
			b.onClick(() => {
				const value = !!this.setting.default;

				this.toggleComponent.setValue(value);
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

	refresh(): void {
		this.toggleComponent?.setValue(!!this.setting.default);
		this.updateModifiedClass();
	}
}

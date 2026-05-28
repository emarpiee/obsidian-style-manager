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
import { DropdownComponent, Setting } from 'obsidian';

import { t } from '../../../infrastructure/lang/helpers';
import { ClassMultiToggle, SelectOption, resetTooltip } from '../../../types';
import { getDescription, getTitle } from '../../../utils/CommonUtils';
import { createDescription } from '../../../utils/UIUtils';
import { AbstractSettingComponent } from '../base/AbstractSettingComponent';
import { Logger } from '../../../utils/Logger';

export class ClassMultiToggleSettingComponent extends AbstractSettingComponent {
	settingEl: Setting;
	dropdownComponent: DropdownComponent;
	setting: ClassMultiToggle;

	render(): void {
		if (!this.containerEl) return;

		const title = getTitle(this.setting);
		const description = getDescription(this.setting);

		if (typeof this.setting.default !== 'string') {
			Logger.error(`${t('Error:')} ${title} ${t('missing default value')}`);
			return;
		}

		let prevValue = this.getPreviousValue();

		const defaultLabel = this.getDefaultOptionLabel();

		this.settingEl = new Setting(this.containerEl);
		this.settingEl.setName(title);
		this.settingEl.setDesc(
			createDescription(description, this.setting.default, defaultLabel)
		);

		this.settingEl.addDropdown((dropdown) => {
			if (this.setting.allowEmpty) {
				dropdown.addOption('none', '');
			}

			for (const o of this.setting.options) {
				if (typeof o === 'string') {
					dropdown.addOption(o, o);
				} else {
					dropdown.addOption(o.value, o.label);
				}
			}

			dropdown.setValue(prevValue);

			dropdown.onChange((value) => {
				this.settingsService.setSetting(
					this.sectionId,
					this.setting.id,
					value,
					{ silentUI: true }
				);
				prevValue = value;
				this.updateModifiedClass();
			});

			this.dropdownComponent = dropdown;
		});

		this.settingEl.addExtraButton((b) => {
			b.setIcon('reset');
			b.onClick(() => {
				this.dropdownComponent.setValue(this.setting.default || 'none');
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

	private getDefaultOption(): string | SelectOption | undefined {
		if (this.setting.default) {
			return this.setting.options.find((o) => {
				if (typeof o === 'string') {
					return o === this.setting.default;
				}

				return o.value === this.setting.default;
			});
		}

		return undefined;
	}

	private getDefaultOptionLabel(): string | undefined {
		const defaultOption = this.getDefaultOption();

		if (defaultOption) {
			if (typeof defaultOption === 'string') {
				return defaultOption;
			}
			return defaultOption.label;
		}

		return undefined;
	}

	private getPreviousValue(): string {
		const prevValue = this.settingsService.getSetting(
			this.sectionId,
			this.setting.id
		) as string | undefined;

		if (prevValue === undefined) {
			if (this.setting.default) {
				return this.setting.default;
			}
			return 'none';
		}
		return prevValue;
	}
}

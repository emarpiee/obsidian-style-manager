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
import { DropdownComponent, Setting, ButtonComponent } from 'obsidian';

import { SelectOption, VariableSelect, resetTooltip } from '../../../types';
import { getDescription, getTitle } from '../../../utils/CommonUtils';
import { createDescription } from '../../../utils/UIUtils';
import { AbstractSettingComponent } from '../base/AbstractSettingComponent';

export class VariableSelectField extends AbstractSettingComponent {
	settingEl: Setting;
	dropdownComponents: Record<string, DropdownComponent> = {};

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
				const val = this.setting.themed ? this.setting[key as keyof VariableSelect] : this.setting.default;
				const label = this.getDefaultOptionLabel(val as string);
				return this.setting.themed ? `${m}: ${label || val}` : `${label || val}`;
			}).join(', '))
		);

		let wrapper = this.settingEl.controlEl;
		if (this.setting.themed) {
			wrapper = this.settingEl.controlEl.createDiv({ cls: 'themed-field-wrapper' });
		}

		modes.forEach(mode => {
			const settingId = mode === 'default' ? this.setting.id : `${this.setting.id}@@${mode}`;
			const defaultKey = mode === 'default' ? 'default' : `default-${mode}`;
			const defaultValue = this.setting[defaultKey as keyof VariableSelect] as string;
			
			const targetWrapper = this.setting.themed ? wrapper.createDiv({ cls: `theme-${mode}` }) : wrapper;
			
			const dropdown = new DropdownComponent(targetWrapper);
			this.dropdownComponents[mode] = dropdown;

			for (const o of this.setting.options) {
				if (typeof o === 'string') {
					dropdown.addOption(o, o);
				} else {
					dropdown.addOption(o.value, o.label);
				}
			}

			const value = this.settingsService.getSetting(this.sectionId, settingId);
			dropdown.setValue(value !== undefined ? (value as string) : defaultValue);
			
			dropdown.onChange((val) => {
				if (val === defaultValue) {
					this.settingsService.clearSetting(this.sectionId, settingId, { silentUI: true });
				} else {
					this.settingsService.setSetting(this.sectionId, settingId, val, { silentUI: true });
				}
				this.updateModifiedClass();
			});

			if (this.setting.themed) {
				const resetBtn = new ButtonComponent(targetWrapper.createDiv({ cls: 'setting-item-control-reset' }));
				resetBtn.setIcon('reset');
				resetBtn.onClick(() => {
					dropdown.setValue(defaultValue);
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
						const defaultValue = this.setting[defaultKey as keyof VariableSelect] as string;
						this.dropdownComponents[mode].setValue(defaultValue);
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
			const defaultValue = this.setting[defaultKey as keyof VariableSelect] as string;
			this.dropdownComponents[mode]?.setValue(defaultValue);
		});
		this.updateModifiedClass();
	}

	private getDefaultOption(val: string): string | SelectOption | undefined {
		if (val) {
			return this.setting.options.find((o) => {
				if (typeof o === 'string') {
					return o === val;
				}
				return o.value === val;
			});
		}
		return undefined;
	}

	private getDefaultOptionLabel(val: string): string | undefined {
		const defaultOption = this.getDefaultOption(val);
		if (defaultOption) {
			if (typeof defaultOption === 'string') {
				return defaultOption;
			}
			return defaultOption.label;
		}
		return undefined;
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

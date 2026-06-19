import { DropdownComponent, Setting } from 'obsidian';

import { SelectOption, VariableSelect, resetTooltip } from '../../../types';
import { getDescription, getTitle } from '../../../utils/CommonUtils';
import { createDescription } from '../../../utils/UIUtils';
import { AbstractSettingComponent } from '../base/AbstractSettingComponent';

export class VariableSelectField extends AbstractSettingComponent {
	settingEl: Setting;
	dropdownComponent: DropdownComponent;
	setting: VariableSelect;

	render(): void {
		if (!this.containerEl) return;
		const title = getTitle(this.setting);
		const description = getDescription(this.setting);

		const defaultLabel = this.getDefaultOptionLabel();

		this.settingEl = new Setting(this.containerEl);
		this.settingEl.setClass('style-manager-style-settings-item');
		this.settingEl.setName(title);
		this.settingEl.setDesc(
			createDescription(description, this.setting.default, defaultLabel)
		);

		this.settingEl.addDropdown((dropdown) => {
			const value = this.settingsService.getSetting(
				this.sectionId,
				this.setting.id
			);

			for (const o of this.setting.options) {
				if (typeof o === 'string') {
					dropdown.addOption(o, o);
				} else {
					dropdown.addOption(o.value, o.label);
				}
			}

			dropdown.setValue(
				value !== undefined ? (value as string) : this.setting.default
			);
			dropdown.onChange((value) => {
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
			});

			this.dropdownComponent = dropdown;
		});

		this.settingEl.addExtraButton((b) => {
			b.setIcon('reset');
			b.onClick(() => {
				this.dropdownComponent.setValue(this.setting.default);
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
}

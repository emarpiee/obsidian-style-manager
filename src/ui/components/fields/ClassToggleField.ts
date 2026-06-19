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
}

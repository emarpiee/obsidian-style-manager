import { Setting, SliderComponent, debounce } from 'obsidian';

import { VariableNumberSlider, resetTooltip } from '../../../types';
import { getDescription, getTitle } from '../../../utils/CommonUtils';
import { createDescription } from '../../../utils/UIUtils';
import { AbstractSettingComponent } from '../base/AbstractSettingComponent';

export class VariableNumberSliderField extends AbstractSettingComponent {
	settingEl: Setting;
	sliderComponent: SliderComponent;
	setting: VariableNumberSlider;

	render(): void {
		if (!this.containerEl) return;
		const title = getTitle(this.setting);
		const description = getDescription(this.setting);


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

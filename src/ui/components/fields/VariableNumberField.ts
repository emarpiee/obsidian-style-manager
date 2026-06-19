import { Setting, TextComponent } from 'obsidian';

import { VariableNumber, resetTooltip } from '../../../types';
import { getDescription, getTitle } from '../../../utils/CommonUtils';
import { createDescription } from '../../../utils/UIUtils';
import { AbstractSettingComponent } from '../base/AbstractSettingComponent';

export class VariableNumberField extends AbstractSettingComponent {
	settingEl: Setting;
	textComponent: TextComponent;
	setting: VariableNumber;

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

		this.settingEl.addText((text) => {
			const value = this.settingsService.getSetting(
				this.sectionId,
				this.setting.id
			);
			const onCommit = (value: string): void => {
				const isFloat = /\./.test(value);
				const numValue = isFloat ? parseFloat(value) : parseInt(value, 10);

				if (isNaN(numValue)) {
					// Revert the input to the last valid stored value (or default)
					const stored = this.settingsService.getSetting(
						this.sectionId,
						this.setting.id
					);
					this.textComponent.setValue(
						stored != null ? stored.toString() : this.setting.default.toString()
					);
					return;
				}

				if (numValue === this.setting.default) {
					this.settingsService.clearSetting(this.sectionId, this.setting.id, {
						silentUI: true,
					});
				} else {
					this.settingsService.setSetting(
						this.sectionId,
						this.setting.id,
						numValue,
						{ silentUI: true }
					);
				}
				this.updateModifiedClass();
			};

			text.setValue(
				value != null ? value.toString() : this.setting.default.toString()
			);

			text.inputEl.addEventListener('blur', () => {
				onCommit(text.getValue());
			});

			text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
				if (e.key === 'Enter') {
					onCommit(text.getValue());
				}
			});

			this.textComponent = text;
		});

		this.settingEl.addExtraButton((b) => {
			b.setIcon('reset');
			b.onClick(() => {
				this.textComponent.setValue(this.setting.default.toString());
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

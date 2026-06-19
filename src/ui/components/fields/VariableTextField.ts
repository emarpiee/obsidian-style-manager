import { Setting, TextComponent } from 'obsidian';

import { VariableText, resetTooltip } from '../../../types';
import {
	getDescription,
	getTitle,
	sanitizeText,
} from '../../../utils/CommonUtils';
import { createDescription } from '../../../utils/UIUtils';
import { AbstractSettingComponent } from '../base/AbstractSettingComponent';

export class VariableTextField extends AbstractSettingComponent {
	settingEl: Setting;
	textComponent: TextComponent;
	setting: VariableText;

	render(): void {
		if (!this.containerEl) return;
		const title = getTitle(this.setting);
		const description = getDescription(this.setting);


		this.settingEl = new Setting(this.containerEl);
		this.settingEl.setClass('style-manager-style-settings-item');
		this.settingEl.setName(title);
		this.settingEl.setDesc(
			createDescription(description, this.setting.default)
		);

		this.settingEl.addText((text) => {
			let value = this.settingsService.getSetting(
				this.sectionId,
				this.setting.id
			);

			const onCommit = (value: string): void => {
				const sanitizedValue = sanitizeText(value);
				if (sanitizedValue === this.setting.default) {
					this.settingsService.clearSetting(this.sectionId, this.setting.id, {
						silentUI: true,
					});
				} else {
					this.settingsService.setSetting(
						this.sectionId,
						this.setting.id,
						sanitizedValue,
						{ silentUI: true }
					);
				}
				this.updateModifiedClass();
			};

			if (this.setting.quotes && value === `""`) {
				value = ``;
			}

			text.setValue(value != null ? value.toString() : this.setting.default);

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
				this.textComponent.setValue(this.setting.default);
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

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
import { Setting, TextComponent } from 'obsidian';

import { t } from '../../../infrastructure/lang/helpers';
import { VariableNumber, resetTooltip } from '../../../types';
import { getDescription, getTitle } from '../../../utils/CommonUtils';
import { Logger } from '../../../utils/Logger';
import { createDescription } from '../../../utils/UIUtils';
import { AbstractSettingComponent } from '../base/AbstractSettingComponent';

export class VariableNumberSettingComponent extends AbstractSettingComponent {
	settingEl: Setting;
	textComponent: TextComponent;
	setting: VariableNumber;

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

		this.settingEl.addText((text) => {
			const value = this.settingsService.getSetting(
				this.sectionId,
				this.setting.id
			);
			const onCommit = (value: string): void => {
				const isFloat = /\./.test(value);
				const numValue = isFloat ? parseFloat(value) : parseInt(value, 10);

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
				value !== undefined ? value.toString() : this.setting.default.toString()
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

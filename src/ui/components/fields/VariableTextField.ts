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
import { Setting, TextComponent, ButtonComponent } from 'obsidian';

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
	textComponents: Record<string, TextComponent> = {};

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
				return this.setting.themed ? `${m}: ${this.setting[key as keyof VariableText]}` : `${this.setting.default}`;
			}).join(', '))
		);

		let wrapper = this.settingEl.controlEl;
		if (this.setting.themed) {
			wrapper = this.settingEl.controlEl.createDiv({ cls: 'themed-field-wrapper' });
		}

		modes.forEach(mode => {
			const settingId = mode === 'default' ? this.setting.id : `${this.setting.id}@@${mode}`;
			const defaultKey = mode === 'default' ? 'default' : `default-${mode}`;
			const defaultValue = this.setting[defaultKey as keyof VariableText] as string;
			
			const targetWrapper = this.setting.themed ? wrapper.createDiv({ cls: `theme-${mode}` }) : wrapper;
			
			const text = new TextComponent(targetWrapper);
			this.textComponents[mode] = text;

			let value = this.settingsService.getSetting(this.sectionId, settingId);
			if (this.setting.quotes && value === `""`) {
				value = ``;
			}
			
			const onCommit = (val: string): void => {
				const sanitizedValue = sanitizeText(val);
				if (sanitizedValue === defaultValue) {
					this.settingsService.clearSetting(this.sectionId, settingId, { silentUI: true });
				} else {
					this.settingsService.setSetting(this.sectionId, settingId, sanitizedValue, { silentUI: true });
				}
				this.updateModifiedClass();
			};

			text.setValue(value != null ? value.toString() : defaultValue);
			text.inputEl.addEventListener('blur', () => onCommit(text.getValue()));
			text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
				if (e.key === 'Enter') onCommit(text.getValue());
			});
			
			if (this.setting.themed) {
				const resetBtn = new ButtonComponent(targetWrapper.createDiv({ cls: 'setting-item-control-reset' }));
				resetBtn.setIcon('reset');
				resetBtn.onClick(() => {
					text.setValue(defaultValue);
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
						const defaultValue = this.setting[defaultKey as keyof VariableText] as string;
						this.textComponents[mode].setValue(defaultValue);
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
			const defaultValue = this.setting[defaultKey as keyof VariableText] as string;
			this.textComponents[mode]?.setValue(defaultValue);
		});
		this.updateModifiedClass();
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

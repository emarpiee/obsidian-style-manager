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
import { MarkdownRenderer, Setting } from 'obsidian';

import { InfoText } from '../../../types';
import { getDescription, getTitle } from '../../../utils/CommonUtils';
import { AbstractSettingComponent } from '../base/AbstractSettingComponent';

export class InfoTextField extends AbstractSettingComponent {
	settingEl: Setting;

	setting: InfoText;

	render(): void {
		if (!this.containerEl) return;
		const title = getTitle(this.setting);
		const description = getDescription(this.setting);

		this.settingEl = new Setting(this.containerEl);
		this.settingEl.setClass('style-manager-style-settings-item');
		this.settingEl.setClass('style-manager-info-text');
		if (title) {
			this.settingEl.setName(title);
		}
		if (description) {
			if (this.setting.markdown) {
				MarkdownRenderer.renderMarkdown(
					description,
					this.settingEl.descEl,
					'',
					this
				);
				this.settingEl.descEl.addClass('style-manager-markdown');
			} else {
				this.settingEl.setDesc(description);
			}
		}

		this.settingEl.settingEl.dataset.id = this.setting.id;
	}

	destroy(): void {
		this.settingEl?.settingEl.remove();
	}
}

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

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
import { App, Modal, Setting } from 'obsidian';

import { PresetNamePromptModal } from './PresetNamePromptModal';

import { THEME_KEY } from '../../application/SettingsService';
import StyleManagerPlugin from '../../main';
import { Preset, SettingValue } from '../../types';
import { getFormattedTimestamp } from '../../utils/CommonUtils';

export class SectionPresetModal extends Modal {
	plugin: StyleManagerPlugin;
	section: string;
	config: Record<string, SettingValue>;

	constructor(
		app: App,
		plugin: StyleManagerPlugin,
		section: string,
		config: Record<string, SettingValue>
	) {
		super(app);
		this.plugin = plugin;
		this.config = config;
		this.section = section;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;

		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-export-modal');

		this.setTitle(`Save Section as Preset: ${this.section}`);

		contentEl.createEl('p', {
			text: 'Create a reusable preset from these settings, or copy/download the raw JSON data.',
			cls: 'style-manager-modal-description',
		});

		const output = JSON.stringify(this.config, null, 2);

		const pre = contentEl.createEl('pre', { cls: 'style-manager-modal-pre' });
		pre.setText(output);

		new Setting(contentEl)
			.setClass('style-manager-modal-buttons')
			.addButton((btn) =>
				btn.setButtonText('Copy to clipboard').onClick(async () => {
					await navigator.clipboard.writeText(output);
					this.plugin.settingsService.notifications.util('Copied to clipboard');
				})
			)
			.addButton((btn) =>
				btn.setButtonText('Download').onClick(() => {
					const blob = new Blob([output], { type: 'application/json' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					const timestamp = getFormattedTimestamp(
						this.plugin.settingsService.settings[
							'__style_manager_export_date_format'
						] as string
					);
					const timestampPart = timestamp ? `-${timestamp}` : '';
					const preferredExtension =
						(this.plugin.settingsService.settings[
							'__style_manager_export_extension'
						] as string) || '.json';
					a.download = `${this.section
						.replace(/[^a-z0-9]/gi, '-')
						.toLowerCase()}-preset${timestampPart}${preferredExtension}`;
					a.click();
					URL.revokeObjectURL(url);
					this.plugin.settingsService.notifications.preset(
						'Downloaded preset file'
					);
				})
			)
			.addButton((btn) =>
				btn
					.setButtonText('Save as preset')
					.setCta()
					.onClick(async () => {
						if (Object.keys(this.config).length === 0) {
							this.plugin.settingsService.notifications.preset(
								'No modified settings found for this section.'
							);
							return;
						}
						const presetName = await this.promptForName();
						if (!presetName) return;

						const currentTheme =
							this.plugin.settingsService.settings[THEME_KEY];
						const newPreset: Preset = {
							id: crypto.randomUUID(),
							name: presetName,
							created: Date.now(),
							data: {
								...this.config,
								...(currentTheme ? { [THEME_KEY]: currentTheme } : {}),
							},
							targetedPrefixes: [this.section, '__theme'],
						};

						this.plugin.presetService.presets.unshift(newPreset);
						await this.plugin.presetService.savePresets();
						this.plugin.settingsService.notifications.preset(
							`Saved preset: ${presetName}`
						);
						this.close();
					})
			);
	}

	private promptForName(): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new PresetNamePromptModal(this.app, resolve);
			modal.open();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

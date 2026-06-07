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

import StyleManagerPlugin from '../../main';
import { Preset } from '../../types';

/**
 * Displays a read-only JSON preview of a device's isolated settings,
 * with a "Copy to Clipboard" action.
 */
export class LockerPreviewModal extends Modal {
	constructor(
		app: App,
		private plugin: StyleManagerPlugin,
		private title: string,
		private deviceId: string,
		private data: Record<string, unknown>
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('style-manager-plugin');
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-preview-modal');

		this.setTitle(this.title);

		const pre = contentEl.createEl('pre', { cls: 'style-manager-modal-pre' });
		pre.setText(JSON.stringify(this.data, null, 2));

		new Setting(contentEl)
			.setClass('style-manager-modal-buttons')
			.addButton((btn) =>
				btn.setButtonText('Close').onClick(() => {
					this.close();
				})
			)
			.addButton((btn) =>
				btn.setButtonText('Copy to clipboard').onClick(async () => {
					await navigator.clipboard.writeText(
						JSON.stringify(this.data, null, 2)
					);
					this.plugin.settingsService.notifications.util(
						'Copied to clipboard!'
					);
				})
			)
			.addButton((btn) =>
				btn
					.setButtonText('Save as preset')
					.setCta()
					.onClick(async () => {
						const effectiveData =
							this.plugin.settingsService.getEffectiveLockerSettings(
								this.deviceId
							);

						if (Object.keys(effectiveData).length === 0) {
							this.plugin.settingsService.notifications.util(
								'No configurations found in this locker.'
							);
							return;
						}
						const presetName = await this.promptForName();
						if (!presetName) return;

						const newPreset: Preset = {
							id: crypto.randomUUID(),
							name: presetName,
							created: Date.now(),
							data: effectiveData,
							targetedPrefixes: ['All'],
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
		this.contentEl.empty();
	}
}

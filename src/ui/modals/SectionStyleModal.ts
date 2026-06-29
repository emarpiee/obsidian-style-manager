import { App, Modal, Setting } from 'obsidian';

import { PresetNamePromptModal } from './PresetNamePromptModal';
import StyleManagerPlugin from '../../main';
import { Preset, SettingValue } from '../../types';
import { getFormattedTimestamp } from '../../utils/CommonUtils';
import { ExportKeys, StorageKeys } from "../../constants";

export class SectionStyleModal extends Modal {
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

		modalEl.addClass('style-manager-plugin');
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-export-modal');

		this.setTitle(`Viewing section: ${this.section}`);

		contentEl.createEl('p', {
			text: 'Create a reusable preset from this section, or copy/export the raw JSON data.',
			cls: 'style-manager-modal-description',
		});

		const output = JSON.stringify(this.config, null, 2);

		const pre = contentEl.createEl('pre', { cls: 'style-manager-modal-pre' });
		pre.setText(output);

		new Setting(contentEl)
			.setClass('style-manager-modal-buttons')
			.addButton((btn) =>
				btn.setButtonText('Close').onClick(() => this.close())
			)
			.addButton((btn) =>
				btn.setButtonText('Copy to clipboard').onClick(async () => {
					await navigator.clipboard.writeText(output);
					this.plugin.settingsService.notifications.util('Copied to clipboard');
				})
			)
			.addButton((btn) =>
				btn.setButtonText('Export').onClick(() => {
					const blob = new Blob([output], { type: 'application/json' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					const timestamp = getFormattedTimestamp(
						this.plugin.settingsService.settings[
							ExportKeys.EXPORT_DATE_FORMAT
						] as string
					);
					const timestampPart = timestamp ? `-${timestamp}` : '';
					const preferredExtension =
						(this.plugin.settingsService.settings[
							ExportKeys.EXPORT_EXTENSION
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
								'No modified styles found for this section.'
							);
							return;
						}
						const presetName = await this.promptForName();
						if (!presetName) return;

						const currentTheme =
							this.plugin.settingsService.settings[StorageKeys.THEME];
						const newPreset: Preset = {
							id: crypto.randomUUID(),
							name: presetName,
							created: Date.now(),
							data: {
								...this.config,
								...(currentTheme ? { [StorageKeys.THEME]: currentTheme } : {}),
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

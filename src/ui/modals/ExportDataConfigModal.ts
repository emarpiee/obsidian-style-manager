import { App, Modal, Setting } from 'obsidian';

import { EXPORT_DATE_FORMAT_KEY, EXPORT_EXTENSION_KEY } from '../../constants';
import StyleManagerPlugin from '../../main';
import { getFormattedTimestamp } from '../../utils/CommonUtils';

/**
 * Modal for exporting global settings as a raw JSON file.
 * Used for basic settings backups in the Preferences tab.
 */
export class ExportDataConfigModal extends Modal {
	constructor(
		app: App,
		private plugin: StyleManagerPlugin,
		private title: string,
		private config: Record<string, unknown>
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;

		modalEl.addClass('style-manager-plugin');
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-export-modal');

		this.setTitle(this.title);

		contentEl.createEl('p', {
			text: 'This will export your current variable settings and plugin preferences as a raw JSON file. Note: This does not include your CSS snippets.',
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
				btn
					.setButtonText('Download')
					.setCta()
					.onClick(() => {
						const blob = new Blob([output], { type: 'application/json' });
						const url = URL.createObjectURL(blob);
						const a = document.createElement('a');
						a.href = url;
						const timestamp = getFormattedTimestamp(
							this.plugin.settingsService.settings[
								EXPORT_DATE_FORMAT_KEY
							] as string
						);
						const timestampPart = timestamp ? `-${timestamp}` : '';
						const preferredExtension =
							(this.plugin.settingsService.settings[
								EXPORT_EXTENSION_KEY
							] as string) || '.json';

						const safeName = this.title
							.replace(/[^a-z0-9]/gi, '-')
							.toLowerCase();
						a.download = `${safeName}${timestampPart}${preferredExtension}`;
						a.click();
						URL.revokeObjectURL(url);
						this.plugin.settingsService.notifications.preset(
							'Downloaded settings file'
						);
					})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

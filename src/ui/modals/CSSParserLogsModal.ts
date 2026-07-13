import { App, Modal } from 'obsidian';

import StyleManagerPlugin from '../../main';
import { ParseLogList } from '../../types';

export class CSSParserLogsModal extends Modal {
	private plugin: StyleManagerPlugin;
	private parseLogs: ParseLogList;
	private onSettingIdClick?: (settingId: string) => void;

	constructor(
		app: App,
		plugin: StyleManagerPlugin,
		parseLogs: ParseLogList,
		onSettingIdClick?: (settingId: string) => void
	) {
		super(app);
		this.plugin = plugin;
		this.parseLogs = parseLogs;
		this.onSettingIdClick = onSettingIdClick;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('style-manager-plugin');
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-logs-modal');

		this.setTitle('CSS Parser Logs');

		contentEl.empty();

		if (!this.parseLogs || this.parseLogs.length === 0) {
			contentEl.createEl('p', {
				text: 'No warnings or errors found.',
				cls: 'style-manager-empty-desc',
			});
			return;
		}

		const listEl = contentEl.createDiv('style-manager-logs-list');

		this.parseLogs.forEach((log) => {
			const itemEl = listEl.createDiv('style-manager-log-item');
			itemEl.addClass(
				log.type === 'error'
					? 'style-manager-log-error'
					: 'style-manager-log-warning'
			);

			const headerEl = itemEl.createDiv('style-manager-log-header');

			const iconEl = headerEl.createSpan('style-manager-log-icon');
			if (log.type === 'error') {
				iconEl.setText('❌');
			} else {
				iconEl.setText('⚠️');
			}

			headerEl.createSpan({ cls: 'style-manager-log-name', text: log.name });

			const time = new Date(log.timestamp).toLocaleTimeString();
			headerEl.createSpan({ cls: 'style-manager-log-time', text: time });

			const messageEl = itemEl.createDiv({ cls: 'style-manager-log-message' });

			// Render setting ID as a clickable link if available
			if (log.settingId && this.onSettingIdClick) {
				const settingId = log.settingId;
				const onClickFn = this.onSettingIdClick;

				// Replace the quoted settingId in the message with a clickable span
				const quotedId = `'${settingId}'`;
				const msgText = log.message;
				const idx = msgText.indexOf(quotedId);

				if (idx !== -1) {
					messageEl.appendText(msgText.substring(0, idx));
					const link = messageEl.createEl('span', {
						cls: 'style-manager-log-setting-id-link',
						text: quotedId,
					});
					link.setAttribute(
						'title',
						`Search for @id ${settingId} in Styles tab`
					);
					link.addEventListener('click', () => {
						this.close();
						onClickFn(settingId);
					});
					messageEl.appendText(msgText.substring(idx + quotedId.length));
				} else {
					messageEl.setText(msgText);
				}
			} else {
				messageEl.setText(log.message);
			}
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

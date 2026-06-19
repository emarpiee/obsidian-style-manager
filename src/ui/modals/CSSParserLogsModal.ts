import { App, Modal } from 'obsidian';
import { ParseLogList } from '../../types';
import StyleManagerPlugin from '../../main';

export class CSSParserLogsModal extends Modal {
	private plugin: StyleManagerPlugin;
	private parseLogs: ParseLogList;

	constructor(app: App, plugin: StyleManagerPlugin, parseLogs: ParseLogList) {
		super(app);
		this.plugin = plugin;
		this.parseLogs = parseLogs;
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		modalEl.addClass('style-manager-plugin');
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-logs-modal');

		this.setTitle('CSS Parser Logs');

		contentEl.empty();

		if (!this.parseLogs || this.parseLogs.length === 0) {
			contentEl.createEl('p', { text: 'No warnings or errors found.', cls: 'style-manager-empty-desc' });
			return;
		}

		const listEl = contentEl.createDiv('style-manager-logs-list');

		this.parseLogs.forEach((log) => {
			const itemEl = listEl.createDiv('style-manager-log-item');
			itemEl.addClass(log.type === 'error' ? 'style-manager-log-error' : 'style-manager-log-warning');

			const headerEl = itemEl.createDiv('style-manager-log-header');
			
			const iconEl = headerEl.createSpan('style-manager-log-icon');
			if (log.type === 'error') {
				iconEl.innerHTML = `❌`;
			} else {
				iconEl.innerHTML = `⚠️`;
			}

			headerEl.createSpan({ cls: 'style-manager-log-name', text: log.name });
			
			const time = new Date(log.timestamp).toLocaleTimeString();
			headerEl.createSpan({ cls: 'style-manager-log-time', text: time });

			itemEl.createDiv({ cls: 'style-manager-log-message', text: log.message });
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

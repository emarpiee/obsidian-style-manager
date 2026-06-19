import { App, Menu, Modal, Setting } from 'obsidian';

import { PresetScheduleModal } from './PresetScheduleModal';

import StyleManagerPlugin from '../../main';
import { Preset } from '../../types';
import { addApplyOptionsToMenu } from '../tabs/preset/PresetMenuHelper';

export class PresetPreviewModal extends Modal {
	constructor(
		app: App,
		private plugin: StyleManagerPlugin,
		public preset: Preset
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('style-manager-plugin');
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-preview-modal');

		this.setTitle(`Viewing preset: ${this.preset.name}`);

		const pre = contentEl.createEl('pre', { cls: 'style-manager-modal-pre' });
		pre.setText(JSON.stringify(this.preset.data, null, 2));

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
						JSON.stringify(this.preset.data, null, 2)
					);
					this.plugin.settingsService.notifications.util(
						'Settings copied to clipboard!'
					);
				})
			)
			.addButton((btn) =>
				btn
					.setButtonText('Schedule')
					.setCta()
					.onClick(() => {
						new PresetScheduleModal(
							this.plugin.app,
							this.plugin,
							this.preset.id
						).open();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText('Apply')
					.setCta()
					.onClick((e: MouseEvent | KeyboardEvent) => {
						const menu = new Menu();

						addApplyOptionsToMenu(menu, this.plugin, this.preset, {
							onApplied: () => this.close(),
							hideSchedule: true,
						});

						if (e instanceof MouseEvent) {
							menu.showAtMouseEvent(e);
						} else {
							const rect = (e.target as HTMLElement).getBoundingClientRect();
							menu.showAtPosition({ x: rect.left, y: rect.bottom });
						}
					})
			);
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

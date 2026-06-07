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
import { App, Modal, Setting, TextAreaComponent } from 'obsidian';

import {
	ConflictAction,
	ConflictResolutionModal,
} from './ConflictResolutionModal';
import { VaultFileSelectModal } from './VaultFileSelectModal';

import { PresetService } from '../../application/PresetService';

export class ImportPresetModal extends Modal {
	service: PresetService;
	onImport: () => void;

	constructor(app: App, service: PresetService, onImport: () => void) {
		super(app);
		this.service = service;
		this.onImport = onImport;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('style-manager-plugin');
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-import-preset-modal');

		this.setTitle('Import preset');

		contentEl.createEl('p', {
			text: 'Import a JSON preset or a ZIP bundle to restore snippets and settings.',
			cls: 'style-manager-modal-description',
		});

		const errorSpan = contentEl.createEl('p', {
			cls: 'style-manager-import-error style-manager-modal-error style-manager-hidden',
			text: '',
		});

		const processImports = async (
			items: { content: string | ArrayBuffer; name?: string }[]
		): Promise<void> => {
			const analysis =
				await this.service.plugin.presetImportService.analyzePresetImports(
					items
				);

			const performImport = async (
				resolutions?: ConflictAction[]
			): Promise<void> => {
				const total =
					await this.service.plugin.presetImportService.executePresetImport(
						analysis,
						resolutions
					);
				if (total > 0) {
					this.onImport();
					this.service.plugin.settingsService.notifications.preset(
						`Imported ${total} preset${total !== 1 ? 's' : ''}.`
					);
					this.close();
				}
			};

			const allConflicts = [
				...analysis.conflicts.map((c) => ({
					name: c,
					type: 'snippet' as const,
				})),
				...analysis.themeConflicts.map((t) => ({
					name: t,
					type: 'theme' as const,
				})),
			];

			if (allConflicts.length > 0) {
				new ConflictResolutionModal(
					this.app,
					allConflicts,
					async (resolutions) => {
						await performImport(resolutions);
					}
				).open();
			} else {
				await performImport();
			}
		};

		new Setting(contentEl)
			.setClass('style-manager-modal-setting')
			.setName('Import from computer')
			.setDesc('Select .json or .zip bundle files from your computer.')
			.addButton((btn) => {
				const input = document.createElement('input');
				input.addClass('style-manager-modal-input-file');
				input.addClass('style-manager-hidden');
				input.type = 'file';
				input.accept = '.json,.md,.txt,.zip';
				input.multiple = true;
				input.onchange = async (e: Event): Promise<void> => {
					const files = Array.from(
						(e.target as HTMLInputElement).files ?? []
					) as File[];
					if (files.length > 0) {
						const promises = files.map((file) => {
							return new Promise<{
								content: string | ArrayBuffer;
								name: string;
							}>((resolve) => {
								const reader = new FileReader();
								reader.onload = (e): void => {
									resolve({
										content: e.target?.result as string | ArrayBuffer,
										name: file.name.replace(/\.(json|md|txt|zip)$/, ''),
									});
								};
								if (file.name.endsWith('.zip')) {
									reader.readAsArrayBuffer(file);
								} else {
									reader.readAsText(file);
								}
							});
						});

						const results = await Promise.all(promises);
						await processImports(results);
					}
				};
				contentEl.appendChild(input);

				btn.setButtonText('Choose files').onClick(() => input.click());
			});

		new Setting(contentEl)
			.setClass('style-manager-modal-setting')
			.setName('Import from vault')
			.setDesc('Browse and select files already in your vault.')
			.addButton((btn) => {
				btn.setButtonText('Browse vault...').onClick(() => {
					new VaultFileSelectModal(this.app, async (selectedFiles) => {
						if (selectedFiles.length > 0) {
							const imports = await Promise.all(
								selectedFiles.map(async (f) => ({
									content:
										f.extension === 'zip'
											? await this.app.vault.readBinary(f)
											: await this.app.vault.read(f),
									name: f.name.replace(/\.(json|md|txt|zip)$/, ''),
								}))
							);
							await processImports(imports);
						}
					}).open();
				});
			});

		new Setting(contentEl)
			.setClass('style-manager-modal-setting')
			.setName('Paste JSON data')
			.setDesc('Paste the JSON content of a style-manager export here.');

		const textArea = new Setting(contentEl)
			.setClass('style-manager-modal-setting-textarea')
			.addTextArea((text) => {
				text.setPlaceholder('Paste your JSON here...');
				text.inputEl.addClass('style-manager-modal-textarea');
				text.inputEl.rows = 10;
				text.onChange(() => {
					errorSpan.addClass('style-manager-hidden');
				});
				return text;
			});

		new Setting(contentEl)
			.setClass('style-manager-modal-buttons')
			.addButton((btn) =>
				btn.setButtonText('Cancel').onClick(() => this.close())
			)
			.addButton((btn) => {
				btn
					.setButtonText('Import from text')
					.setCta()
					.onClick(async () => {
						const val = (
							textArea.components[0] as TextAreaComponent
						).getValue();
						if (!val.trim()) {
							errorSpan.setText('Please paste some JSON data.');
							errorSpan.removeClass('style-manager-hidden');
							return;
						}

						try {
							JSON.parse(val);
							await processImports([{ content: val }]);
						} catch {
							errorSpan.setText('Invalid JSON data.');
							errorSpan.removeClass('style-manager-hidden');
						}
					});
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

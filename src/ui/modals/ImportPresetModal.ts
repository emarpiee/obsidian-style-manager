import {
	App,
	Modal,
	Setting,
	TextAreaComponent,
	normalizePath,
} from 'obsidian';

import {
	ConflictAction,
	ConflictResolutionModal,
} from './ConflictResolutionModal';
import { PresetNamePromptModal } from './PresetNamePromptModal';
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
			cls: 'style-manager-modal-description',
		});

		const processImports = async (
			items: { content: string | ArrayBuffer; name?: string }[]
		): Promise<void> => {
			const analysis =
				await this.service.plugin.presetImportService.analyzePresetImports(
					items
				);

			if (items.length === 1 && analysis.presets.length === 1) {
				const preset = analysis.presets[0];
				if (preset.name === 'Imported Preset') {
					const name = await this.promptForName();
					if (!name) return;
					preset.name = name;
				}
			}

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
					(resolutions): void => {
						void (async (): Promise<void> => {
							await performImport(resolutions);
						})();
					}
				).open();
			} else {
				await performImport();
			}
		};

		new Setting(contentEl)
			.setClass('style-manager-modal-setting')
			.setName('Import from style settings')
			.setDesc(
				'Automatically import your settings from the style settings plugin.'
			)
			.addButton((btn) => {
				btn.setButtonText('Import').onClick((): void => {
					void (async (): Promise<void> => {
						const path = normalizePath(
							`${this.app.vault.configDir}/plugins/obsidian-style-settings/data.json`
						);
						const exists = await this.app.vault.adapter.exists(path);
						if (!exists) {
							this.service.plugin.settingsService.notifications.error(
								'Style Settings data.json not found. Is the plugin installed?'
							);
							return;
						}
						const content = await this.app.vault.adapter.read(path);
						await processImports([{ content }]);
					})();
				});
			});

		new Setting(contentEl)
			.setClass('style-manager-modal-setting')
			.setName('Import from files')
			.setDesc('Select .json or .zip bundle files from device file explorer.')
			.addButton((btn) => {
				const input = activeWindow.createEl('input');
				input.addClass('style-manager-modal-input-file');
				input.addClass('style-manager-hidden');
				input.type = 'file';
				input.accept = '.json,.md,.txt,.zip';
				input.multiple = true;
				input.onchange = async (e: Event): Promise<void> => {
					const files = Array.from((e.target as HTMLInputElement).files ?? []);
					if (files.length > 0) {
						const promises = files.map((file) => {
							return new Promise<{
								content: string | ArrayBuffer;
								name: string;
							}>((resolve) => {
								const reader = new FileReader();
								reader.onload = (e): void => {
									resolve({
										content: e.target?.result,
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
					new VaultFileSelectModal(this.app, (selectedFiles): void => {
						void (async (): Promise<void> => {
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
						})();
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
					.onClick((): void => {
						void (async (): Promise<void> => {
							const val = (
								textArea.components[0] as TextAreaComponent
							).getValue();
							if (!val.trim()) {
								this.service.plugin.settingsService.notifications.error(
									'Invalid preset JSON data.',
									1000
								);
								return;
							}

							try {
								JSON.parse(val);
								await processImports([{ content: val }]);
							} catch {
								this.service.plugin.settingsService.notifications.error(
									'Invalid preset JSON data.',
									1000
								);
							}
						})();
					});
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private promptForName(): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new PresetNamePromptModal(this.app, resolve);
			modal.open();
		});
	}
}

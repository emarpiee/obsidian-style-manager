import { App, Modal, Setting, displayTooltip } from 'obsidian';

import { CSSEditorModal } from './CSSEditorModal';

import {
	ThemeBuilderService
} from '../../application/ThemeBuilderService';
import StyleManagerPlugin from '../../main';
import {
	Validator,
	Validators,
	applyInvalidState,
	clearInvalidState,
} from '../../utils/ValidationUtils';
import { ThemeManifest } from "../../types";
import { PreferencesKeys } from "../../constants";

export class ThemeManifestModal extends Modal {
	private manifest: ThemeManifest;
	private inputs: Map<
		string,
		{ el: HTMLInputElement | HTMLTextAreaElement; validators: Validator[] }
	> = new Map();

	constructor(
		app: App,
		private plugin: StyleManagerPlugin,
		private service: ThemeBuilderService,
		private onSave: () => void,
		private themeId?: string,
		initialManifest?: ThemeManifest
	) {
		super(app);
		this.manifest = initialManifest
			? { ...initialManifest }
			: {
					name: '',
					author: '',
					version: '1.0.0',
					minAppVersion: '0.15.0',
				};
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('style-manager-plugin');
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-theme-manifest-modal');

		this.setTitle(this.themeId ? 'Edit theme manifest' : 'Create new theme');
		contentEl.createEl('p', {
			text: '⚠️ Modifying a community theme’s manifest may break its connection to the gallery.',
			cls: 'style-manager-theme-manifest-warning',
		});
		// Insert warning before the first setting

		const validateField = (
			key: string,
			el: HTMLInputElement | HTMLTextAreaElement
		): void => {
			const entry = this.inputs.get(key);
			if (!entry) return;
			for (const validator of entry.validators) {
				const error = validator(el.value);
				if (error) {
					applyInvalidState(el, error);
					return;
				}
			}
			clearInvalidState(el);
		};

		new Setting(contentEl)
			.setClass('style-manager-required-setting')
			.setName('Theme name')
			.setDesc('The display name of your theme.')
			.addText((text) => {
				text
					.setPlaceholder('My Awesome Theme')
					.setValue(this.manifest.name)
					.onChange((val) => {
						this.manifest.name = val.trim();
						validateField('name', text.inputEl);
					});
				this.inputs.set('name', {
					el: text.inputEl,
					validators: [Validators.required],
				});
			});

		new Setting(contentEl)
			.setClass('style-manager-required-setting')
			.setName('Author')
			.setDesc("The author's name.")
			.addText((text) => {
				text
					.setPlaceholder('kepano')
					.setValue(this.manifest.author)
					.onChange((val) => {
						this.manifest.author = val.trim();
						validateField('author', text.inputEl);
					});
				this.inputs.set('author', {
					el: text.inputEl,
					validators: [Validators.required],
				});
			});

		new Setting(contentEl)
			.setClass('style-manager-required-setting')
			.setName('Version')
			.setDesc(
				'The version, using Semantic Versioning in the format x.y or x.y.z.'
			)
			.addText((text) => {
				text
					.setPlaceholder('1.0.0')
					.setValue(this.manifest.version)
					.onChange((val) => {
						this.manifest.version = val.trim();
						validateField('version', text.inputEl);
					});
				this.inputs.set('version', {
					el: text.inputEl,
					validators: [Validators.required, Validators.semver],
				});
			});

		new Setting(contentEl)
			.setClass('style-manager-required-setting')
			.setName('Min app version')
			.setDesc('The minimum required Obsidian version.')
			.addText((text) => {
				text
					.setPlaceholder('0.15.0')
					.setValue(this.manifest.minAppVersion)
					.onChange((val) => {
						this.manifest.minAppVersion = val.trim();
						validateField('minAppVersion', text.inputEl);
					});
				this.inputs.set('minAppVersion', {
					el: text.inputEl,
					validators: [Validators.required, Validators.semver],
				});
			});

		new Setting(contentEl)
			.setName('Author URL')
			.setDesc("A URL to the author's website.")
			.addText((text) => {
				text
					.setPlaceholder('https://example.com')
					.setValue(this.manifest.authorUrl || '')
					.onChange((val) => {
						this.manifest.authorUrl = val.trim();
						validateField('authorUrl', text.inputEl);
					});
				this.inputs.set('authorUrl', {
					el: text.inputEl,
					validators: [Validators.url],
				});
			});

		new Setting(contentEl)
			.setName('Funding URL')
			.setDesc(
				'A single URL, or multiple links (one per line, e.g. "Patreon: https://...")'
			)
			.addTextArea((text) => {
				text
					.setPlaceholder(
						'https://buymeacoffee.com/\nOR\nPatreon: https://patreon.com/...\nBuy Me a Coffee: https://buymeacoffee.com/...'
					)
					.setValue(this.getFundingString())
					.onChange((val) => {
						this.manifest.fundingUrl = this.parseFundingString(val);
						validateField('fundingUrl', text.inputEl);
					});
				this.inputs.set('fundingUrl', { el: text.inputEl, validators: [] });
			});

		// Initial validation for existing manifest data
		for (const [key, { el }] of this.inputs) {
			validateField(key, el);
			this.setupValidationListeners(key, el);
		}

		this.setupScrollListener();

		new Setting(contentEl)

			.setClass('style-manager-modal-buttons')
			.addButton((btn) =>
				btn.setButtonText('Cancel').onClick(() => this.close())
			)
			.addButton((btn) =>
				btn
					.setButtonText(this.themeId ? 'Save' : 'Create')
					.setCta()
					.onClick(async () => {
						let hasError = false;
						for (const [_, { el, validators }] of this.inputs) {
							const value = el.value;
							for (const validator of validators) {
								const error = validator(value);
								if (error) {
									applyInvalidState(el, error);
									hasError = true;
									break;
								}
							}
						}

						if (hasError) {
							this.plugin.settingsService.notifications.error(
								'All required fields must be filled and valid.'
							);
							return;
						}

						try {
							if (this.themeId) {
								await this.service.updateThemeManifest(
									this.themeId,
									this.manifest
								);
							} else {
								const themeId = await this.service.createTheme(this.manifest);

								const openModal =
									this.plugin.settingsService.settings[
										PreferencesKeys.OPEN_MODAL_ON_CREATE
									] !== false;
								if (openModal) {
									const useDefaultApp =
										localStorage.getItem(PreferencesKeys.OPEN_IN_DEFAULT_APP) === 'true';
									if (useDefaultApp) {
										const path =
											this.plugin.settingsService.bridge.getThemePath(themeId);
										(
											this.app as unknown as {
												openWithDefaultApp: (path: string) => void;
											}
										).openWithDefaultApp(path);
									} else {
										// Automatically open the CSS editor for the new theme
										new CSSEditorModal(this.app, this.plugin, {
											type: 'Theme',
											id: themeId,
										}).open();
									}
								}
							}
							await this.plugin.settingsService.save({ force: true });
							this.onSave();
							this.close();
						} catch (e) {
							console.error('Failed to save theme manifest:', e);
							const message = e instanceof Error ? e.message : 'Unknown error';
							this.plugin.settingsService.notifications.error(
								`Failed to save theme manifest: ${message}`
							);
						}
					})
			);
	}

	private getFundingString(): string {
		if (!this.manifest.fundingUrl) return '';
		if (typeof this.manifest.fundingUrl === 'string')
			return this.manifest.fundingUrl;

		return Object.entries(this.manifest.fundingUrl)
			.map(([label, url]) => `${label}: ${url}`)
			.join('\n');
	}

	private parseFundingString(val: string): string | Record<string, string> {
		const lines = val
			.split('\n')
			.map((l) => l.trim())
			.filter((l) => l !== '');
		if (lines.length === 0) return '';
		if (lines.length === 1 && !lines[0].includes(': ')) return lines[0];

		const obj: Record<string, string> = {};
		lines.forEach((line) => {
			const splitIdx = line.indexOf(': ');
			if (splitIdx !== -1) {
				const label = line.substring(0, splitIdx).trim();
				const url = line.substring(splitIdx + 2).trim();
				if (label && url) {
					obj[label] = url;
				}
			} else if (line.startsWith('http')) {
				obj[line] = line; // Use URL as label if no colon
			}
		});

		return Object.keys(obj).length > 0 ? obj : val.trim();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private getFieldError(key: string): string | null {
		const entry = this.inputs.get(key);
		if (!entry) return null;
		for (const validator of entry.validators) {
			const error = validator(entry.el.value);
			if (error) return error;
		}
		return null;
	}

	private setupValidationListeners(
		key: string,
		el: HTMLInputElement | HTMLTextAreaElement
	): void {
		const showTooltip = (): void => {
			const error = this.getFieldError(key);
			if (error) {
				displayTooltip(el, error);
			}
		};

		el.addEventListener('focus', showTooltip);
		el.addEventListener('click', showTooltip);
	}

	private setupScrollListener(): void {
		this.contentEl.addEventListener(
			'scroll',
			() => {
				const tooltips = document.querySelectorAll('.tooltip');
				tooltips.forEach((tooltip) => tooltip.remove());
			},
			{ passive: true }
		);
	}
}

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
import { App, Component, Menu, Setting, setIcon } from 'obsidian';

import { ThemeManifest } from '../../../application/ThemeBuilderService';
import StyleManagerPlugin from '../../../main';
import { CSSEditorModal } from '../../modals/CSSEditorModal';
import { ConfirmModal } from '../../modals/ConfirmModal';
import { RenameModal } from '../../modals/RenameModal';
import { ThemeManifestModal } from '../../modals/ThemeManifestModal';

export class ThemeItemComponent extends Component {
	private setting: Setting;

	constructor(
		private app: App,
		private containerEl: HTMLElement,
		private plugin: StyleManagerPlugin,
		public themeId: string,
		public manifest: ThemeManifest,
		private onUpdate: () => void
	) {
		super();
	}

	onload(): void {
		this.render();
	}

	render(): void {
		this.setting = new Setting(this.containerEl)
			.setClass('style-manager-item-row')
			.setClass('style-manager-theme-item')
			.setName(this.manifest.name)
			.addExtraButton((btn) => {
				btn
					.setIcon('info')
					.setTooltip('Edit theme manifest')
					.onClick(() => this.onEditManifest());
			})
			.addExtraButton((btn) => {
				btn
					.setIcon('more-vertical')
					.setTooltip('More options')
					.onClick(() => {
						const menu = new Menu();

						menu.addItem((item) =>
							item
								.setTitle('Edit theme CSS')
								.setIcon('code')
								.onClick(() => this.onEdit())
						);

						menu.addItem((item) =>
							item
								.setTitle('Edit theme manifest')
								.setIcon('info')
								.onClick(() => this.onEditManifest())
						);

						menu.addItem((item) =>
							item
								.setTitle('Duplicate theme')
								.setIcon('copy')
								.onClick(() => this.onDuplicate())
						);

						menu.addItem((item) =>
							item
								.setTitle('Delete theme')
								.setIcon('trash')
								.setWarning(true)
								.onClick(() => this.onDelete())
						);

						const rect = btn.extraSettingsEl.getBoundingClientRect();
						menu.showAtPosition({ x: rect.left, y: rect.bottom });
					});
			});

		if (this.manifest.author) {
			this.setting.nameEl.createSpan({
				cls: 'style-manager-item-title-separator',
				text: ' • ',
			});
			this.setting.nameEl.createSpan({
				cls: 'style-manager-item-title-author',
				text: `by ${this.manifest.author}`,
			});
		}

		this.setting.settingEl.addEventListener('click', (e) => {
			if ((e.target as HTMLElement).closest('.setting-item-control, a')) return;
			this.onEdit();
		});

		this.renderMetadata();
	}

	private renderMetadata(): void {
		const metadataEl = this.setting.infoEl.createDiv(
			'style-manager-item-metadata'
		);

		// Version
		if (this.manifest.version) {
			const fieldEl = metadataEl.createDiv('style-manager-metadata-field');
			const iconEl = fieldEl.createDiv('style-manager-metadata-icon');
			setIcon(iconEl, 'tag');
			fieldEl.createSpan({
				cls: 'style-manager-metadata-label',
				text: `Version: `,
			});
			fieldEl.createSpan({
				cls: 'style-manager-metadata-value',
				text: `${this.manifest.version}`,
			});
		}

		// Min App Version
		if (this.manifest.minAppVersion) {
			const fieldEl = metadataEl.createDiv('style-manager-metadata-field');
			const iconEl = fieldEl.createDiv('style-manager-metadata-icon');
			setIcon(iconEl, 'rocket');
			fieldEl.createSpan({
				cls: 'style-manager-metadata-label',
				text: `Min App: `,
			});
			fieldEl.createSpan({
				cls: 'style-manager-metadata-value',
				text: `${this.manifest.minAppVersion}`,
			});
		}

		// Author URL
		if (this.manifest.authorUrl) {
			const fieldEl = metadataEl.createDiv('style-manager-metadata-field');
			const iconEl = fieldEl.createDiv('style-manager-metadata-icon');
			setIcon(iconEl, 'link');
			fieldEl.createSpan({
				cls: 'style-manager-metadata-label',
				text: `Author URL: `,
			});
			fieldEl.createEl('a', {
				text: this.manifest.authorUrl.replace(/^https?:\/\/(www\.)?/, ''),
				href: this.manifest.authorUrl,
				cls: 'style-manager-metadata-value',
			});
		}

		// Funding URL
		if (this.manifest.fundingUrl) {
			const funding = this.manifest.fundingUrl;
			const links =
				typeof funding === 'string' ? { Funding: funding } : funding;

			Object.entries(links).forEach(([label, url]) => {
				const fieldEl = metadataEl.createDiv('style-manager-metadata-field');
				const iconEl = fieldEl.createDiv('style-manager-metadata-icon');
				setIcon(iconEl, 'heart');

				if (label !== 'Funding' && label !== url) {
					fieldEl.createSpan({
						cls: 'style-manager-metadata-label',
						text: `${label}: `,
					});
				}

				fieldEl.createEl('a', {
					text: url.replace(/^https?:\/\/(www\.)?/, ''),
					href: url,
					cls: 'style-manager-metadata-value',
				});
			});
		}
	}

	private onEdit(): void {
		new CSSEditorModal(this.app, this.plugin, {
			type: 'Theme',
			id: this.themeId,
		}).open();
	}

	private onEditManifest(): void {
		new ThemeManifestModal(
			this.app,
			this.plugin,
			this.plugin.settingsService.themeBuilderService,
			() => this.onUpdate(),
			this.themeId,
			this.manifest
		).open();
	}

	private async onDuplicate(): Promise<void> {
		new RenameModal(
			this.app,
			'Duplicate theme',
			`${this.manifest.name} Copy`,
			async (newName) => {
				if (!newName) return;
				try {
					await this.plugin.settingsService.themeBuilderService.duplicateTheme(
						this.themeId,
						newName
					);
					this.onUpdate();
				} catch (e) {
					const message = e instanceof Error ? e.message : 'Unknown error';
					this.plugin.settingsService.notifications.error(
						`Failed to duplicate theme: ${message}`
					);
				}
			}
		).open();
	}

	private async onDelete(): Promise<void> {
		new ConfirmModal(
			this.app,
			'Delete theme',
			`Are you sure you want to delete the theme "${this.manifest.name}"? This action will permanently remove the theme folder.`,
			'Delete',
			true,
			async () => {
				try {
					await this.plugin.settingsService.themeBuilderService.deleteTheme(
						this.themeId
					);
					this.onUpdate();
				} catch (e) {
					const message = e instanceof Error ? e.message : 'Unknown error';
					this.plugin.settingsService.notifications.error(
						`Failed to delete theme: ${message}`
					);
				}
			}
		).open();
	}

	public setVisibility(visible: boolean): void {
		if (this.setting) {
			this.setting.settingEl.toggle(visible);
		}
	}
}

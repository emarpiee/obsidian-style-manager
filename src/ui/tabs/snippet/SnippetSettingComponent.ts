import { App, Component, Menu, Setting, setIcon } from 'obsidian';

import { PreferencesKeys, StorageKeys } from '../../../constants';
import StyleManagerPlugin from '../../../main';
import { SnippetMetadata } from '../../../types';
import { CSSEditorModal } from '../../modals/CSSEditorModal';
import { ConfirmModal } from '../../modals/ConfirmModal';
import { RenameModal } from '../../modals/RenameModal';

/**
 * A modular component that represents a single CSS snippet row.
 * Handles toggling the snippet state and visual indicators.
 */
export class SnippetSettingComponent extends Component {
	private setting: Setting;

	constructor(
		private app: App,
		private containerEl: HTMLElement,
		private plugin: StyleManagerPlugin,
		public snippetId: string,
		private isSelected: boolean,
		private onSelectionChange: (
			e: MouseEvent | KeyboardEvent,
			forceToggle?: boolean
		) => void,
		private metadata?: SnippetMetadata
	) {
		super();
	}

	onload(): void {
		this.render();
	}

	render(): void {
		const currentEnabled =
			(this.plugin.settingsService.settings[
				StorageKeys.SNIPPETS
			] as string[]) || [];
		const isEnabled = currentEnabled.includes(this.snippetId);

		let toggleEl: HTMLElement;
		this.setting = new Setting(this.containerEl)
			.setClass('style-manager-item-row')
			.setClass('style-manager-snippet-item')
			.setName(this.snippetId + '.css')
			.addToggle((toggle) => {
				toggleEl = toggle.toggleEl;
				toggle.setValue(isEnabled).onChange(async (value) => {
					const snippets = new Set(
						(this.plugin.settingsService.settings[
							StorageKeys.SNIPPETS
						] as string[]) || []
					);
					if (value) snippets.add(this.snippetId);
					else snippets.delete(this.snippetId);

					const list = Array.from(snippets);
					await this.plugin.settingsService.setSetting(
						StorageKeys.SNIPPETS,
						list,
						{
							silentUI: true,
						}
					);
				});
			})
			.addExtraButton((btn) => {
				btn
					.setIcon('more-vertical')
					.setTooltip('More options')
					.onClick(() => {
						const menu = new Menu();

						menu.addItem((item) =>
							item
								.setTitle('Duplicate snippet')
								.setIcon('copy')
								.onClick(() => this.onDuplicate())
						);

						menu.addItem((item) =>
							item
								.setTitle('Edit snippet')
								.setIcon('code')
								.onClick(() => this.onEdit())
						);

						menu.addItem((item) =>
							item
								.setTitle('Rename snippet')
								.setIcon('pencil')
								.onClick(() => this.onRename())
						);

						menu.addItem((item) =>
							item
								.setTitle('Delete snippet')
								.setIcon('trash')
								.setWarning(true)
								.onClick(() => this.onDelete())
						);

						const rect = btn.extraSettingsEl.getBoundingClientRect();
						menu.showAtPosition({ x: rect.left, y: rect.bottom });
					});
			});

		if (this.metadata?.author) {
			this.setting.nameEl.createSpan({
				cls: 'style-manager-item-title-separator',
				text: ' • ',
			});
			this.setting.nameEl.createSpan({
				cls: 'style-manager-item-title-author',
				text: `by ${this.metadata.author}`,
			});
		}

		const selectIcon = document.createElement('div');
		selectIcon.classList.add(
			'clickable-icon',
			'style-manager-item-select-icon'
		);

		if (this.isSelected) {
			this.setting.settingEl.addClass('is-selected');
			setIcon(selectIcon, 'check-circle');
		} else {
			this.setting.settingEl.removeClass('is-selected');
			setIcon(selectIcon, 'circle');
		}

		selectIcon.onclick = (e: MouseEvent): void => {
			e.stopPropagation();
			this.onSelectionChange(e, true);
		};

		this.setting.settingEl.addEventListener('click', (e) => {
			if (
				(e.target as HTMLElement).closest(
					'.setting-item-control, .style-manager-item-select-icon, .checkbox-container'
				)
			) {
				return;
			}

			if (e.ctrlKey || e.metaKey || e.shiftKey) {
				this.onSelectionChange(e);
			} else {
				this.onEdit();
			}
		});

		this.setting.settingEl.prepend(toggleEl!);
		this.setting.controlEl.appendChild(selectIcon);

		this.renderMetadata();
	}

	private renderMetadata(): void {
		const showMetadata =
			(this.plugin.settingsService.settings[
				PreferencesKeys.SHOW_SNIPPET_METADATA
			] as boolean) !== false;
		if (!showMetadata || !this.metadata) return;

		const metadataEl = this.setting.infoEl.createDiv(
			'style-manager-item-metadata'
		);

		const fields: Array<{
			key: keyof SnippetMetadata;
			label: string;
			icon: string;
		}> = [
			{ key: 'description', label: 'Description', icon: 'badge-info' },
			{ key: 'version', label: 'Version', icon: 'tag' },
			{ key: 'authorUrl', label: 'Author Url', icon: 'link' },
			{ key: 'license', label: 'License', icon: 'scale' },
		];

		fields.forEach(({ key, label, icon }) => {
			const value = this.metadata?.[key];
			if (value) {
				const fieldEl = metadataEl.createDiv('style-manager-metadata-field');
				fieldEl.addClass(`mod-${key}`);

				const iconEl = fieldEl.createDiv('style-manager-metadata-icon');
				setIcon(iconEl, icon);

				fieldEl.createSpan({
					cls: 'style-manager-metadata-label',
					text: `${label}: `,
				});

				if (
					key === 'authorUrl' &&
					typeof value === 'string' &&
					value.startsWith('http')
				) {
					fieldEl.createEl('a', {
						cls: 'style-manager-metadata-value',
						text: value.replace(/^https?:\/\/(www\.)?/, ''),
						href: value,
					});
				} else {
					fieldEl.createSpan({
						cls: 'style-manager-metadata-value',
						text: String(value),
					});
				}
			}
		});
	}

	public setVisibility(visible: boolean): void {
		if (this.setting) {
			this.setting.settingEl.toggle(visible);
		}
	}

	public onUpdate(isEnabled: boolean): void {
		const toggle = (
			this.setting as unknown as {
				components: Array<{ setValue?: (val: boolean) => void }>;
			}
		).components.find((c) => c.setValue);
		if (toggle && toggle.setValue) {
			toggle.setValue(isEnabled);
		}
	}

	private async onDuplicate(): Promise<void> {
		try {
			const newName =
				await this.plugin.settingsService.snippetService.duplicateSnippet(
					this.snippetId
				);
			this.plugin.settingsService.notifications.snippet(
				`Duplicated snippet: ${this.snippetId} -> ${newName}`
			);
		} catch (err) {
			console.error('Failed to duplicate snippet:', err);
			this.plugin.settingsService.notifications.error(
				err instanceof Error ? err.message : 'Error duplicating snippet.'
			);
		}
	}

	private onEdit(): void {
		const useDefaultApp =
			localStorage.getItem(PreferencesKeys.OPEN_IN_DEFAULT_APP) === 'true';
		if (useDefaultApp) {
			const path = this.plugin.settingsService.bridge.getSnippetPath(
				this.snippetId
			);
			(
				this.app as unknown as { openWithDefaultApp: (path: string) => void }
			).openWithDefaultApp(path);
		} else {
			new CSSEditorModal(this.app, this.plugin, {
				type: 'Snippet',
				id: this.snippetId,
			}).open();
		}
	}

	private async onRename(): Promise<void> {
		new RenameModal(
			this.app,
			'Rename snippet',
			this.snippetId,
			async (newName) => {
				if (!newName || newName === this.snippetId) return;

				try {
					await this.plugin.settingsService.snippetService.renameSnippet(
						this.snippetId,
						newName
					);
					this.plugin.settingsService.notifications.snippet(
						`Renamed snippet to ${newName}`
					);
				} catch (err) {
					console.error('Failed to rename snippet:', err);
					this.plugin.settingsService.notifications.error(
						err instanceof Error ? err.message : 'Error renaming snippet.'
					);
				}
			}
		).open();
	}

	private async onDelete(): Promise<void> {
		new ConfirmModal(
			this.app,
			'Delete snippet',
			`Are you sure you want to delete the snippet "${this.snippetId}"? This action cannot be undone.`,
			'Delete',
			true,
			async () => {
				try {
					await this.plugin.settingsService.snippetService.deleteSnippet(
						this.snippetId
					);
					this.plugin.settingsService.notifications.snippet(
						`Deleted snippet: ${this.snippetId}`
					);
				} catch (err) {
					console.error('Failed to delete snippet:', err);
					this.plugin.settingsService.notifications.error(
						err instanceof Error ? err.message : 'Error deleting snippet.'
					);
				}
			}
		).open();
	}
}

import { App, Menu, MenuItem, Setting } from 'obsidian';

import { PreferencesKeys, StorageKeys } from '../../constants';
import StyleManagerPlugin from '../../main';
import { copyToClipboard } from '../../utils/UIUtils';
import {
	renderAppearanceBadge,
	renderCountBadge,
	renderSnippetBadge,
	renderThemeBadge,
} from '../components/BadgeUtils';
import { ConfirmModal } from '../modals/ConfirmModal';
import { LockerPreviewModal } from '../modals/LockerPreviewModal';
import { RenameModal } from '../modals/RenameModal';

/**
 * Renders the Isolate Mode tab — mode toggles, device identity management,
 * and the remote lockers list.
 */
export class IsolateTab {
	constructor(
		private app: App,
		private containerEl: HTMLElement,
		private plugin: StyleManagerPlugin,
		private onRerender: () => void
	) {}

	render(): void {
		this.renderIsolateModeSection();
		this.renderLockerIdentitySection();
		this.renderRemoteLockers();
	}

	private renderIsolateModeSection(): void {
		const { containerEl, plugin } = this;

		new Setting(containerEl)
			.setName('Isolate mode')
			.setHeading()
			.setClass('style-manager-settings-tab-title');

		const isolateContainer = containerEl.createDiv(
			'style-manager-settings-tab-content'
		);

		new Setting(isolateContainer)
			.setName('Enable isolate mode')
			.setDesc(
				"Isolate style, theme modifications, enabled snippets to a private locker for this device. When enabled, your local adjustments won't overwrite the shared configuration."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(plugin.settingsService.isIsolateMode())
					.onChange((val): void => {
						void (async (): Promise<void> => {
							void plugin.settingsService.setIsolateMode(val);
							this.onRerender();
						})();
					});
			});

		new Setting(isolateContainer)
			.setName('Always show shared presets')
			.setDesc(
				'When enabled, the preset list will always show the shared locker presets, even if isolate mode is enabled.'
			)
			.addToggle((toggle) => {
				toggle
					.setValue(
						(plugin.settingsService.settings[
							PreferencesKeys.ALWAYS_SHARED_PRESETS
						] as boolean) ?? true
					)
					.onChange((val): void => {
						void (async (): Promise<void> => {
							await plugin.settingsService.setSetting(
								PreferencesKeys.ALWAYS_SHARED_PRESETS,
								val
							);
							plugin.presetService.targetView = 'auto';
						})();
					});
			});
	}

	private renderLockerIdentitySection(): void {
		const { containerEl, plugin } = this;

		new Setting(containerEl)
			.setName('Locker identity')
			.setHeading()
			.setClass('style-manager-settings-tab-title');

		const deviceContainer = containerEl.createDiv(
			'style-manager-settings-tab-content'
		);

		new Setting(deviceContainer)
			.setName('Locker name')
			.setDesc(
				'A name for this private locker. This helps identify your device across others.'
			)
			.addText((text) => {
				text
					.setPlaceholder('E.g., office mac')
					.setValue(plugin.settingsService.deviceName || '');

				const saveName = async (): Promise<void> => {
					await plugin.settingsService.identity.setLockerName(
						plugin.settingsService.deviceId,
						text.getValue(),
						{ silent: false }
					);
				};

				text.inputEl.addEventListener('keydown', (e): void => {
					void (async (): Promise<void> => {
						if (e.key === 'Enter') {
							await saveName();
							text.inputEl.blur();
						}
					})();
				});

				text.inputEl.addEventListener('blur', (): void => {
					void (async (): Promise<void> => {
						await saveName();
					})();
				});
			});

		const descFragment = activeWindow.createFragment();
		descFragment.append('Unique ID: ');
		descFragment.createEl('code', {
			text: plugin.settingsService.deviceId,
			cls: 'style-manager-device-id-code',
		});
		descFragment.createEl('br');
		descFragment.createEl('br');
		descFragment.append(
			'WARNING: Generating a new ID for this device will un-link this device from its current locker and reset the local configurations. This device will be placed into a fresh, empty locker.'
		);

		new Setting(deviceContainer)
			.setName('Device identity')
			.setDesc(descFragment)
			.addExtraButton((btn) => {
				btn
					.setIcon('copy')
					.setTooltip('Copy ID to clipboard')
					.onClick((): void => {
						void (async (): Promise<void> => {
							await copyToClipboard(plugin.settingsService.deviceId);
							this.plugin.settingsService.notifications.util(
								'Locker ID copied to clipboard'
							);
						})();
					});
			})
			.addButton((btn) => {
				btn
					.setButtonText('Generate new ID')
					.setWarning()
					.onClick((): void => {
						void (async (): Promise<void> => {
							new ConfirmModal(
								this.app,
								'Generate new locker ID',
								'Are you sure you want to generate a new locker ID? This device will lose access to its current isolated configurations.',
								'Generate',
								true,
								(): void => {
									void (async (): Promise<void> => {
										await plugin.settingsService.identity.regenerateDeviceId();
									})();
								}
							).open();
						})();
					});
			});
	}

	private renderRemoteLockers(): void {
		const { containerEl, app, plugin } = this;

		new Setting(containerEl)
			.setName('Other devices')
			.setHeading()
			.setClass('style-manager-settings-tab-title');

		const deviceContainer = containerEl.createDiv(
			'style-manager-settings-tab-content'
		);
		const currentId = plugin.settingsService.deviceId;
		const service = plugin.settingsService;

		const allIds = service.identity.getAllDeviceIds().sort((a, b) => {
			if (a === currentId) return -1;
			if (b === currentId) return 1;
			return a.localeCompare(b);
		});

		allIds.forEach((id) => {
			const isCurrent = id === currentId;
			const locker = service.identity.getLockerData(id);
			const theme = locker?.isolateSettings?.[StorageKeys.THEME];
			const appearance = locker?.isolateSettings?.[StorageKeys.APPEARANCE];
			const keys = Object.keys(locker?.isolateSettings || {});
			const count = service.countUniqueSettings(keys);
			const name = service.identity.getLockerName(id);

			const setting = new Setting(deviceContainer)
				.setName(name)
				.addExtraButton((btn) => {
					btn
						.setIcon('more-vertical')
						.setTooltip('More options')
						.onClick(() => {
							const menu = new Menu();

							menu.addItem((item: MenuItem) =>
								item
									.setTitle('Rename locker')
									.setIcon('pencil')
									.onClick(() => {
										const currentName = service.identity.getLockerName(id);
										new RenameModal(
											app,
											`Rename locker: ${id}`,
											currentName || id,
											(newName: string): void => {
												void (async (): Promise<void> => {
													if (newName !== null) {
														await service.identity.setLockerName(id, newName);
														this.onRerender();
													}
												})();
											}
										).open();
									})
							);

							menu.addSeparator();

							menu.addItem((item: MenuItem) =>
								item
									.setTitle('Delete locker')
									.setIcon('trash')
									.setWarning(true)
									.onClick((): void => {
										void (async (): Promise<void> => {
											const isThisDevice = id === service.deviceId;
											const message = isThisDevice
												? `Permanently delete settings and reset device ID for this device? \n\nYour current identity will be erased and a new one generated.`
												: `Permanently delete settings for device ${id}?`;

											new ConfirmModal(
												app,
												'Delete locker',
												message,
												'Delete locker',
												true,
												(): void => {
													void (async (): Promise<void> => {
														await service.identity.removeDeviceLocker(id);
														this.onRerender();
													})();
												}
											).open();
										})();
									})
							);

							const rect = btn.extraSettingsEl.getBoundingClientRect();
							menu.showAtPosition({ x: rect.left, y: rect.bottom });
						});
				});

			setting.setDesc('');
			const descContainer = setting.descEl.createDiv(
				'style-manager-locker-desc-container'
			);

			setting.settingEl.addClass('is-clickable');
			setting.settingEl.addEventListener('click', (e) => {
				if ((e.target as HTMLElement).closest('.setting-item-control')) {
					return;
				}

				const lockerData = service.identity.getLockerData(id);
				if (lockerData) {
					const lockerName = service.identity.getLockerName(id) || id;
					new LockerPreviewModal(
						this.app,
						this.plugin,
						`Viewing locker: ${lockerName}`,
						id,
						lockerData.isolateSettings
					).open();
				}
			});

			const metaRow = descContainer.createDiv('style-manager-locker-meta-row');

			// Appearance Badge
			if (appearance) {
				renderAppearanceBadge(metaRow, appearance as string);
			}

			// Theme Badge
			if (theme) {
				renderThemeBadge(
					metaRow,
					plugin,
					theme as string,
					locker?.isolateSettings?.[StorageKeys.ACCENT_COLOR] as string
				);
			}

			// Count Badge
			renderCountBadge(metaRow, count);

			// Snippets Badge
			renderSnippetBadge(
				metaRow,
				plugin,
				locker?.isolateSettings?.[StorageKeys.SNIPPETS] as string[]
			);

			const idRow = descContainer.createDiv('style-manager-locker-id-row');
			idRow.createSpan({
				cls: 'style-manager-locker-id-text',
				text: `Locker ID: ${id}`,
			});

			const badgeText = isCurrent ? 'This Device' : 'OTHER DEVICE';
			const badgeCls = isCurrent ? 'active' : 'badge-shared';
			setting.nameEl.createSpan({
				text: badgeText,
				cls: `style-manager-badge-secondary ${badgeCls}`,
				attr: { style: 'margin-left: 10px;' },
			});
		});
	}
}

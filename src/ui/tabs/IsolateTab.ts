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
import { App, Menu, MenuItem, Setting } from 'obsidian';

import {
	ACCENT_COLOR_KEY,
	APPEARANCE_KEY,
	SNIPPETS_KEY,
	THEME_KEY,
} from '../../constants';
import StyleManagerPlugin from '../../main';
import { copyToClipboard } from '../../utils/UIUtils';
import {
	renderAppearanceBadge,
	renderCountBadge,
	renderSnippetBadge,
	renderThemeBadge,
} from '../components/fields/BadgeRenderer';
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
				"Isolate style, theme modifications, enabled snippets to a private Locker for this device. When enabled, your local adjustments won't overwrite the shared configuration. (Preset, snippet and theme list remains shared)."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(plugin.settingsService.isIsolateMode())
					.onChange(async (val) => {
						plugin.settingsService.setIsolateMode(val);
						this.onRerender();
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
				'A name for this private Locker. This helps identify your device across others.'
			)
			.addText((text) => {
				text
					.setPlaceholder('e.g., Office Mac')
					.setValue(plugin.settingsService.deviceName || '')
					.onChange(async (val) => {
						await plugin.settingsService.identity.setLockerName(
							plugin.settingsService.deviceId,
							val,
							{ silent: true }
						);
					});
			});

		const descFragment = document.createDocumentFragment();
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
					.onClick(async () => {
						await copyToClipboard(plugin.settingsService.deviceId);
						this.plugin.settingsService.notifications.util(
							'Locker ID copied to clipboard'
						);
					});
			})
			.addButton((btn) => {
				btn
					.setButtonText('Generate new ID')
					.setWarning()
					.onClick(async () => {
						new ConfirmModal(
							this.app,
							'Generate New Identity',
							"Are you sure you want to generate a new Identity? This device will lose access to its current 'Isolate Mode' settings in your shared data.",
							'Generate New ID',
							true,
							async () => {
								await plugin.settingsService.identity.regenerateDeviceId();
							}
						).open();
					});
			});
	}

	private renderRemoteLockers(): void {
		const { containerEl, app, plugin } = this;

		containerEl.createEl('h4', {
			text: 'Other devices',
			cls: 'style-manager-settings-tab-subtitle',
		});

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
			const theme = locker?.isolateSettings?.[THEME_KEY];
			const appearance = locker?.isolateSettings?.[APPEARANCE_KEY];
			const keys = Object.keys(locker?.isolateSettings || {});
			const count = service.countUniqueSettings(keys);
			const name = service.identity.getLockerName(id);

			const setting = new Setting(deviceContainer)
				.setName(name)
				.addExtraButton((btn) => {
					btn
						.setIcon('more-vertical')
						.setTooltip('More Options')
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
											async (newName: string) => {
												if (newName !== null) {
													await service.identity.setLockerName(id, newName);
													this.onRerender();
												}
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
									.onClick(async () => {
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
											async () => {
												await service.identity.removeDeviceLocker(id);
												this.onRerender();
											}
										).open();
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
					new LockerPreviewModal(
						this.app,
						this.plugin,
						`Settings for Device: ${id}`,
						id,
						lockerData.isolateSettings
					).open();
				}
			});

			const metaRow = descContainer.createDiv('style-manager-locker-meta-row');

			// Count Badge
			renderCountBadge(metaRow, count);

			// Appearance Badge
			if (appearance && appearance !== 'system') {
				renderAppearanceBadge(metaRow, appearance as string);
			}

			// Theme Badge (if not default)
			if (theme && theme !== 'Default' && theme !== 'default') {
				renderThemeBadge(
					metaRow,
					theme as string,
					locker?.isolateSettings?.[ACCENT_COLOR_KEY] as string
				);
			}

			// Snippets Badge
			renderSnippetBadge(
				metaRow,
				plugin,
				locker?.isolateSettings?.[SNIPPETS_KEY] as string[]
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

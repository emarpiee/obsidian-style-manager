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
import { App, Component, Menu, Notice, setIcon, setTooltip } from 'obsidian';

import StyleManagerPlugin from '../../../main';
import { DeviceSelectionModal } from '../../modals/DeviceSelectionModal';

export class IsolateModeHeader extends Component {
	private el: HTMLElement | null = null;

	constructor(
		private app: App,
		private plugin: StyleManagerPlugin,
		private containerEl: HTMLElement
	) {
		super();
	}

	setContainer(el: HTMLElement): void {
		this.containerEl = el;
	}

	onload(): void {
		this.registerEvent(
			this.plugin.settingsService.on('isolate-mode-changed', () => {
				this.update();
			})
		);
	}

	/**
	 * Renders a compact status badge into the provided parent element.
	 */
	renderBadge(parentEl: HTMLElement): void {
		const isIsolated = this.plugin.settingsService.isIsolateMode();
		this.el = parentEl.createDiv('style-manager-isolate-badge');
		if (isIsolated) {
			this.el.addClass('is-active');
		}

		setTooltip(
			this.el,
			isIsolated ? 'Manage isolate mode' : 'Enable isolate mode'
		);

		const iconEl = this.el.createSpan('style-manager-isolate-badge-icon');
		setIcon(iconEl, isIsolated ? 'lock' : 'lock-open');

		this.el.createSpan({
			cls: 'style-manager-isolate-badge-text',
			text: 'Isolated',
		});

		this.el.onclick = (_e: MouseEvent): void => {
			if (!isIsolated) {
				// Directly enable Isolate Mode when clicked while disabled
				this.plugin.settingsService.setIsolateMode(true);
				return;
			}

			// Show management menu only when already in Isolate Mode
			const menu = new Menu();

			const isolateSettings = this.plugin.settingsService.getIsolateSettings();
			const sourceName = 'Local isolated locker';

			// 1. Apply to Sync (Global)
			menu.addItem((item) =>
				item
					.setTitle('Apply to shared locker')
					.setIcon('globe')
					.onClick(() => {
						this.plugin.presetService.confirmApply(sourceName, async () => {
							await this.plugin.settingsService.pushToShared();
						});
					})
			);

			// 2. Apply to other Device (Remote)
			const otherDeviceIds = this.plugin.settingsService.identity
				.getAllDeviceIds()
				.filter((id: string) => id !== this.plugin.settingsService.deviceId);

			if (otherDeviceIds.length > 0) {
				menu.addItem((item) =>
					item
						.setTitle('Apply to other device (isolate)')
						.setIcon('share-2')
						.onClick(() => {
							new DeviceSelectionModal(
								this.app,
								this.plugin.settingsService,
								async (deviceId: string) => {
									await this.plugin.settingsService.identity.applyPresetToLocker(
										deviceId,
										isolateSettings
									);
									new Notice(
										`Settings for "${sourceName}" applied to isolated locker.`
									);
								}
							).open();
						})
				);
			}

			menu.addSeparator();

			menu.addItem((item) =>
				item
					.setTitle('Disable isolate mode')
					.setIcon('lock-open')
					.onClick(() => {
						this.plugin.settingsService.setIsolateMode(false);
					})
			);

			const rect = this.el.getBoundingClientRect();
			menu.showAtPosition({ x: rect.left, y: rect.bottom });
		};
	}

	/**
	 * Forced update of the banner state.
	 * Currently expects to be re-rendered via the main StyleManagerLayoutRenderer.
	 */
	update(): void {
		// The actual re-render is triggered by SettingMarkup.rerender()
		// which is typically called when settings change.
	}
}

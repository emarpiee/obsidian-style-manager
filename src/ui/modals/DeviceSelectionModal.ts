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
import { App, Modal, Setting } from 'obsidian';

import { SettingsService } from '../../application/SettingsService';

export class DeviceSelectionModal extends Modal {
	constructor(
		app: App,
		private service: SettingsService,
		private onSelect: (deviceId: string) => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('modal-style-manager');
		modalEl.addClass('style-manager-device-selection-modal');

		this.setTitle('Select target device');

		contentEl.createEl('p', {
			text: 'Choose a device locker to apply the preset configurations to. This will merge the configurations into their private locker.',
			cls: 'style-manager-modal-description',
		});

		const currentId = this.service.deviceId;
		const allIds = this.service.identity
			.getAllDeviceIds()
			.filter((id) => id !== currentId)
			.sort((a, b) =>
				this.service.identity
					.getLockerName(a)
					.localeCompare(this.service.identity.getLockerName(b))
			);

		if (allIds.length === 0) {
			contentEl.createEl('p', {
				text: 'No other device lockers found.',
				cls: 'style-manager-no-devices',
			});
			return;
		}

		const deviceList = contentEl.createDiv('style-manager-device-list');

		allIds.forEach((id) => {
			const name = this.service.identity.getLockerName(id);
			new Setting(deviceList)
				.setName(name)
				.setDesc(`ID: ${id}`)
				.addButton((btn) =>
					btn
						.setButtonText('Select')
						.setCta()
						.onClick(() => {
							this.onSelect(id);
							this.close();
						})
				);
		});

		new Setting(contentEl)
			.setClass('style-manager-modal-buttons')
			.addButton((btn) =>
				btn.setButtonText('Cancel').onClick(() => this.close())
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

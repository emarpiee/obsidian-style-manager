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
import { App, ButtonComponent, Modal, Setting } from 'obsidian';
import { RRule } from 'rrule';

import { PresetScheduleModal } from './PresetScheduleModal';

import StyleManagerPlugin from '../../main';
import { Preset } from '../../types';

export class ActiveSchedulesModal extends Modal {
	plugin: StyleManagerPlugin;

	constructor(app: App, plugin: StyleManagerPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		this.render();
	}

	render() {
		const { contentEl } = this;
		contentEl.empty();

		this.setTitle('Active schedules');

		const schedules = this.plugin.presetScheduleService.schedules;

		if (schedules.length === 0) {
			contentEl.createEl('p', {
				text: 'No active schedules.',
				cls: 'setting-item-description',
			});
			return;
		}

		for (const schedule of schedules) {
			const preset = this.plugin.presetService.presets.find(
				(p: Preset) => p.id === schedule.presetId
			);
			const presetName = preset ? preset.name : 'Unknown preset';

			let scheduleText = 'Unknown schedule';
			try {
				scheduleText = RRule.fromString(schedule.rruleString).toText();
				// Capitalize first letter
				scheduleText =
					scheduleText.charAt(0).toUpperCase() + scheduleText.slice(1);
			} catch (e) {
				console.error('Failed to parse RRule for schedule text', e);
			}

			const setting = new Setting(contentEl)
				.setName(presetName)
				.setDesc(`Target: ${schedule.targetLocker} | ${scheduleText}`);

			if (schedule.isPaused) {
				setting.nameEl.style.textDecoration = 'line-through';
				setting.nameEl.style.opacity = '0.6';
			}

			setting.addButton((btn) => {
				btn
					.setIcon(schedule.isPaused ? 'play' : 'pause')
					.setTooltip(schedule.isPaused ? 'Resume' : 'Pause')
					.onClick(async () => {
						schedule.isPaused = !schedule.isPaused;
						await this.plugin.presetScheduleService.updateSchedule(schedule);
						this.render();
					});
			});

			setting.addButton((btn) => {
				btn
					.setIcon('pencil')
					.setTooltip('Edit time')
					.onClick(() => {
						this.close();
						new PresetScheduleModal(
							this.plugin.app,
							this.plugin,
							schedule.presetId
						).open();
					});
			});

			setting.addButton((btn) => {
				btn
					.setIcon('trash')
					.setTooltip('Remove')
					.setWarning()
					.onClick(async () => {
						await this.plugin.presetScheduleService.deleteSchedule(schedule.id);
						this.render();
					});
			});
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

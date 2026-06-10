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
import { RRule } from 'rrule';

import { PresetScheduleModal } from './PresetScheduleModal';

import StyleManagerPlugin from '../../main';

export class ActiveSchedulesModal extends Modal {
	plugin: StyleManagerPlugin;

	constructor(app: App, plugin: StyleManagerPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		this.render();
	}

	render(): void {
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
			if (
				schedule.targetLocker === 'isolate' &&
				schedule.deviceId &&
				schedule.deviceId !== this.plugin.settingsService.deviceId
			) {
				continue;
			}

			const preset = this.plugin.presetService.getPresetById(schedule.presetId);
			const presetName = preset ? preset.name : 'Unknown preset';

			let scheduleText = 'Unknown schedule';
			try {
				const rule = RRule.fromString(schedule.rruleString);
				if (rule.options.count === 1) {
					const date = rule.all()[0];
					scheduleText = `One-time on ${this.plugin.presetScheduleService.formatDate(date)}`;
				} else {
					const sampleDate = rule.after(new Date(), true);
					if (!sampleDate) {
						scheduleText = rule.toText();
					} else {
						const timeStr = sampleDate.toLocaleString('en-US', {
							hour: 'numeric',
							minute: '2-digit',
							hour12: true,
							timeZone: 'UTC',
						});

						if (rule.options.freq === RRule.DAILY) {
							scheduleText = `Daily at ${timeStr}`;
						} else if (rule.options.freq === RRule.WEEKLY) {
							const dayStr = sampleDate.toLocaleString('en-US', {
								weekday: 'long',
								timeZone: 'UTC',
							});
							scheduleText = `Weekly on ${dayStr} at ${timeStr}`;
						} else {
							scheduleText = rule.toText();
						}
					}
					// Capitalize first letter
					scheduleText =
						scheduleText.charAt(0).toUpperCase() + scheduleText.slice(1);
				}
			} catch (e) {
				console.error('Failed to parse RRule for schedule text', e);
			}

			const setting = new Setting(contentEl).setName(presetName);

			const badgeCls =
				schedule.targetLocker === 'shared' ? 'badge-shared' : 'badge-isolate';
			const badgeText =
				schedule.targetLocker === 'shared' ? 'Shared' : 'Isolated';

			const container = setting.descEl.createDiv(
				'style-manager-badge-container'
			);
			container.createSpan({
				text: badgeText,
				cls: `style-manager-badge-primary ${badgeCls}`,
			});
			container.createSpan({ text: `  ${scheduleText}` });

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

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

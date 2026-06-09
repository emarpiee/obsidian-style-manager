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
import {
	App,
	ButtonComponent,
	DropdownComponent,
	Modal,
	Setting,
} from 'obsidian';
import { Options, RRule } from 'rrule';

import StyleManagerPlugin from '../../main';
import { Preset, PresetSchedule } from '../../types';

export class PresetScheduleModal extends Modal {
	plugin: StyleManagerPlugin;
	presetId: string;
	schedule: PresetSchedule | undefined;

	scheduleType: 'one-time' | 'daily' | 'weekly' = 'daily';
	timeValue: string = '08:00'; // HH:mm format
	datetimeValue: string = ''; // YYYY-MM-DDTHH:mm format
	dayOfWeek: string = 'MO'; // MO, TU, WE, TH, FR, SA, SU
	targetLocker: string = 'shared';

	constructor(app: App, plugin: StyleManagerPlugin, presetId: string) {
		super(app);
		this.plugin = plugin;
		this.presetId = presetId;
		this.schedule =
			this.plugin.presetScheduleService.getScheduleForPreset(presetId);

		const devices = this.plugin.settingsService.settings.__devices || {};
		const defaultTarget = Object.keys(devices).length > 0 ? 'shared' : 'shared';

		if (this.schedule) {
			this.targetLocker = this.schedule.targetLocker;
			this.parseRRuleString(this.schedule.rruleString);
		} else {
			this.targetLocker = defaultTarget;

			// initialize datetimeValue to now + 5 min
			const d = new Date();
			d.setMinutes(d.getMinutes() + 5);
			const tzOffset = d.getTimezoneOffset() * 60000;
			const localISOTime = new Date(d.getTime() - tzOffset)
				.toISOString()
				.slice(0, 16);
			this.datetimeValue = localISOTime;
		}
	}

	parseRRuleString(rruleString: string) {
		try {
			const options = RRule.fromString(rruleString).options;

			if (options.count === 1) {
				this.scheduleType = 'one-time';
				if (options.dtstart) {
					// Use local time for UI
					const d = options.dtstart;
					const yyyy = d.getUTCFullYear();
					const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
					const dd = String(d.getUTCDate()).padStart(2, '0');
					const hh = String(d.getUTCHours()).padStart(2, '0');
					const min = String(d.getUTCMinutes()).padStart(2, '0');
					this.datetimeValue = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
				}
			} else if (options.freq === RRule.WEEKLY) {
				this.scheduleType = 'weekly';
				if (options.byweekday && options.byweekday.length > 0) {
					// RRule weekday to string
					const wkd = options.byweekday[0];
					const days = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
					this.dayOfWeek = days[wkd];
				}
				if (options.byhour !== null && options.byhour.length > 0) {
					const hh = String(options.byhour[0]).padStart(2, '0');
					const mm =
						options.byminute && options.byminute.length > 0
							? String(options.byminute[0]).padStart(2, '0')
							: '00';
					this.timeValue = `${hh}:${mm}`;
				}
			} else if (options.freq === RRule.DAILY) {
				this.scheduleType = 'daily';
				if (options.byhour !== null && options.byhour.length > 0) {
					const hh = String(options.byhour[0]).padStart(2, '0');
					const mm =
						options.byminute && options.byminute.length > 0
							? String(options.byminute[0]).padStart(2, '0')
							: '00';
					this.timeValue = `${hh}:${mm}`;
				}
			}
		} catch (e) {
			console.error('Failed to parse RRule:', e);
		}
	}

	buildRRuleString(): string {
		let ruleOpts: Partial<Options> = {};

		if (this.scheduleType === 'one-time') {
			const d = new Date(this.datetimeValue); // Parses local time
			ruleOpts = {
				freq: RRule.DAILY,
				count: 1,
				dtstart: new Date(
					Date.UTC(
						d.getFullYear(),
						d.getMonth(),
						d.getDate(),
						d.getHours(),
						d.getMinutes(),
						0
					)
				),
			};
		} else {
			const [hh, mm] = this.timeValue.split(':').map(Number);
			const now = new Date();
			ruleOpts = {
				freq: this.scheduleType === 'daily' ? RRule.DAILY : RRule.WEEKLY,
				byhour: hh,
				byminute: mm,
				dtstart: new Date(
					Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0)
				),
			};

			if (this.scheduleType === 'weekly') {
				const dayMap: Record<string, number> = {
					MO: 0,
					TU: 1,
					WE: 2,
					TH: 3,
					FR: 4,
					SA: 5,
					SU: 6,
				};
				ruleOpts.byweekday = [dayMap[this.dayOfWeek]];
			}
		}

		return new RRule(ruleOpts).toString();
	}

	onOpen() {
		this.render();
	}

	render() {
		const { contentEl } = this;
		contentEl.empty();

		const preset = this.plugin.presetService.presets.find(
			(p: Preset) => p.id === this.presetId
		);
		this.setTitle(`Schedule preset: ${preset?.name || 'Unknown'}`);

		new Setting(contentEl).setName('Frequency').addDropdown((dd) => {
			dd.addOption('one-time', 'One-time');
			dd.addOption('daily', 'Daily');
			dd.addOption('weekly', 'Weekly');
			dd.setValue(this.scheduleType);
			dd.onChange((val) => {
				this.scheduleType = val as 'one-time' | 'daily' | 'weekly';
				this.render();
			});
		});

		if (this.scheduleType === 'one-time') {
			const setting = new Setting(contentEl)
				.setName('Date & time')
				.setDesc('When should this preset be applied?');

			const inputEl = document.createElement('input');
			inputEl.type = 'datetime-local';
			inputEl.value = this.datetimeValue;
			inputEl.onchange = (e) => {
				this.datetimeValue = (e.target as HTMLInputElement).value;
			};
			setting.controlEl.appendChild(inputEl);
		} else {
			if (this.scheduleType === 'weekly') {
				new Setting(contentEl).setName('Day of Week').addDropdown((dd) => {
					dd.addOption('MO', 'Monday');
					dd.addOption('TU', 'Tuesday');
					dd.addOption('WE', 'Wednesday');
					dd.addOption('TH', 'Thursday');
					dd.addOption('FR', 'Friday');
					dd.addOption('SA', 'Saturday');
					dd.addOption('SU', 'Sunday');
					dd.setValue(this.dayOfWeek);
					dd.onChange((val) => {
						this.dayOfWeek = val;
					});
				});
			}

			const setting = new Setting(contentEl)
				.setName('Time')
				.setDesc('What time should this preset run?');

			const inputEl = document.createElement('input');
			inputEl.type = 'time';
			inputEl.value = this.timeValue;
			inputEl.onchange = (e) => {
				this.timeValue = (e.target as HTMLInputElement).value;
			};
			setting.controlEl.appendChild(inputEl);
		}

		const lockerSetting = new Setting(contentEl)
			.setName('Target locker')
			.addDropdown((dd) => {
				dd.addOption('shared', 'Shared locker');
				dd.addOption('isolate', 'This device (isolate)');

				const devices = this.plugin.settingsService.settings.__devices || {};
				for (const [id, dev] of Object.entries(
					devices as Record<string, { name?: string }>
				)) {
					dd.addOption(id, dev.name || id);
				}

				dd.setValue(this.targetLocker);
				dd.onChange((val) => {
					this.targetLocker = val;
				});
			});

		const buttonsSetting = new Setting(contentEl);

		if (this.schedule) {
			buttonsSetting.addButton((btn) => {
				btn
					.setButtonText('Remove schedule')
					.setWarning()
					.onClick(async () => {
						if (this.schedule) {
							await this.plugin.presetScheduleService.deleteSchedule(
								this.schedule.id
							);
						}
						this.close();
					});
			});
		}

		buttonsSetting.addButton((btn) => {
			btn.setButtonText('Cancel').onClick(() => this.close());
		});

		buttonsSetting.addButton((btn) => {
			btn
				.setButtonText('Save')
				.setCta()
				.onClick(async () => {
					const rruleStr = this.buildRRuleString();
					if (this.schedule) {
						this.schedule.rruleString = rruleStr;
						this.schedule.targetLocker = this.targetLocker;
						await this.plugin.presetScheduleService.updateSchedule(
							this.schedule
						);
					} else {
						const newSchedule: PresetSchedule = {
							id: crypto.randomUUID(),
							presetId: this.presetId,
							rruleString: rruleStr,
							targetLocker: this.targetLocker,
							lastExecuted: 0,
						};
						await this.plugin.presetScheduleService.addSchedule(newSchedule);
					}
					this.close();
				});
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

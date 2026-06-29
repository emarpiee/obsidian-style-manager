import { RRule } from 'rrule';
import StyleManagerPlugin from '../main';
import { PresetSchedule } from '../types';
import { PreferencesKeys } from "../constants";

export class PresetScheduleService {
	plugin: StyleManagerPlugin;
	private intervalId: number | null = null;

	constructor(plugin: StyleManagerPlugin) {
		this.plugin = plugin;
	}

	get schedules(): PresetSchedule[] {
		return (
			(this.plugin.settingsService.sharedSettings
				._manager_schedules as PresetSchedule[]) || []
		);
	}

	set schedules(val: PresetSchedule[]) {
		this.plugin.settingsService.setSettings(
			{ _manager_schedules: val },
			{ silentUI: true, target: 'shared' }
		);
	}

	public start(): void {
		if (this.intervalId !== null) return;

		this.cleanupOrphanedSchedules();

		// Check immediately on start
		this.checkSchedules();

		// Then check every 5 seconds for better accuracy
		this.intervalId = window.setInterval(() => {
			this.checkSchedules();
		}, 5 * 1000);
	}

	public stop(): void {
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	public getScheduleForPreset(presetId: string): PresetSchedule | undefined {
		return this.schedules.find((s) => s.presetId === presetId);
	}

	public getVisibleScheduleForPreset(
		presetId: string,
		deviceId: string
	): PresetSchedule | undefined {
		return this.schedules.find(
			(s) =>
				s.presetId === presetId &&
				(s.targetLocker === 'shared' ||
					(s.targetLocker === 'isolate' && s.deviceId === deviceId))
		);
	}

	public formatDate(date: Date): string {
		const formatter = new Intl.DateTimeFormat('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			weekday: 'short',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true,
			timeZone: 'UTC',
		});

		const parts = formatter.formatToParts(date);
		const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
		return `${p.month} ${p.day}, ${p.year} ${p.weekday}. ${p.hour}:${p.minute} ${p.dayPeriod}`;
	}

	public getScheduleDescription(schedule: PresetSchedule): string {
		try {
			const rule = RRule.fromString(schedule.rruleString);
			if (rule.options.count === 1) {
				const date = rule.all()[0];
				return `ONE-TIME | ${this.formatDate(date)}`;
			}

			const sampleDate = rule.after(new Date(), true);
			if (!sampleDate) return rule.toText();

			const timeStr = sampleDate.toLocaleString('en-US', {
				hour: 'numeric',
				minute: '2-digit',
				hour12: true,
				timeZone: 'UTC',
			});

			if (rule.options.freq === RRule.DAILY) {
				return `DAILY | ${timeStr}`;
			} else if (rule.options.freq === RRule.WEEKLY) {
				const dayStr = sampleDate.toLocaleString('en-US', {
					weekday: 'long',
					timeZone: 'UTC',
				});
				return `WEEKLY | ${dayStr} at ${timeStr}`;
			}

			return rule.toText();
		} catch (_e) {
			return 'Unknown schedule';
		}
	}

	public checkConflict(
		schedule: PresetSchedule,
		excludeId?: string
	): string | null {
		const currentSchedules = this.schedules;
		const rule = RRule.fromString(schedule.rruleString);
		const now = new Date();
		const oneYearFromNow = new Date();
		oneYearFromNow.setFullYear(now.getFullYear() + 1);

		const targetOccurrences = rule.between(now, oneYearFromNow);

		for (const other of currentSchedules) {
			if (excludeId && other.id === excludeId) continue;
			if (other.isPaused) continue;

			if (
				other.targetLocker === 'isolate' &&
				other.deviceId &&
				other.deviceId !== this.plugin.settingsService.deviceId
			) {
				continue;
			}

			const otherRule = RRule.fromString(other.rruleString);

			for (const tOcc of targetOccurrences) {
				const start = new Date(tOcc.getTime() - 1000);
				const end = new Date(tOcc.getTime() + 1000);
				const matches = otherRule.between(start, end);

				if (matches.length > 0) {
					const otherPreset = this.plugin.presetService.getPresetById(
						other.presetId
					);
					return `Conflict with preset "${otherPreset?.name || 'Unknown'}" at ${this.formatDate(tOcc)}`;
				}
			}
		}

		return null;
	}

	public async addSchedule(schedule: PresetSchedule): Promise<void> {
		const current = this.schedules;
		schedule.deviceId = this.plugin.settingsService.deviceId;
		current.push(schedule);
		this.schedules = current;
		await this.plugin.settingsService.save();
		this.plugin.settingsService.trigger('preset-schedules-updated');
	}

	public async updateSchedule(schedule: PresetSchedule): Promise<void> {
		const current = this.schedules;
		const index = current.findIndex((s) => s.id === schedule.id);
		if (index !== -1) {
			current[index] = schedule;
			this.schedules = current;
			await this.plugin.settingsService.save();
			this.plugin.settingsService.trigger('preset-schedules-updated');
		}
	}

	public async deleteSchedule(id: string): Promise<void> {
		this.schedules = this.schedules.filter((s) => s.id !== id);
		await this.plugin.settingsService.save();
		this.plugin.settingsService.trigger('preset-schedules-updated');
	}

	private async cleanupOrphanedSchedules(): Promise<void> {
		const knownDeviceIds =
			this.plugin.settingsService.identity.getAllDeviceIds();
		const currentSchedules = this.schedules;
		const filteredSchedules = currentSchedules.filter((s) => {
			if (
				s.targetLocker === 'isolate' &&
				s.deviceId &&
				!knownDeviceIds.includes(s.deviceId)
			) {
				return false;
			}
			return true;
		});

		if (filteredSchedules.length !== currentSchedules.length) {
			this.schedules = filteredSchedules;
			await this.plugin.settingsService.save();
		}
	}

	private async checkSchedules(): Promise<void> {
		const now = new Date();
		const currentSchedules = this.schedules;
		let updated = false;

		const getPretendUTC = (d: Date): Date =>
			new Date(
				Date.UTC(
					d.getFullYear(),
					d.getMonth(),
					d.getDate(),
					d.getHours(),
					d.getMinutes(),
					d.getSeconds()
				)
			);

		const nowPretendUTC = getPretendUTC(now);

		for (const schedule of currentSchedules) {
			if (schedule.isPaused) continue;

			if (
				schedule.targetLocker === 'isolate' &&
				schedule.deviceId &&
				schedule.deviceId !== this.plugin.settingsService.deviceId
			) {
				continue;
			}

			try {
				const rule = RRule.fromString(schedule.rruleString);

				const lastExecutedDate = schedule.lastExecuted
					? getPretendUTC(new Date(schedule.lastExecuted))
					: new Date(nowPretendUTC.getTime() - 60000);

				const occurrences = rule.between(
					lastExecutedDate,
					nowPretendUTC,
					false
				);

				if (occurrences.length > 0) {
					// We have reached or passed the next designated time.
					await this.executeSchedule(schedule);
					schedule.lastExecuted = now.getTime();
					updated = true;
				}
			} catch (err) {
				console.error(
					`Style Manager | Error processing schedule ${schedule.id}:`,
					err
				);
			}
		}

		if (updated) {
			this.schedules = currentSchedules;
			await this.plugin.settingsService.save();
		}
	}

	private async executeSchedule(schedule: PresetSchedule): Promise<void> {
		const preset = this.plugin.presetService.getPresetById(schedule.presetId);
		this.plugin.settingsService.notifications.preset(
			`Executing scheduled preset: ${preset?.name || 'Unknown'}`
		);

		const action =
			(this.plugin.settingsService.settings[PreferencesKeys.SCHEDULE_APPLY_ACTION] as
				| 'overwrite'
				| 'merge') || 'overwrite';

		if (schedule.targetLocker === 'shared') {
			await this.plugin.presetService.applyPresets(
				[schedule.presetId],
				false,
				action
			);
		} else if (schedule.targetLocker === 'isolate') {
			await this.plugin.presetService.applyPresets(
				[schedule.presetId],
				true,
				action
			);
		} else {
			// Remote device locker
			await this.plugin.presetService.applyPresetsToLocker(
				schedule.targetLocker,
				[schedule.presetId],
				action
			);
		}
	}
}

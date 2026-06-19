
import { App, Modal, Setting } from 'obsidian';
import { RRule } from 'rrule';
import { Logger } from '../../utils/Logger';

import { PresetScheduleModal } from './PresetScheduleModal';

import StyleManagerPlugin from '../../main';

export class ActiveSchedulesModal extends Modal {
	plugin: StyleManagerPlugin;
	private updateHandler: () => void;

	constructor(app: App, plugin: StyleManagerPlugin) {
		super(app);
		this.plugin = plugin;
		this.updateHandler = (): void => this.render();
	}

	onOpen(): void {
		this.plugin.settingsService.on(
			'preset-schedules-updated',
			this.updateHandler
		);
		this.render();
	}

	render(): void {
		const { contentEl } = this;
		contentEl.empty();

		this.setTitle('Active schedules');

		const schedules = this.plugin.presetScheduleService.schedules;

		const isolatedPresets = new Set(
			schedules
				.filter(
					(s) =>
						s.targetLocker === 'isolate' &&
						s.deviceId &&
						s.deviceId !== this.plugin.settingsService.deviceId
				)
				.map((s) => s.presetId)
		);

		if (isolatedPresets.size > 0) {
			contentEl.createEl('p', {
				text: `${isolatedPresets.size} preset${
					isolatedPresets.size > 1 ? 's' : ''
				} have isolated schedules on other devices`,
				cls: 'setting-item-description',
			});
		}

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
				const scheduleObj =
					this.plugin.presetScheduleService.getScheduleForPreset(
						schedule.presetId
					);
				if (scheduleObj) {
					scheduleText =
						this.plugin.presetScheduleService.getScheduleDescription(
							scheduleObj
						);
				} else {
					const rule = RRule.fromString(schedule.rruleString);
					scheduleText = rule.toText();
				}
			} catch (e) {
				Logger.error('Failed to parse RRule for schedule text', e);
			}

			const setting = new Setting(contentEl).setName(presetName);

			const badgeCls =
				schedule.targetLocker === 'shared' ? 'badge-shared' : 'badge-isolate';
			const badgeText =
				schedule.targetLocker === 'shared' ? 'Shared' : 'Isolate';

			const container = setting.descEl.createDiv(
				'style-manager-badge-container'
			);
			container.createSpan({
				text: badgeText,
				cls: `style-manager-badge-primary ${badgeCls}`,
			});
			container.createSpan({ text: `  ${scheduleText}` });

			if (schedule.isPaused) {
				setting.nameEl.addClass('style-manager-schedule-paused');
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
		this.plugin.settingsService.off(
			'preset-schedules-updated',
			this.updateHandler
		);
	}
}

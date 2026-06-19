import { Notice } from 'obsidian';

import {
	SHOW_ISOLATE_NOTIFICATIONS_KEY,
	SHOW_PRESET_NOTIFICATIONS_KEY,
	SHOW_SHARED_NOTIFICATIONS_KEY,
	SHOW_SNIPPET_NOTIFICATIONS_KEY,
	SHOW_UTILITY_NOTIFICATIONS_KEY,
} from '../constants';

export enum NotificationType {
	SHARED = 'shared',
	PRESET = 'preset',
	ISOLATE = 'isolate',
	SNIPPET = 'snippet',
	UTILITY = 'utility',
	ERROR = 'error',
}

/**
 * Centrally manages all UI notifications and popups.
 * Respects user preferences set in the Developer Options.
 */
export class NotificationService {
	constructor(private getSettings: () => Record<string, unknown>) {}

	/**
	 * Show a notification if the corresponding toggle is enabled.
	 * Errors and critical warnings are always shown regardless of toggles.
	 */
	public notify(
		message: string,
		type: NotificationType = NotificationType.UTILITY,
		duration: number = 2000
	): void {
		const settings = this.getSettings();
		let show = false;

		switch (type) {
			case NotificationType.SHARED:
				show = settings[SHOW_SHARED_NOTIFICATIONS_KEY] === true; // Default OFF
				break;
			case NotificationType.PRESET:
				show = settings[SHOW_PRESET_NOTIFICATIONS_KEY] !== false; // Default ON
				break;
			case NotificationType.ISOLATE:
				show = settings[SHOW_ISOLATE_NOTIFICATIONS_KEY] !== false; // Default ON
				break;
			case NotificationType.SNIPPET:
				show = settings[SHOW_SNIPPET_NOTIFICATIONS_KEY] !== false; // Default ON
				break;
			case NotificationType.UTILITY:
				show = settings[SHOW_UTILITY_NOTIFICATIONS_KEY] !== false; // Default ON
				break;
			case NotificationType.ERROR:
				show = true; // Always show errors
				break;
		}

		if (show) {
			new Notice(message, duration);
		}
	}

	// Sugar methods for easier usage
	public shared(msg: string): void {
		this.notify(msg, NotificationType.SHARED);
	}
	public preset(msg: string): void {
		this.notify(msg, NotificationType.PRESET);
	}
	public isolate(msg: string): void {
		this.notify(msg, NotificationType.ISOLATE);
	}
	public snippet(msg: string): void {
		this.notify(msg, NotificationType.SNIPPET);
	}
	public util(msg: string): void {
		this.notify(msg, NotificationType.UTILITY);
	}
	public error(msg: string, duration: number = 10000): void {
		this.notify(msg, NotificationType.ERROR, duration);
	}
}

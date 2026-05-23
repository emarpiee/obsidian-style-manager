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
import { Notice } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	SHOW_PRESET_NOTIFICATIONS_KEY,
	SHOW_SHARED_NOTIFICATIONS_KEY,
} from '../constants';

import { NotificationService } from '../application/NotificationService';

describe('NotificationService', () => {
	let service: NotificationService;
	let mockSettings: Record<string, any>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockSettings = {};
		service = new NotificationService(() => mockSettings);
	});

	it('should show notification when enabled', () => {
		mockSettings[SHOW_SHARED_NOTIFICATIONS_KEY] = true;
		service.shared('test shared');
		expect(Notice).toHaveBeenCalledWith('test shared', expect.any(Number));
	});

	it('should hide notification when disabled', () => {
		mockSettings[SHOW_SHARED_NOTIFICATIONS_KEY] = false;
		service.shared('test shared');
		expect(Notice).not.toHaveBeenCalled();
	});

	it('should show errors regardless of settings', () => {
		mockSettings[SHOW_SHARED_NOTIFICATIONS_KEY] = false;
		service.error('critical error');
		expect(Notice).toHaveBeenCalledWith('critical error', expect.any(Number));
	});

	it('should respect multiple category toggles', () => {
		mockSettings[SHOW_SHARED_NOTIFICATIONS_KEY] = false;
		mockSettings[SHOW_PRESET_NOTIFICATIONS_KEY] = true;

		service.shared('shared msg');
		expect(Notice).not.toHaveBeenCalled();

		service.preset('preset msg');
		expect(Notice).toHaveBeenCalledWith('preset msg', expect.any(Number));
	});

	it('should show utility notifications', () => {
		service.util('utility msg');
		expect(Notice).toHaveBeenCalledWith('utility msg', expect.any(Number));
	});
});

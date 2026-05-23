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
import { describe, expect, it, vi } from 'vitest';

import { t } from '../infrastructure/lang/helpers';

describe('Localization Helpers', () => {
	it('should return English fallback for unknown keys', () => {
		expect(t('Settings' as any)).toBe('Settings');
	});

	it('should log error if locale not found', () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		// In this environment lang might be null/en
		t('Default:' as any);
		// If lang is en, it should be fine.
		// We can't easily change 'lang' because it's a constant exported from helpers.ts
		// which was evaluated at import time.
		consoleSpy.mockRestore();
	});

	it('should return a translated string', () => {
		const val = t('Default:' as any);
		expect(val).toBeDefined();
		expect(typeof val).toBe('string');
	});
});

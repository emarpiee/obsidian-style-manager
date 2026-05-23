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
import { describe, expect, it } from 'vitest';

import {
	DataUtils,
	formatPresetDate,
	generateUuid,
	getDescription,
	getFormattedTimestamp,
	getTitle,
	isValidDefaultColor,
	matchesFilter,
	sanitizeText,
} from '../utils/CommonUtils';

// Mock moment in global window object
(globalThis as any).window = {
	moment: (arg?: any) => ({
		format: (f: string) => {
			if (f === 'YYYYMMDDHHmmss') return '20231027120000';
			if (f === 'MMM. DD, YYYY') return arg ? 'Oct. 27, 2023' : 'Current Date';
			return f;
		},
	}),
};

describe('Utils', () => {
	describe('getFormattedTimestamp', () => {
		it('should return an empty string if format is empty', () => {
			expect(getFormattedTimestamp('')).toBe('');
		});

		it('should return a formatted timestamp', () => {
			expect(getFormattedTimestamp('YYYYMMDDHHmmss')).toBe('20231027120000');
		});
	});

	describe('formatPresetDate', () => {
		it('should format a given timestamp', () => {
			const timestamp = 1698408000000; // Oct 27, 2023
			expect(formatPresetDate(timestamp)).toBe('Oct. 27, 2023');
		});
	});

	describe('Metadata Helpers', () => {
		it('should return title', () => {
			expect(getTitle({ title: 'Test' } as any)).toBe('Test');
		});

		it('should return description', () => {
			expect(getDescription({ description: 'Desc' } as any)).toBe('Desc');
		});
	});

	describe('Validation & Sanitization', () => {
		it('should validate colors', () => {
			expect(isValidDefaultColor('#fff')).toBe(true);
			expect(isValidDefaultColor('rgb(0,0,0)')).toBe(true);
			expect(isValidDefaultColor('hsl(0,0,0)')).toBe(true);
			expect(isValidDefaultColor('var(--test)')).toBe(true);
			expect(isValidDefaultColor('transparent')).toBe(true);
			expect(isValidDefaultColor('red')).toBe(false);
		});

		it('should sanitize text', () => {
			expect(sanitizeText('test;')).toBe('test');
			expect(sanitizeText('<script>')).toBe('script');
			expect(sanitizeText('')).toBe('""');
		});
	});

	describe('Filtering', () => {
		it('should match filter', () => {
			expect(matchesFilter('test', 'This is a test')).toBe(true);
			expect(matchesFilter('missing', 'This is a test')).toBe(false);
			expect(matchesFilter('', 'Any')).toBe(true);
		});
	});

	describe('UUID Generation', () => {
		it('should generate a UUID', () => {
			const uuid = generateUuid();
			expect(uuid).toBeDefined();
			expect(typeof uuid).toBe('string');
		});
	});

	describe('DataUtils', () => {
		it('should canonicalize objects by sorting keys', () => {
			const input = { b: 2, a: 1, c: { y: 2, x: 1 } };
			const canonical = DataUtils.canonicalize(input);

			expect(Object.keys(canonical)).toEqual(['a', 'b', 'c']);
			expect(Object.keys((canonical as any).c)).toEqual(['x', 'y']);
		});

		it('should generate stable canonical strings', () => {
			const obj1 = { a: 1, b: 2 };
			const obj2 = { b: 2, a: 1 };
			expect(DataUtils.getCanonicalString(obj1)).toBe(
				DataUtils.getCanonicalString(obj2)
			);
		});
	});
});

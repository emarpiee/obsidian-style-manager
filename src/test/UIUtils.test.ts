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

import {
	copyToClipboard,
	createDescription,
	getPickrSettings,
	onPickrCancel,
	resolveDefaultColor,
} from '../utils/UIUtils';

describe('UIUtils', () => {
	describe('resolveDefaultColor', () => {
		it('should return original color if not a CSS variable', () => {
			expect(resolveDefaultColor('#ffffff')).toBe('#ffffff');
		});

		it('should resolve CSS variable from document body', () => {
			// Mock getComputedStyle
			const spy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
				getPropertyValue: (prop: string) => {
					if (prop === '--test-color') return ' #ff0000 ';
					return '';
				},
			} as any);

			expect(resolveDefaultColor('var(--test-color)')).toBe('#ff0000');
			spy.mockRestore();
		});

		it('should return original if variable not found', () => {
			const spy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
				getPropertyValue: () => '',
			} as any);

			expect(resolveDefaultColor('var(--missing)')).toBe('var(--missing)');
			spy.mockRestore();
		});
	});

	describe('createDescription', () => {
		it('should create fragment with description and default value', () => {
			const frag = createDescription('My Description', 'def-val');
			expect(frag.textContent).toContain('My Description');
			expect(frag.textContent).toContain('Default:');
			expect(frag.textContent).toContain('def-val');
		});

		it('should use default label if provided', () => {
			const frag = createDescription('Desc', 'def', 'Label');
			expect(frag.textContent).toContain('Label');
			expect(frag.textContent).not.toContain('def');
		});
	});

	describe('getPickrSettings', () => {
		it('should return valid pickr options', () => {
			const el = document.createElement('div');
			const containerEl = document.createElement('div');
			const settings = getPickrSettings({
				el,
				isView: false,
				containerEl,
				swatches: ['#fff'],
				opacity: true,
				defaultColor: '#000',
			});

			expect(settings.el).toBe(el);
			expect(settings.container).toBe(containerEl);
			expect(settings.default).toBe('#000');
			expect(settings.components?.opacity).toBe(true);
		});

		it('should use document.body as container if isView is true', () => {
			const el = document.createElement('div');
			const settings = getPickrSettings({
				el,
				isView: true,
				containerEl: document.createElement('div'),
				swatches: [],
				opacity: false,
				defaultColor: '#fff',
			});

			expect(settings.container).toBe(document.body);
		});
	});

	describe('onPickrCancel', () => {
		it('should hide the pickr instance', () => {
			const mockPickr = { hide: vi.fn() };
			onPickrCancel(mockPickr as any);
			expect(mockPickr.hide).toHaveBeenCalled();
		});
	});

	describe('copyToClipboard', () => {
		it('should copy text using navigator.clipboard', async () => {
			const mockWriteText = vi.fn().mockResolvedValue(undefined);
			Object.assign(navigator, {
				clipboard: { writeText: mockWriteText },
			});

			await copyToClipboard('test text');
			expect(mockWriteText).toHaveBeenCalledWith('test text');
		});

		it('should fallback to textarea if navigator.clipboard fails', async () => {
			Object.assign(navigator, {
				clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) },
			});

			const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true);

			await copyToClipboard('fallback text');
			expect(execSpy).toHaveBeenCalledWith('copy');
		});
	});
});

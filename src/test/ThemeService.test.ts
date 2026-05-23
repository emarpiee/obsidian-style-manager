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
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APPEARANCE_KEY, THEME_KEY } from '../constants';

import { ThemeService } from '../application/ThemeService';

describe('ThemeService', () => {
	let service: ThemeService;
	let mockDeps: any;

	beforeEach(() => {
		mockDeps = {
			bridge: {
				getActiveTheme: vi.fn(),
				getActiveAppearance: vi.fn(),
				getNativeConfig: vi.fn(),
				setNativeConfig: vi.fn(),
				setNativeTheme: vi.fn(),
				getThemePath: vi.fn(),
				triggerEvent: vi.fn(),
				readNativeFile: vi.fn(),
			},
			isIsolateMode: vi.fn().mockReturnValue(false),
			getSetting: vi.fn(),
			setSetting: vi.fn(),
			notifications: { error: vi.fn() },
		};
		service = new ThemeService(mockDeps);

		// Reset document body classes
		document.body.className = '';
	});

	describe('adoptNativeSettings', () => {
		it('should NOT adopt settings in Isolate Mode', () => {
			mockDeps.isIsolateMode.mockReturnValue(true);
			const result = service.adoptNativeSettings(
				() => 'our-theme',
				() => {}
			);
			expect(result).toBe(false);
		});

		it('should adopt native theme if different from our theme', () => {
			mockDeps.bridge.getActiveTheme.mockReturnValue('native-theme');
			const setter = vi.fn();
			const result = service.adoptNativeSettings(() => 'old-theme', setter);

			expect(result).toBe(true);
			expect(setter).toHaveBeenCalledWith(THEME_KEY, 'native-theme');
		});

		it('should TRIGGER Blank-Native Guard: do NOT adopt default when we have a stored preference', () => {
			// Native returns '' (which becomes 'default') because Style Manager cleared it.
			mockDeps.bridge.getActiveTheme.mockReturnValue('');
			mockDeps.bridge.getActiveAppearance.mockReturnValue('dark');
			const ourTheme = 'my-stored-theme';

			const setter = vi.fn();
			const result = service.adoptNativeSettings((k: string) => {
				if (k === THEME_KEY) return ourTheme;
				if (k === APPEARANCE_KEY) return 'dark';
				return null;
			}, setter);

			expect(result).toBe(false); // NO adoption happened
			expect(setter).not.toHaveBeenCalled();
		});

		it('should adopt appearance mismatch', () => {
			mockDeps.bridge.getActiveAppearance.mockReturnValue('light');
			const setter = vi.fn();
			const result = service.adoptNativeSettings(
				(k: string) => (k === APPEARANCE_KEY ? 'dark' : null),
				setter
			);

			expect(result).toBe(true);
			expect(setter).toHaveBeenCalledWith(APPEARANCE_KEY, 'light');
		});
	});

	describe('Visual Application', () => {
		it('should apply appearance by updating body classes', () => {
			service.applyAppearance('dark');
			expect(document.body.classList.contains('theme-dark')).toBe(true);
			expect(document.body.classList.contains('theme-light')).toBe(false);

			service.applyAppearance('light');
			expect(document.body.classList.contains('theme-light')).toBe(true);
			expect(document.body.classList.contains('theme-dark')).toBe(false);
		});

		it('should calculate accent color variables', () => {
			service.applyAccentColor('#ff0000'); // Red
			expect(document.body.style.getPropertyValue('--accent-color')).toBe(
				'#ff0000'
			);
			// Check HSL (Roughly 0, 100, 50)
			expect(document.body.style.getPropertyValue('--accent-h')).toBe('0');
			expect(document.body.style.getPropertyValue('--accent-s')).toBe('100%');
		});
	});

	describe('applyTheme', () => {
		it('should inject session-only style tag and NOT write to config when persist=false', async () => {
			mockDeps.bridge.getThemePath.mockReturnValue(
				'.obsidian/themes/my-theme.css'
			);
			mockDeps.bridge.readNativeFile.mockResolvedValue(
				'.my-theme { color: red; }'
			);

			await service.applyTheme('my-theme', false);

			const styleTag = document.getElementById('style-manager-session-theme');
			expect(styleTag).toBeDefined();
			expect(styleTag!.textContent).toBe('.my-theme { color: red; }');
			expect(mockDeps.bridge.setNativeConfig).not.toHaveBeenCalledWith(
				'cssTheme',
				expect.any(String)
			);
		});

		it('should write to config when persist=true', async () => {
			mockDeps.bridge.readNativeFile.mockResolvedValue('');
			await service.applyTheme('new-persistent-theme', true);
			expect(mockDeps.bridge.setNativeConfig).toHaveBeenCalledWith(
				'cssTheme',
				'new-persistent-theme'
			);
		});
	});

	describe('BodyGuard', () => {
		it('should strip rogue theme classes in Isolate Mode', async () => {
			mockDeps.isIsolateMode.mockReturnValue(true);
			service.startBodyGuard();

			document.body.classList.add('theme-some-other-theme');

			// Wait for MutationObserver (async)
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(document.body.classList.contains('theme-some-other-theme')).toBe(
				false
			);
			expect(document.body.classList.contains('theme-light')).toBe(false); // Should preserve light/dark if they were there, but we didn't add them

			service.stopBodyGuard();
		});
	});
});

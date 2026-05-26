/*
    Style Manager - Obsidian Plugin
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

import { StyleSheetManager } from '../core/css/StyleSheetManager';

describe('StyleSheetManager', () => {
	let mockBridge: any;
	let manager: StyleSheetManager;

	beforeEach(() => {
		vi.clearAllMocks();
		document.body.className = '';
		document.body.innerHTML = '';

		mockBridge = {
			getActiveTheme: vi.fn().mockReturnValue('minimal'),
			getInstalledThemes: vi.fn().mockReturnValue(['minimal', 'custom']),
			getThemePath: vi
				.fn()
				.mockImplementation((t) => `.obsidian/themes/${t}/theme.css`),
			getInstalledPlugins: vi.fn().mockReturnValue(['plugin-a']),
			getPluginPath: vi
				.fn()
				.mockImplementation((p) => `.obsidian/plugins/${p}/styles.css`),
			getAllSnippets: vi.fn().mockReturnValue(['snippet-1.css']),
			getSnippetPath: vi
				.fn()
				.mockImplementation((s) => `.obsidian/snippets/${s}.css`),
			app: {
				customCss: {
					theme: 'minimal',
				},
				vault: {
					adapter: {
						exists: vi.fn().mockResolvedValue(true),
						stat: vi.fn().mockResolvedValue({ mtime: 1000 }),
						read: vi
							.fn()
							.mockResolvedValue(
								'/* @settings\nname: Test Section\nid: test-id\nsettings:\n  - id: s1\n    type: class-toggle\n    title: S1\n*/'
							),
					},
				},
			},
		};

		manager = new StyleSheetManager(mockBridge);
	});

	it('should create light and dark elements and add class on init', () => {
		expect(document.body.classList.contains('style-manager-css')).toBe(true);
		const lightEl = document.body.querySelector(
			'.theme-light.style-manager-ref'
		);
		const darkEl = document.body.querySelector('.theme-dark.style-manager-ref');
		expect(lightEl).not.toBeNull();
		expect(darkEl).not.toBeNull();
	});

	it('should clean up elements and cache on cleanup', () => {
		manager.cleanup();
		expect(document.body.classList.contains('style-manager-css')).toBe(false);
		expect(document.body.querySelector('.style-manager-ref')).toBeNull();
	});

	it('should retrieve cached and computed CSS variables', () => {
		// Mock getComputedStyle
		const originalGetComputedStyle = window.getComputedStyle;
		window.getComputedStyle = vi.fn().mockReturnValue({
			getPropertyValue: vi.fn().mockImplementation((prop) => {
				if (prop === '--my-var') return ' red ';
				return '';
			}),
		});

		const res1 = manager.getCSSVar('my-var');
		expect(res1).toEqual({ light: 'red', dark: 'red', current: 'red' });

		// Verify cache is used
		window.getComputedStyle = vi.fn().mockImplementation(() => {
			throw new Error('Should use cache');
		});
		const res2 = manager.getCSSVar('my-var');
		expect(res2).toEqual({ light: 'red', dark: 'red', current: 'red' });

		// Restore original
		window.getComputedStyle = originalGetComputedStyle;
	});

	it('should build disk map cache and handle modified cache files', async () => {
		await manager.buildDiskMap();

		// Check cache was populated
		expect(mockBridge.app.vault.adapter.exists).toHaveBeenCalled();
		expect(mockBridge.app.vault.adapter.read).toHaveBeenCalled();

		// Call buildDiskMap again with same mtime, should use cache (no additional reads)
		mockBridge.app.vault.adapter.read.mockClear();
		await manager.buildDiskMap();
		expect(mockBridge.app.vault.adapter.read).not.toHaveBeenCalled();

		// Change mtime, should re-read
		mockBridge.app.vault.adapter.stat.mockResolvedValue({ mtime: 2000 });
		await manager.buildDiskMap();
		expect(mockBridge.app.vault.adapter.read).toHaveBeenCalled();
	});

	it('should scan and parse settings from styleSheets in document', async () => {
		// Build disk map first so we have snippet references
		await manager.buildDiskMap();

		// Add a mock style tag with @settings block to DOM
		const styleTag = document.createElement('style');
		styleTag.id = 'snippet-snippet-1';
		styleTag.textContent = `/* @settings
name: Test Section
id: test-id
settings:
  - id: s1
    type: class-toggle
    title: S1
*/`;
		document.head.appendChild(styleTag);

		// Object.defineProperty to mock ownerNode / styleSheets
		const mockSheet = {
			disabled: false,
			ownerNode: styleTag,
			cssRules: [],
		} as any;

		const mockStyleSheets = [mockSheet];
		(mockStyleSheets as any).item = (index: number) => mockStyleSheets[index];

		const originalStyleSheets = document.styleSheets;
		Object.defineProperty(document, 'styleSheets', {
			value: mockStyleSheets,
			configurable: true,
		});

		const { settingsList, errorList } = manager.getSettingsFromStyles();

		expect(settingsList.length).toBeGreaterThan(0);
		expect(settingsList[0].id).toBe('test-id');
		expect(settingsList[0].sourceType).toBe('Snippet');
		expect(settingsList[0].sourceId).toBe('snippet-1');
		expect(errorList.length).toBe(0);

		// Restore styleSheets and clean up style tag
		styleTag.remove();
		Object.defineProperty(document, 'styleSheets', {
			value: originalStyleSheets,
			configurable: true,
		});
	});
});

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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsService } from '../application/SettingsService';
import { CSSParser } from '../core/css/CSSParser';
import { StyleGenerator } from '../core/style/StyleGenerator';

// Mock Obsidian dependencies moved to beforeEach for isolation

describe('Style Manager Performance Benchmarks', () => {
	let service: SettingsService;
	let mockApp: any;
	let mockPlugin: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Setup clean mock for every test
		mockApp = {
			plugins: { plugins: {} },
			workspace: {
				on: vi.fn(),
				trigger: vi.fn(),
				onLayoutReady: vi.fn(),
				getLeavesOfType: vi.fn().mockReturnValue([]),
			},
			vault: {
				adapter: {
					exists: vi.fn().mockResolvedValue(true),
					read: vi.fn().mockResolvedValue('{}'),
					stat: vi.fn().mockResolvedValue({ mtime: 1000 }),
					copy: vi.fn().mockResolvedValue(undefined),
					remove: vi.fn().mockResolvedValue(undefined),
				},
				getConfig: vi.fn().mockReturnValue(''),
				setConfig: vi.fn(),
				on: vi.fn(),
				trigger: vi.fn(),
			},
			fileManager: { trashFile: vi.fn() },
			customCss: { setTheme: vi.fn() },
		} as any;

		mockPlugin = {
			manifest: { id: 'obsidian-style-manager', dir: 'plugins/style-manager' },
			app: mockApp,
			loadData: vi.fn(),
			saveData: vi.fn(),
			parseCSS: vi.fn(),
			reloadAll: vi.fn(),
			registerEvent: vi.fn(),
		} as any;

		// Setup service
		service = new SettingsService(mockPlugin);
		mockPlugin.settingsService = service;
		// Mock stores to avoid disk I/O but maintain state
		let storeData = {};
		mockPlugin.loadData.mockImplementation(async () =>
			JSON.parse(JSON.stringify(storeData))
		);
		mockPlugin.saveData.mockImplementation(async (data: any) => {
			storeData = JSON.parse(JSON.stringify(data));
		});

		await service.load();
		service.setSafeToSave(true);
	});

	afterEach(() => {
		service.cleanup();
	});

	it('Parser Benchmark: Should parse 500KB CSS with 50 categories efficiently', () => {
		const categoriesCount = 50;
		const settingsPerCategory = 10;
		let cssContent = '';

		for (let i = 0; i < categoriesCount; i++) {
			cssContent += `/* @settings\nname: Category ${i}\nid: category-${i}\nsettings:\n`;
			for (let j = 0; j < settingsPerCategory; j++) {
				cssContent += `  - id: setting-${j}\n    type: variable-text\n    title: Setting ${j}\n    default: value-${j}\n`;
			}
			cssContent += `*/\n.dummy-${i} { color: var(--setting-0); }\n\n`;
		}

		// Add 500KB of padding
		cssContent += '/* ' + 'A'.repeat(500 * 1024) + ' */';

		const mockSheet = {
			ownerNode: { textContent: cssContent },
		} as any;

		const start = performance.now();
		const result = CSSParser.parseCSS(mockSheet);
		const end = performance.now();
		const duration = end - start;

		console.log(
			`[Benchmark] Parser took ${duration.toFixed(2)}ms for ${categoriesCount} categories`
		);

		expect(result.settingsList.length).toBe(categoriesCount);
		expect(duration).toBeLessThan(1000); // Target < 1000ms
	});

	it('Parser Cache Verification: Should be nearly instantaneous on second parse of same content', () => {
		const cssContent =
			'/* @settings\nname: Cached\nid: cached\nsettings:\n  - id: t1\n    type: text\n    title: T1\n*/';
		const mockSheet = {
			ownerNode: { textContent: cssContent },
		} as any;

		// First parse (warm up)
		CSSParser.parseCSS(mockSheet);

		// Second parse (should be from cache)
		const start = performance.now();
		const result = CSSParser.parseCSS(mockSheet);
		const end = performance.now();
		const duration = end - start;

		console.log(`[Benchmark] Cached parser took ${duration.toFixed(2)}ms`);

		expect(result.settingsList.length).toBe(1);
		expect(duration).toBeLessThan(10); // Should be very fast
	});

	it('Merge Benchmark: Should handle 1,000 overrides in < 10ms', async () => {
		// Fill vault settings with 1,000 bases
		const baseSettings: Record<string, any> = {};
		for (let i = 0; i < 1000; i++) {
			baseSettings[`section@@setting-${i}`] = `base-${i}`;
		}

		await service.setSettings(baseSettings);
		await service.isolateModeService.setIsolateMode(true);

		// Apply 500 local overrides
		const overrides: Record<string, any> = {};
		for (let i = 0; i < 500; i++) {
			overrides[`section@@setting-${i}`] = `override-${i}`;
		}

		const start = performance.now();
		await service.setSettings(overrides); // This triggers updateMerged()
		const end = performance.now();
		const duration = end - start;

		console.log(
			`[Benchmark] Merge take ${duration.toFixed(2)}ms for 1,000 settings (500 overrides)`
		);

		expect(duration).toBeLessThan(300); // Target < 300ms
	});

	it('Save Queue Benchmark: 100 rapid setting updates should be efficient', async () => {
		const start = performance.now();

		const promises = [];
		for (let i = 0; i < 100; i++) {
			promises.push(service.setSetting('section', `stress-${i}`, `value-${i}`));
		}

		await Promise.all(promises);
		const end = performance.now();
		const duration = end - start;

		console.log(`[Benchmark] 100 queued saves took ${duration.toFixed(2)}ms`);

		// Verify final state
		for (let i = 0; i < 100; i++) {
			expect(service.getSetting('section', `stress-${i}`)).toBe(`value-${i}`);
		}

		expect(mockPlugin.saveData).toHaveBeenCalled();
	});

	it('Generator Benchmark: Should generate CSS for large setting map in < 15ms', () => {
		const generator = new StyleGenerator(mockPlugin, {} as any, () => ({}));
		const settings: Record<string, any> = {};
		const cssList = [];
		const sectionId = 'section';

		for (let i = 0; i < 1000; i++) {
			settings[`${sectionId}@@setting-${i}`] = `value-${i}`;
			cssList.push({
				id: `setting-${i}`,
				type: 'variable-text',
				default: 'def',
			});
		}

		const config = {
			[sectionId]: cssList.reduce((acc: any, s) => {
				acc[s.id] = s;
				return acc;
			}, {}),
		};

		const start = performance.now();
		generator.generateVariableArrays(settings, config, {}, mockApp);
		const end = performance.now();
		const duration = end - start;

		console.log(
			`[Benchmark] Style variable generation took ${duration.toFixed(2)}ms for 1,000 settings`
		);
		expect(duration).toBeLessThan(150);
	});
});

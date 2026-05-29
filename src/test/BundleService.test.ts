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

import { SNIPPETS_KEY, THEME_KEY } from '../constants';

import { BundleService } from '../application/BundleService';

// Mock JSZip
vi.mock('jszip', () => {
	const mockZip = {
		file: vi.fn().mockReturnThis(),
		folder: vi.fn().mockReturnThis(),
		generateAsync: vi.fn().mockResolvedValue(new Uint8Array(8)),
		loadAsync: vi.fn().mockResolvedValue({
			files: {
				'preset.json': { name: 'preset.json' },
			},
			file: vi.fn().mockImplementation((name) => {
				if (name === 'preset.json' || name === 'presets.json') {
					return {
						async: () =>
							Promise.resolve(JSON.stringify({ name: 'Test', data: {} })),
					};
				}
				return null;
			}),
			folder: vi.fn().mockImplementation((name) => {
				if (name === 'snippets') {
					return {
						filter: (): any[] => [
							{
								name: 'snippets/test.css',
								async: () => Promise.resolve('content'),
							},
						],
					};
				}
				if (name === 'themes') {
					return {
						forEach: (callback: any) => {
							callback('test-theme/theme.css');
							callback('test-theme/manifest.json');
						},
						file: vi.fn().mockImplementation((subname) => {
							if (subname === 'test-theme/theme.css') {
								return {
									async: () => Promise.resolve('theme-css-content'),
								};
							}
							if (subname === 'test-theme/manifest.json') {
								return {
									async: () => Promise.resolve('{"name": "test-theme"}'),
								};
							}
							return null;
						}),
					};
				}
				if (name === 'presets') return null;
				return {
					filter: (): any[] => [],
				};
			}),
		}),
	};
	const JSZipMock = function () {
		return mockZip;
	};
	(JSZipMock as any).loadAsync = mockZip.loadAsync;
	return { default: JSZipMock };
});

describe('BundleService', () => {
	let service: BundleService;
	let mockBridge: any;

	beforeEach(() => {
		mockBridge = {
			readSnippet: vi.fn().mockResolvedValue('snippet-css-content'),
			readThemeCss: vi.fn().mockResolvedValue('theme-css-content'),
			readThemeManifest: vi.fn().mockResolvedValue('{"name": "test-theme"}'),
		};
		service = new BundleService(mockBridge);
	});

	it('should bundle preset, snippets, and themes into a ZIP', async () => {
		const preset = {
			name: 'My Bundle',
			data: {
				[SNIPPETS_KEY]: ['snippet-1'],
				[THEME_KEY]: 'test-theme',
			},
		} as any;

		const data = await service.createBundle(preset);
		expect(data).toBeInstanceOf(Uint8Array);
		expect(mockBridge.readSnippet).toHaveBeenCalledWith('snippet-1');
		expect(mockBridge.readThemeCss).toHaveBeenCalledWith('test-theme');
		expect(mockBridge.readThemeManifest).toHaveBeenCalledWith('test-theme');
	});

	it('should extract preset, snippets, and themes from a ZIP buffer', async () => {
		const result = await service.extractBundle(new ArrayBuffer(0));

		expect(result.presets[0].name).toBe('Test');
		expect(result.snippets).toHaveLength(1);
		expect(result.snippets[0].name).toBe('test');
		expect(result.snippets[0].content).toBe('content');

		expect(result.themes).toHaveLength(1);
		expect(result.themes![0].name).toBe('test-theme');
		expect(result.themes![0].files).toHaveLength(2);
		expect(result.themes![0].files[0].filename).toBe('theme.css');
		expect(result.themes![0].files[0].content).toBe('theme-css-content');
		expect(result.themes![0].files[1].filename).toBe('manifest.json');
		expect(result.themes![0].files[1].content).toBe('{"name": "test-theme"}');
	});
});


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

import { SNIPPETS_KEY } from '../constants';

import { PresetImportService } from '../application/PresetImportService';

// Mock crypto for ID generation
if (typeof (global as any).crypto === 'undefined') {
	(global as any).crypto = {
		randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(7),
	};
}

// Mock JSZip
vi.mock('jszip', () => {
	return {
		default: {
			loadAsync: vi.fn().mockResolvedValue({
				file: vi.fn().mockImplementation((key) => {
					if (key instanceof RegExp) return [];
					return null;
				}),
			}),
		},
	};
});

describe('PresetImportService', () => {
	let service: PresetImportService;
	let mockPlugin: any;

	beforeEach(() => {
		mockPlugin = {
			bundleService: {
				extractBundle: vi.fn().mockResolvedValue({
					presets: [{ name: 'Bundle Preset', data: {} }],
					snippets: [{ name: 'bundle-snippet', content: 'body{}' }],
				}),
			},
			presetService: {
				presets: [],
				savePresets: vi.fn().mockResolvedValue(undefined),
			},
			settingsService: {
				bridge: {
					snippetExists: vi.fn().mockResolvedValue(false),
					writeSnippet: vi.fn().mockResolvedValue(undefined),
					forceLoadSnippets: vi.fn().mockResolvedValue(undefined),
				},
			},
		};
		service = new PresetImportService(mockPlugin as any);
	});

	it('should analyze JSON preset imports', async () => {
		const items = [
			{
				content: JSON.stringify({ name: 'Single Preset', data: {} }),
				name: 'test.json',
			},
		];

		const analysis = await service.analyzePresetImports(items);

		expect(analysis.presets).toHaveLength(1);
		expect(analysis.presets[0].name).toBe('Single Preset');
	});

	it('should detect snippet conflicts during analysis', async () => {
		mockPlugin.bundleService.extractBundle.mockResolvedValueOnce({
			presets: [],
			snippets: [{ name: 'conflict', content: '' }],
		});
		mockPlugin.settingsService.bridge.snippetExists.mockResolvedValueOnce(true);

		const items = [{ content: new ArrayBuffer(0), name: 'bundle.zip' }];
		const analysis = await service.analyzePresetImports(items);

		expect(analysis.conflicts).toContain('conflict');
	});

	it('should execute import and handle snippet renaming', async () => {
		const analysis = {
			presets: [
				{ id: '1', name: 'P1', data: { [SNIPPETS_KEY]: ['old-name'] } },
			],
			snippets: [{ name: 'old-name', content: 'content' }],
			conflicts: ['old-name'],
		} as any;

		const resolutions = [
			{ name: 'old-name', action: 'rename' as const, newName: 'new-name' },
		];

		await service.executePresetImport(analysis, resolutions);

		expect(mockPlugin.settingsService.bridge.writeSnippet).toHaveBeenCalledWith(
			'new-name',
			'content'
		);
		expect(analysis.presets[0].data[SNIPPETS_KEY]).toContain('new-name');
		expect(mockPlugin.presetService.presets).toHaveLength(1);
		expect(mockPlugin.presetService.savePresets).toHaveBeenCalled();
	});
});

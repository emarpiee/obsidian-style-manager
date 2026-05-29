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

import { THEME_KEY } from '../constants';

import { BackupService } from '../application/BackupService';

// Mock JSZip
vi.mock('jszip', () => {
	const mockZip = {
		file: vi.fn().mockReturnThis(),
		folder: vi.fn().mockReturnThis(),
		generateAsync: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
		loadAsync: vi.fn().mockResolvedValue({
			file: vi.fn().mockImplementation((name) => {
				if (name instanceof RegExp) {
					if (name.test('shared_locker_state.json')) {
						return [
							{
								name: 'shared_locker_state.json',
								async: () =>
									Promise.resolve(
										JSON.stringify({ [THEME_KEY]: 'restored-theme' })
									),
							},
						];
					}
					return [];
				}
				if (name === 'shared_locker_manifest.json')
					return {
						async: () =>
							Promise.resolve(
								JSON.stringify({ type: 'style-manager-vault-backup' })
							),
					};
				if (typeof name === 'string' && name.match(/shared_locker_state/))
					return {
						async: () =>
							Promise.resolve(
								JSON.stringify({ [THEME_KEY]: 'restored-theme' })
							),
					};
				return null;
			}),
			folder: vi.fn().mockImplementation((name) => {
				if (name === 'snippets') return { filter: (): any[] => [] };
				if (name === 'presets') return null;
				if (name === 'themes') {
					return {
						forEach: (cb: (path: string) => void) => {
							cb('Minimal/theme.css');
							cb('Minimal/manifest.json');
						},
						file: vi.fn().mockImplementation((sub: string) => {
							if (sub === 'Minimal/theme.css')
								return { async: () => Promise.resolve('theme-css') };
							if (sub === 'Minimal/manifest.json')
								return { async: () => Promise.resolve('{"name":"Minimal"}') };
							return null;
						}),
					};
				}
				return null;
			}),
		}),
	};
	const JSZipMock = function () {
		return mockZip;
	};
	(JSZipMock as any).loadAsync = mockZip.loadAsync;
	return { default: JSZipMock };
});

describe('BackupService', () => {
	let service: BackupService;
	let mockPlugin: any;

	beforeEach(() => {
		mockPlugin = {
			app: {
				vault: {
					adapter: {
						exists: vi.fn().mockResolvedValue(true),
						read: vi.fn().mockResolvedValue('snippet content'),
					},
				},
				customCss: {
					snippets: ['s1'],
					getSnippetPath: (id: string) => `.obsidian/snippets/${id}.css`,
				},
			},
			manifest: { version: '1.0.0' },
			settingsService: {
				settings: {},
				sharedSettings: { [THEME_KEY]: 'current-theme' },
				deviceName: 'Test Device',
				notifications: { util: vi.fn(), shared: vi.fn() },
				persistenceService: {
					enqueue: vi.fn().mockImplementation((task) => task()),
					options: {
						sharedStateService: { generateNextVersion: () => 123 },
					},
				},
				sharedStore: { createBackup: vi.fn().mockResolvedValue(true) },
				onDataLoaded: vi.fn().mockResolvedValue(undefined),
				save: vi.fn().mockResolvedValue(undefined),
				refreshService: { trigger: vi.fn().mockResolvedValue(undefined) },
				bridge: {
					writeSnippet: vi.fn().mockResolvedValue(undefined),
					forceLoadSnippets: vi.fn().mockResolvedValue(undefined),
					writeThemeFile: vi.fn().mockResolvedValue(undefined),
					requestLoadTheme: vi.fn(),
					getInstalledThemes: vi.fn().mockReturnValue(['Minimal']),
					readThemeCss: vi.fn().mockResolvedValue('theme-css-content'),
					readThemeManifest: vi.fn().mockResolvedValue('{"name":"Minimal"}'),
				},
			},
		};
		// Link sharedStore to settingsService
		(mockPlugin.settingsService as any).sharedStore =
			mockPlugin.settingsService.sharedStore;

		service = new BackupService(mockPlugin as any);
	});

	it('should create a safety snapshot', async () => {
		const result = await service.createSnapshot();
		expect(result).toBe(true);
		expect(
			mockPlugin.settingsService.sharedStore.createBackup
		).toHaveBeenCalled();
		expect(mockPlugin.settingsService.notifications.util).toHaveBeenCalledWith(
			expect.stringContaining('Safety snapshot created')
		);
	});

	it('should create a universal backup ZIP including themes', async () => {
		const data = await service.createUniversalBackup();
		expect(data).toBeInstanceOf(Uint8Array);
		expect(data).toEqual(new Uint8Array([1, 2, 3]));
		expect(mockPlugin.settingsService.bridge.getInstalledThemes).toHaveBeenCalled();
		expect(mockPlugin.settingsService.bridge.readThemeCss).toHaveBeenCalledWith('Minimal');
		expect(mockPlugin.settingsService.bridge.readThemeManifest).toHaveBeenCalledWith('Minimal');
	});

	it('should restore themes from a valid ZIP backup', async () => {
		const result = await service.restoreBackup(new ArrayBuffer(0));
		expect(result).toBe(true);
		expect(mockPlugin.settingsService.bridge.writeThemeFile).toHaveBeenCalledWith(
			'Minimal',
			'theme.css',
			'theme-css'
		);
		expect(mockPlugin.settingsService.bridge.writeThemeFile).toHaveBeenCalledWith(
			'Minimal',
			'manifest.json',
			'{"name":"Minimal"}'
		);
		expect(mockPlugin.settingsService.bridge.requestLoadTheme).toHaveBeenCalled();
	});

	it('should restore from a valid ZIP backup', async () => {
		const result = await service.restoreBackup(new ArrayBuffer(0));
		expect(result).toBe(true);
		expect(mockPlugin.settingsService.onDataLoaded).toHaveBeenCalledWith(
			expect.objectContaining({ [THEME_KEY]: 'restored-theme' }),
			true,
			true
		);
		expect(
			mockPlugin.settingsService.refreshService.trigger
		).toHaveBeenCalled();
	});

	it('should fail to restore if manifest is missing', async () => {
		const JSZip = (await import('jszip')).default;
		(JSZip.loadAsync as any).mockResolvedValueOnce({
			file: vi.fn().mockReturnValue(null),
			folder: vi.fn().mockReturnValue(null),
		});

		const result = await service.restoreBackup(new ArrayBuffer(0));
		expect(result).toBe(false);
	});
});

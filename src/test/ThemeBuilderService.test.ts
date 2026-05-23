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
import { App } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationService } from '../application/NotificationService';
import {
	ThemeBuilderService,
	ThemeManifest,
} from '../application/ThemeBuilderService';
import { ObsidianBridge } from '../infrastructure/bridge/ObsidianBridge';

describe('ThemeBuilderService', () => {
	let app: App;
	let notifications: NotificationService;
	let bridge: ObsidianBridge;
	let themeBuilder: ThemeBuilderService;

	beforeEach(() => {
		app = new App();
		notifications = {
			util: vi.fn(),
			error: vi.fn(),
			snippet: vi.fn(),
		} as unknown as NotificationService;
		bridge = {
			requestLoadTheme: vi.fn(),
		} as unknown as ObsidianBridge;
		themeBuilder = new ThemeBuilderService(app, bridge, notifications);
	});

	describe('createTheme', () => {
		it('should create a new theme directory and files', async () => {
			const manifest: ThemeManifest = {
				name: 'Test Theme',
				author: 'Test Author',
				version: '1.0.0',
				minAppVersion: '1.0.0',
			};

			const existsSpy = vi
				.spyOn(app.vault.adapter, 'exists')
				.mockResolvedValue(false);
			const mkdirSpy = vi
				.spyOn(app.vault.adapter, 'mkdir')
				.mockResolvedValue(undefined);
			const writeSpy = vi
				.spyOn(app.vault.adapter, 'write')
				.mockResolvedValue(undefined);

			const themeId = await themeBuilder.createTheme(manifest);

			expect(themeId).toBe('test-theme');
			expect(existsSpy).toHaveBeenCalledWith('.obsidian/themes/test-theme');
			expect(mkdirSpy).toHaveBeenCalledWith('.obsidian/themes/test-theme');
			expect(writeSpy).toHaveBeenCalledWith(
				'.obsidian/themes/test-theme/manifest.json',
				JSON.stringify(manifest, null, '\t')
			);
			expect(writeSpy).toHaveBeenCalledWith(
				'.obsidian/themes/test-theme/theme.css',
				'/* Test Theme theme */\n\n:root {\n\n}\n'
			);
			expect(notifications.util).toHaveBeenCalledWith(
				'Created theme: Test Theme'
			);
			expect(bridge.requestLoadTheme).toHaveBeenCalled();
		});

		it('should throw an error if theme directory already exists', async () => {
			const manifest: ThemeManifest = {
				name: 'Existing Theme',
				author: 'Author',
				version: '1.0',
				minAppVersion: '1.0',
			};

			vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(true);

			await expect(themeBuilder.createTheme(manifest)).rejects.toThrow(
				'Theme directory already exists: .obsidian/themes/existing-theme'
			);
		});
	});

	describe('deleteTheme', () => {
		it('should delete an existing theme', async () => {
			const existsSpy = vi
				.spyOn(app.vault.adapter, 'exists')
				.mockResolvedValue(true);
			const rmdirSpy = vi
				.spyOn(app.vault.adapter, 'rmdir')
				.mockResolvedValue(undefined);

			await themeBuilder.deleteTheme('test-theme');

			expect(existsSpy).toHaveBeenCalledWith('.obsidian/themes/test-theme');
			expect(rmdirSpy).toHaveBeenCalledWith(
				'.obsidian/themes/test-theme',
				true
			);
			expect(notifications.util).toHaveBeenCalledWith(
				'Deleted theme: test-theme'
			);
			expect(bridge.requestLoadTheme).toHaveBeenCalled();
		});

		it('should throw an error if theme directory does not exist', async () => {
			vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);

			await expect(themeBuilder.deleteTheme('missing-theme')).rejects.toThrow(
				'Theme directory does not exist: .obsidian/themes/missing-theme'
			);
		});
	});

	describe('duplicateTheme', () => {
		it('should duplicate an existing theme', async () => {
			const existsSpy = vi
				.spyOn(app.vault.adapter, 'exists')
				.mockImplementation(async (path) => {
					if (path === '.obsidian/themes/source-theme') return true;
					if (path === '.obsidian/themes/new-theme') return false;
					return false;
				});

			const mkdirSpy = vi
				.spyOn(app.vault.adapter, 'mkdir')
				.mockResolvedValue(undefined);

			const sourceManifest: ThemeManifest = {
				name: 'Source Theme',
				author: 'Author',
				version: '1.0',
				minAppVersion: '1.0',
			};

			const readSpy = vi
				.spyOn(app.vault.adapter, 'read')
				.mockImplementation(async (path) => {
					if (path === '.obsidian/themes/source-theme/manifest.json') {
						return JSON.stringify(sourceManifest);
					}
					if (path === '.obsidian/themes/source-theme/theme.css') {
						return '/* Source CSS */';
					}
					return '';
				});

			const writeSpy = vi
				.spyOn(app.vault.adapter, 'write')
				.mockResolvedValue(undefined);

			const newThemeId = await themeBuilder.duplicateTheme(
				'source-theme',
				'New Theme'
			);

			expect(newThemeId).toBe('new-theme');
			expect(mkdirSpy).toHaveBeenCalledWith('.obsidian/themes/new-theme');

			// Verify manifest update
			const expectedManifest = { ...sourceManifest, name: 'New Theme' };
			expect(writeSpy).toHaveBeenCalledWith(
				'.obsidian/themes/new-theme/manifest.json',
				JSON.stringify(expectedManifest, null, '\t')
			);

			// Verify CSS copy
			expect(writeSpy).toHaveBeenCalledWith(
				'.obsidian/themes/new-theme/theme.css',
				'/* Source CSS */'
			);

			expect(existsSpy).toHaveBeenCalledWith('.obsidian/themes/source-theme');
			expect(existsSpy).toHaveBeenCalledWith('.obsidian/themes/new-theme');
			expect(readSpy).toHaveBeenCalledWith(
				'.obsidian/themes/source-theme/manifest.json'
			);
			expect(readSpy).toHaveBeenCalledWith(
				'.obsidian/themes/source-theme/theme.css'
			);

			expect(notifications.util).toHaveBeenCalledWith(
				'Duplicated theme to: New Theme'
			);
			expect(bridge.requestLoadTheme).toHaveBeenCalled();
		});
	});

	describe('getThemes', () => {
		it('should list all themes', async () => {
			vi.spyOn(app.vault.adapter, 'exists').mockImplementation(async (path) => {
				if (path === '.obsidian/themes') return true;
				if (path === '.obsidian/themes/theme-1/manifest.json') return true;
				if (path === '.obsidian/themes/theme-2/manifest.json') return true;
				return false;
			});

			vi.spyOn(app.vault.adapter, 'list').mockResolvedValue({
				folders: [
					'.obsidian/themes/theme-1',
					'.obsidian/themes/theme-2',
					'.obsidian/themes/invalid-theme', // Will fail exists check for manifest
				],
				files: [],
			});

			const manifest1: ThemeManifest = {
				name: 'Theme 1',
				author: 'A',
				version: '1',
				minAppVersion: '1',
			};
			const manifest2: ThemeManifest = {
				name: 'Theme 2',
				author: 'B',
				version: '1',
				minAppVersion: '1',
			};

			vi.spyOn(app.vault.adapter, 'read').mockImplementation(async (path) => {
				if (path === '.obsidian/themes/theme-1/manifest.json')
					return JSON.stringify(manifest1);
				if (path === '.obsidian/themes/theme-2/manifest.json')
					return JSON.stringify(manifest2);
				return '';
			});

			const themes = await themeBuilder.getThemes();

			expect(Object.keys(themes)).toHaveLength(2);
			expect(themes['theme-1']).toEqual(manifest1);
			expect(themes['theme-2']).toEqual(manifest2);
		});

		it('should return empty object if themes directory does not exist', async () => {
			vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);

			const themes = await themeBuilder.getThemes();
			expect(themes).toEqual({});
		});
	});

	describe('updateThemeManifest', () => {
		it('should update an existing theme manifest', async () => {
			const manifest: ThemeManifest = {
				name: 'Updated Theme',
				author: 'Author',
				version: '2.0',
				minAppVersion: '1.0',
			};

			const existsSpy = vi
				.spyOn(app.vault.adapter, 'exists')
				.mockResolvedValue(true);
			const writeSpy = vi
				.spyOn(app.vault.adapter, 'write')
				.mockResolvedValue(undefined);

			await themeBuilder.updateThemeManifest('test-theme', manifest);

			expect(existsSpy).toHaveBeenCalledWith(
				'.obsidian/themes/test-theme/manifest.json'
			);
			expect(writeSpy).toHaveBeenCalledWith(
				'.obsidian/themes/test-theme/manifest.json',
				JSON.stringify(manifest, null, '\t')
			);
			expect(notifications.util).toHaveBeenCalledWith(
				'Updated manifest for: Updated Theme'
			);
			expect(bridge.requestLoadTheme).toHaveBeenCalled();
		});

		it('should throw an error if manifest does not exist', async () => {
			const manifest: ThemeManifest = {
				name: 'Theme',
				author: 'Author',
				version: '1.0',
				minAppVersion: '1.0',
			};

			vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);

			await expect(
				themeBuilder.updateThemeManifest('test-theme', manifest)
			).rejects.toThrow('Manifest not found for theme: test-theme');
		});
	});
});

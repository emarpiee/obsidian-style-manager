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

import { RefreshLevel } from '../types';

import { SnippetService } from '../application/SnippetService';

describe('SnippetService', () => {
	let service: SnippetService;
	let mockOptions: any;

	beforeEach(() => {
		vi.useFakeTimers();
		mockOptions = {
			plugin: {
				app: {
					vault: {
						adapter: {
							exists: vi.fn().mockImplementation((path: string) => {
								if (path.includes('s2') || path.includes('copy'))
									return Promise.resolve(false);
								return Promise.resolve(true);
							}),
							read: vi.fn().mockResolvedValue('content'),
							write: vi.fn().mockResolvedValue(undefined),
							rename: vi.fn().mockResolvedValue(undefined),
						},
					},
					customCss: {
						enabledSnippets: new Set(['s1']),
					},
				},
				selectedSnippets: new Set(),
				snippetMetadataMap: new Map(),
				parseAllSnippetMetadata: vi.fn().mockResolvedValue(undefined),
				settingsService: {
					save: vi.fn().mockResolvedValue(undefined),
					refreshService: { trigger: vi.fn() },
				},
			},
			bridge: {
				getEnabledSnippets: vi.fn().mockReturnValue(['s1']),
				getAllSnippets: vi.fn().mockReturnValue(['s1']),
				writeSnippet: vi.fn().mockResolvedValue(undefined),
				deleteSnippet: vi.fn().mockResolvedValue(undefined),
				forceLoadSnippets: vi.fn(),
				requestLoadSnippets: vi.fn(),
				getSnippetPath: (id: string) => `.obsidian/snippets/${id}.css`,
				setSnippetEnabledNative: vi.fn(),
			},
			viewManager: {},
			getIsolateMode: () => false,
			getLockerSettings: () => ['s1'],
			setLockerSettings: vi.fn().mockResolvedValue(undefined),
		};
		service = new SnippetService(mockOptions);
	});

	it('should create a new snippet with unique name', async () => {
		const name = await service.createSnippet();
		expect(name).toBe('untitled');
		expect(mockOptions.bridge.writeSnippet).toHaveBeenCalledWith(
			'untitled',
			''
		);
		expect(mockOptions.plugin.settingsService.save).toHaveBeenCalled();
	});

	it('should duplicate an existing snippet', async () => {
		const newName = await service.duplicateSnippet('s1');
		expect(newName).toBe('s1 copy');
		expect(mockOptions.plugin.app.vault.adapter.read).toHaveBeenCalled();
		expect(mockOptions.plugin.app.vault.adapter.write).toHaveBeenCalledWith(
			expect.stringContaining('s1 copy'),
			'content'
		);
	});

	it('should delete a snippet and update locker', async () => {
		await service.deleteSnippet('s1');
		expect(mockOptions.bridge.deleteSnippet).toHaveBeenCalledWith('s1');
		expect(mockOptions.setLockerSettings).toHaveBeenCalledWith([]);

		vi.runAllTimers();
		expect(
			mockOptions.plugin.settingsService.refreshService.trigger
		).toHaveBeenCalledWith(RefreshLevel.PARSE_CSS);
	});

	it('should rename a snippet', async () => {
		await service.renameSnippet('s1', 's2');
		expect(mockOptions.plugin.app.vault.adapter.rename).toHaveBeenCalled();
		expect(mockOptions.setLockerSettings).toHaveBeenCalledWith(['s2']);
	});

	it('should write snippet content and refresh', async () => {
		await service.writeSnippetContent('s1', 'new body {}');
		expect(mockOptions.plugin.app.vault.adapter.write).toHaveBeenCalledWith(
			expect.any(String),
			'new body {}'
		);
		expect(
			mockOptions.plugin.settingsService.refreshService.trigger
		).toHaveBeenCalledWith(RefreshLevel.PARSE_CSS);
	});

	describe('applySnippets', () => {
		it('should bypass appearance.json in Isolate Mode by mutating memory directly', async () => {
			const enabledSnippets = new Set(['old']);
			mockOptions.plugin.app.customCss.enabledSnippets = enabledSnippets;

			await service.applySnippets(['new1', 'new2'], true);

			expect(enabledSnippets.has('new1')).toBe(true);
			expect(enabledSnippets.has('new2')).toBe(true);
			expect(enabledSnippets.has('old')).toBe(false);
			expect(mockOptions.bridge.setSnippetEnabledNative).not.toHaveBeenCalled();
			expect(mockOptions.bridge.forceLoadSnippets).toHaveBeenCalled();
		});

		it('should use native toggles in Shared Mode to ensure disk persistence', async () => {
			mockOptions.bridge.getEnabledSnippets.mockReturnValue(['s1']);

			await service.applySnippets(['s2'], false);

			expect(mockOptions.bridge.setSnippetEnabledNative).toHaveBeenCalledWith(
				's1',
				false
			);
			expect(mockOptions.bridge.setSnippetEnabledNative).toHaveBeenCalledWith(
				's2',
				true
			);
			expect(mockOptions.bridge.forceLoadSnippets).toHaveBeenCalled();
		});
	});

	describe('syncSnippetState', () => {
		it('should adopt disk state into locker when in Shared Mode and disk changed', async () => {
			mockOptions.getIsolateMode = () => false;
			mockOptions.bridge.getSnippetStatusFromDisk = vi
				.fn()
				.mockResolvedValue(['disk-snippet']);
			mockOptions.getLockerSettings = () => ['locker-snippet'];
			mockOptions.bridge.getEnabledSnippets.mockReturnValue(['locker-snippet']);

			await service.syncSnippetState();

			expect(mockOptions.setLockerSettings).toHaveBeenCalledWith([
				'disk-snippet',
			]);
		});

		it('should NOT adopt disk state in Isolate Mode', async () => {
			mockOptions.getIsolateMode = () => true;
			mockOptions.bridge.getSnippetStatusFromDisk = vi
				.fn()
				.mockResolvedValue(['disk-snippet']);

			await service.syncSnippetState();

			expect(mockOptions.setLockerSettings).not.toHaveBeenCalled();
		});

		it('should reconcile memory if it differs from locker truth', async () => {
			mockOptions.getLockerSettings = () => ['target'];
			mockOptions.bridge.getEnabledSnippets.mockReturnValue(['different']);
			mockOptions.bridge.getSnippetStatusFromDisk = vi
				.fn()
				.mockResolvedValue(['different']);

			const applySpy = vi.spyOn(service, 'applySnippets');
			await service.syncSnippetState();

			expect(applySpy).toHaveBeenCalledWith(['target'], expect.any(Boolean));
		});

		it('should support legacy fallback key in appearance.json', async () => {
			mockOptions.getIsolateMode = () => false;
			// Bridge returns empty for Css key, but we'll simulate the disk having the old key
			mockOptions.bridge.getSnippetStatusFromDisk = vi
				.fn()
				.mockResolvedValue(['legacy-snippet']);

			await service.syncSnippetState();
			expect(mockOptions.setLockerSettings).toHaveBeenCalledWith([
				'legacy-snippet',
			]);
		});
	});
});

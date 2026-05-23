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

import { StyleBlockService } from '../application/StyleBlockService';

describe('StyleBlockService', () => {
	const service = new StyleBlockService();

	it('should return correct metadata template', () => {
		const blocks = service.getAvailableBlocks();
		const metadata = blocks.find((b) => b.id === 'metadata');
		expect(metadata).toBeDefined();
		const template = metadata?.template || '';
		expect(template).toContain('@metadata');
		expect(template).toContain('description:');
		expect(template).toContain('author:');
		expect(template).toContain('version: 1.0.0');
	});

	it('should return correct settings template', () => {
		const blocks = service.getAvailableBlocks();
		const settings = blocks.find((b) => b.id === 'settings');
		expect(settings).toBeDefined();
		const template = settings?.template || '';
		expect(template).toContain('@settings');
		expect(template).toContain('name:');
		expect(template).toContain('id:');
	});

	it('should inject metadata at the top', () => {
		const mockView = {
			state: {
				doc: {
					toString: () => 'body { color: red; }',
					length: 19,
				},
			},
			dispatch: vi.fn(),
			focus: vi.fn(),
		} as any;

		service.injectBlock(mockView, 'metadata');

		expect(mockView.dispatch).toHaveBeenCalled();
		const call = mockView.dispatch.mock.calls[0][0];
		expect(call.changes.from).toBe(0);
		expect(call.changes.insert).toContain('/* @metadata');
	});

	it('should not inject metadata if it already exists', () => {
		const mockView = {
			state: {
				doc: {
					toString: () => '/* @metadata ... */ body { color: red; }',
					length: 40,
				},
			},
			dispatch: vi.fn(),
			focus: vi.fn(),
		} as any;

		service.injectBlock(mockView, 'metadata');
		expect(mockView.dispatch).not.toHaveBeenCalled();
	});

	it('should inject settings at the bottom', () => {
		const mockView = {
			state: {
				doc: {
					toString: () => 'body { color: red; }',
					length: 19,
				},
			},
			dispatch: vi.fn(),
			focus: vi.fn(),
		} as any;

		service.injectBlock(mockView, 'settings');

		expect(mockView.dispatch).toHaveBeenCalled();
		const call = mockView.dispatch.mock.calls[0][0];
		expect(call.changes.from).toBe(19);
		expect(call.changes.insert).toContain('/* @settings');
	});
});

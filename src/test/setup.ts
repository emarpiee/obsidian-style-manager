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
import * as obsidian from 'obsidian';
import { vi } from 'vitest';

// Set up globals that the plugin expects to find
(globalThis as any).app = new obsidian.App();
(globalThis as any).createFragment = (obsidian as any).createFragment;
(globalThis as any).createEl = (obsidian as any).createEl;

// Mock window object properties if needed
if (typeof window !== 'undefined') {
	(window as any).app = (globalThis as any).app;
	(window as any).moment = (_val: any) => ({
		format: (f: string) => f,
	});
	Object.defineProperty(window, 'crypto', {
		value: {
			randomUUID: () => '1234-5678-90ab-cdef',
		},
		configurable: true,
	});
}

// Mock localStorage
const localStorageMock = (function () {
	let store: Record<string, string> = {};
	return {
		getItem: (key: string) => store[key] || null,
		setItem: (key: string, value: string) => {
			store[key] = value.toString();
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		},
	};
})();

Object.defineProperty(globalThis, 'localStorage', {
	value: localStorageMock,
	configurable: true,
});

if (typeof window !== 'undefined') {
	Object.defineProperty(window, 'localStorage', {
		value: localStorageMock,
		configurable: true,
	});

	// Mock Obsidian's DOM extensions
	(HTMLElement.prototype as any).createDiv = function (
		arg1?: string | { cls?: string },
		arg2?: string
	) {
		const cls = typeof arg1 === 'string' ? arg1 : arg1?.cls;
		const text = typeof arg1 === 'object' ? (arg1 as any).text : arg2;
		const div = document.createElement('div');
		if (cls) div.className = cls;
		if (text) div.textContent = text;
		this.appendChild(div);
		return div;
	};

	(HTMLElement.prototype as any).createEl = function (
		tag: string,
		arg2?: any,
		arg3?: any
	) {
		const options = typeof arg2 === 'object' ? arg2 : {};
		const text = typeof arg2 === 'string' ? arg2 : arg3;
		const el = document.createElement(tag);
		if (options.cls) el.className = options.cls;
		if (options.text || text) el.textContent = options.text || text;
		this.appendChild(el);
		return el;
	};

	(HTMLElement.prototype as any).createSpan = function (
		arg1?: string | { cls?: string },
		arg2?: string
	) {
		const cls = typeof arg1 === 'string' ? arg1 : arg1?.cls;
		const text = typeof arg1 === 'object' ? (arg1 as any).text : arg2;
		const span = document.createElement('span');
		if (cls) span.className = cls;
		if (text) span.textContent = text;
		this.appendChild(span);
		return span;
	};

	// Mock execCommand for clipboard fallback
	document.execCommand = vi.fn().mockReturnValue(true);
}

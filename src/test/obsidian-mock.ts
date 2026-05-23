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
import { vi } from 'vitest';

export const Notice = vi.fn();

export class Component {
	on = vi.fn();
	off = vi.fn();
	trigger = vi.fn();
	addChild = vi.fn();
	removeChild = vi.fn();
	register = vi.fn();
	load = vi.fn();
	onload = vi.fn();
	unload = vi.fn();
	onunload = vi.fn();
}

export class Events {
	on = vi.fn();
	off = vi.fn();
	trigger = vi.fn();
}

export class View extends Component {
	constructor(public leaf: any) {
		super();
	}
}

export class ItemView extends View {
	containerEl = document.createElement('div');
	addAction = vi.fn().mockReturnThis();
}

export class AbstractInputSuggest<T> {
	constructor(
		public app: App,
		public inputEl: HTMLInputElement
	) {}
	onSelect(_value: T, _evt: MouseEvent | KeyboardEvent): void {}
}

export class SearchComponent {
	constructor(public containerEl: HTMLElement) {}
	setValue = vi.fn().mockReturnThis();
	onChange = vi.fn().mockReturnThis();
	setPlaceholder = vi.fn().mockReturnThis();
	inputEl = document.createElement('input');
}

export interface TFolder {
	path: string;
	name: string;
}

export class App {
	workspace = {
		...new Events(),
		trigger: vi.fn(),
		getLeavesOfType: vi.fn().mockReturnValue([]),
	} as any;
	vault = {
		...new Events(),
		adapter: {
			exists: vi.fn(),
			mkdir: vi.fn(),
			write: vi.fn(),
			read: vi.fn(),
			rmdir: vi.fn(),
			list: vi.fn(),
		},
	} as any;
	plugins = {
		plugins: {},
	};
	fileManager = {
		trashFile: vi.fn().mockResolvedValue(undefined),
	};
	commands = {
		removeCommand: vi.fn(),
	};
}

export class Plugin {
	app: App;
	constructor(
		app: App,
		public manifest: any
	) {
		this.app = app;
	}
	settings = {};
	loadData = vi.fn().mockResolvedValue({});
	saveData = vi.fn().mockResolvedValue({});
	addCommand = vi.fn().mockImplementation((cmd) => cmd);
	addSettingTab = vi.fn();
	registerView = vi.fn();
	registerEvent = vi.fn();
}

export class Modal {
	scope = {
		register: vi.fn(),
	};
	constructor(public app: App) {}
	open() {}
	close() {}
	contentEl = document.createElement('div');
	modalEl = document.createElement('div');
}

export class Setting {
	constructor(public containerEl: HTMLElement) {}
	setName = vi.fn().mockReturnThis();
	setDesc = vi.fn().mockReturnThis();
	setClass = vi.fn().mockReturnThis();
	addButton = vi.fn().mockReturnThis();
	addText = vi.fn().mockReturnThis();
	addToggle = vi.fn().mockReturnThis();
	addDropdown = vi.fn().mockReturnThis();
	addSearch = vi.fn().mockReturnThis();
	addSlider = vi.fn().mockReturnThis();
	addColorPicker = vi.fn().mockReturnThis();
}

export const requestUrl = vi.fn();
export const debounce = (fn: any) => fn;
export const setIcon = vi.fn();
export const Platform = {
	isMobile: false,
	isDesktop: true,
};

export class Menu {
	addItem = vi.fn().mockReturnThis();
	showAtPosition = vi.fn();
	showAtMouseEvent = vi.fn();
}

export class ButtonComponent {
	constructor(public containerEl: HTMLElement) {}
	setButtonText = vi.fn().mockReturnThis();
	onClick = vi.fn().mockReturnThis();
	setCta = vi.fn().mockReturnThis();
	setWarning = vi.fn().mockReturnThis();
	setIcon = vi.fn().mockReturnThis();
	setTooltip = vi.fn().mockReturnThis();
}

export function createFragment() {
	return document.createDocumentFragment();
}

export function createEl(tag: string, options?: any) {
	const el = document.createElement(tag);
	if (options?.text) el.textContent = options.text;
	if (options?.cls) el.className = options.cls;
	return el;
}

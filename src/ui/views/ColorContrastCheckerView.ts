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
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

    You should have received a copy of the GNU General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import { ItemView, WorkspaceLeaf } from 'obsidian';

import { ColorContrastChecker } from '../components/ColorContrastChecker';

export const colorContrastViewType = 'style-manager-color-contrast-view';

export class ColorContrastCheckerView extends ItemView {
	private checker: ColorContrastChecker;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.checker = new ColorContrastChecker();
	}

	onload(): void {
		this.checker.render(this.contentEl);
	}

	onunload(): void {
		this.checker.destroy();
		this.contentEl.empty();
	}

	getViewType(): string {
		return colorContrastViewType;
	}

	getIcon(): string {
		return 'contrast';
	}

	getDisplayText(): string {
		return 'Color contrast checker';
	}
}

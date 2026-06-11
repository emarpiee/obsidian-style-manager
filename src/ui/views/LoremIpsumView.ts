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
import { ItemView, WorkspaceLeaf } from 'obsidian';

import { LoremIpsumGenerator } from '../components/LoremIpsumGenerator';

export const loremIpsumViewType = 'style-manager-lorem-ipsum-view';

export class LoremIpsumView extends ItemView {
	private generator: LoremIpsumGenerator;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.generator = new LoremIpsumGenerator();
	}

	onload(): void {
		this.generator.render(this.contentEl);
	}

	onunload(): void {
		this.generator.destroy();
		this.contentEl.empty();
	}

	getViewType(): string {
		return loremIpsumViewType;
	}

	getIcon(): string {
		return 'type-set';
	}

	getDisplayText(): string {
		return 'Lorem ipsum generator';
	}
}

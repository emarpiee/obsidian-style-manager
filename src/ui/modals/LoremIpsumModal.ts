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
import { App, Modal } from 'obsidian';

import StyleManagerPlugin from '../../main';
import { LoremIpsumGenerator } from '../components/LoremIpsumGenerator';

export class LoremIpsumModal extends Modal {
	private generator: LoremIpsumGenerator;

	constructor(app: App, private plugin: StyleManagerPlugin) {
		super(app);
		this.generator = new LoremIpsumGenerator();
	}

	onOpen(): void {
		this.titleEl.setText('Lorem Ipsum Generator');
		this.generator.render(this.contentEl, {
			plugin: this.plugin,
			onOpenInTab: () => this.close(),
		});
	}

	onClose(): void {
		this.generator.destroy();
		this.contentEl.empty();
	}
}

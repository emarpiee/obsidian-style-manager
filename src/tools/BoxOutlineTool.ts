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
import { TOOL_BOX_OUTLINE_COLOR } from '../constants';
import type StyleManagerPlugin from '../main';

export class BoxOutlineTool {
	private styleEl: HTMLElement | undefined;

	constructor(private plugin: StyleManagerPlugin) {}

	toggle(): void {
		const currentCSS = this.styleEl?.textContent;
		let cssToApply = '';

		if (!currentCSS) {
			const color = this.plugin.settingsService.settings[TOOL_BOX_OUTLINE_COLOR] ?? 'red';
			cssToApply = `* {outline: ${color} 1px solid !important}`;
			this.styleEl = document.createElement('style');
			this.styleEl.setAttribute('type', 'text/css');
			document.head.appendChild(this.styleEl);
			this.plugin.register(() => this.styleEl?.detach());
		} else {
			cssToApply = '';
		}

		if (this.styleEl) {
			this.styleEl.textContent = cssToApply;
		}
		this.plugin.app.workspace.trigger('css-change');
	}
}

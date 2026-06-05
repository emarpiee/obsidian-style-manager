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
import { Notice, Plugin } from 'obsidian';

declare const electronWindow: {
	openDevTools: () => void;
	toggleDevTools: () => void;
};

export class FreezeObsidianTool {
	constructor(private plugin: Plugin) {}

	freeze(delay: number = 4): void {
		const freezeNotice = new Notice(
			`⚠ Will freeze Obsidian in ${delay}s`,
			(delay - 0.2) * 1000
		);
		electronWindow.openDevTools();

		let passSecs = 0;
		const timer = setInterval(() => {
			const timePassed = (delay - passSecs).toFixed(1);
			freezeNotice.setMessage(`⚠ Will freeze Obsidian in ${timePassed}s`);
			passSecs += 0.1;
		}, 100);

		setTimeout(() => {
			// eslint-disable-next-line no-debugger
			debugger;
			clearInterval(timer);
		}, delay * 1000);
	}
}

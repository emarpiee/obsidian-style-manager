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

export class Logger {
	private static isEnabled: boolean = false;

	public static setEnabled(enabled: boolean): void {
		this.isEnabled = enabled;
	}

	public static log(...args: any[]): void {
		if (this.isEnabled) {
			console.log(...args);
		}
	}

	public static warn(...args: any[]): void {
		if (this.isEnabled) {
			console.warn(...args);
		}
	}

	public static info(...args: any[]): void {
		if (this.isEnabled) {
			console.info(...args);
		}
	}

	public static debug(...args: any[]): void {
		if (this.isEnabled) {
			console.debug(...args);
		}
	}

	public static time(label: string): void {
		if (this.isEnabled) {
			console.time(label);
		}
	}

	public static timeEnd(label: string): void {
		if (this.isEnabled) {
			console.timeEnd(label);
		}
	}

	public static error(...args: any[]): void {
		console.error(...args);
	}
}

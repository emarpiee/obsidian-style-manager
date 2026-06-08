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
import { setTooltip } from 'obsidian';

export type Validator = (value: string) => string | null;

export const Validators: Record<string, Validator> = {
	required: (val) => (val.trim() === '' ? 'This field is required' : null),
	semver: (val) => {
		const semverRegex = /^\d+\.\d+(\.\d+)?$/;
		return !semverRegex.test(val) ? 'Version must follow x.y or x.y.z format' : null;
	},
	url: (val) => {
		if (val.trim() === '') return null;
		try {
			new URL(val);
			return null;
		} catch {
			return 'Please enter a valid URL';
		}
	},
};

export function applyInvalidState(inputEl: HTMLElement, message: string): void {
	inputEl.addClass('is-invalid');
	setTooltip(inputEl, message);
}

export function clearInvalidState(inputEl: HTMLElement): void {
	inputEl.removeClass('is-invalid');
	// Obsidian's setTooltip doesn't have a clear method, but typically
	// clearing the class or resetting the tooltip is handled by Obsidian.
	// We can set it to empty string or let it be.
	setTooltip(inputEl, '');
}

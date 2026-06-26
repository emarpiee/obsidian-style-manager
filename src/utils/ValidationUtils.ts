import { setTooltip } from 'obsidian';

export function isNumeric(value: unknown): boolean {
	if (value === null || value === undefined) return false;
	if (typeof value === 'number') return Number.isFinite(value);
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (trimmed === '') return false;
		return Number.isFinite(Number(trimmed));
	}
	return false;
}

export function isString(value: unknown): boolean {
	return typeof value === 'string';
}

export type Validator = (value: string) => string | null;

export const Validators: Record<string, Validator> = {
	required: (val) => (val.trim() === '' ? 'This field is required' : null),
	semver: (val) => {
		const semverRegex = /^\d+\.\d+(\.\d+)?$/;
		return !semverRegex.test(val)
			? 'Version must follow x.y or x.y.z format'
			: null;
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

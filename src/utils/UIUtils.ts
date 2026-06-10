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
import Pickr from '@simonwep/pickr';

import { t } from '../infrastructure/lang/helpers';

/**
 * Returns configuration for the Pickr color picker.
 */
export function getPickrSettings(opts: {
	isView: boolean;
	el: HTMLElement;
	containerEl: HTMLElement;
	swatches: string[];
	opacity: boolean | undefined;
	defaultColor: string;
	position?: Pickr.Options['position'];
}): Pickr.Options {
	const { el, isView, containerEl, swatches, opacity, defaultColor } = opts;

	return {
		el,
		container: isView ? document.body : containerEl,
		theme: 'monolith',
		swatches,
		lockOpacity: !opacity,
		default: defaultColor,
		position: opts.position || 'left-middle',
		components: {
			preview: true,
			hue: true,
			opacity: !!opacity,
			interaction: {
				hex: true,
				rgba: true,
				hsla: true,
				input: true,
				cancel: true,
				clear: true,
				save: true,
			},
		},
	};
}

/**
 * Resolves a color value for use in Pickr.
 *
 * Pickr cannot parse CSS variables like `var(--my-color)` and silently falls
 * back to transparent. This function detects such values and reads the real
 * computed color from the document body, returning a plain hex/rgb string that
 * Pickr can parse. Falls back to the original value if resolution fails.
 */
export function resolveDefaultColor(color: string): string {
	if (!color) return color;
	const trimmed = color.trim();

	// Extract the property name from var(--foo) or var(--foo, fallback)
	const varMatch = trimmed.match(/^var\(\s*(-{2}[\w-]+)/);
	if (!varMatch) return trimmed;

	const propName = varMatch[1];
	const computed = getComputedStyle(document.body)
		.getPropertyValue(propName)
		.trim();
	return computed || trimmed;
}

/**
 * Hides the Pickr instance.
 */
export function onPickrCancel(instance: Pickr): void {
	instance.hide();
}

/**
 * Creates a DocumentFragment with a description and default value label.
 */
export function createDescription(
	description: string | undefined,
	def: string,
	defLabel?: string
): DocumentFragment {
	const fragment = createFragment();

	if (description) {
		fragment.appendChild(document.createTextNode(description));
	}

	if (def) {
		const small = createEl('small');
		small.appendChild(createEl('strong', { text: `${t('Default:')} ` }));
		small.appendChild(document.createTextNode(defLabel || def));

		const div = createEl('div');
		div.appendChild(small);
		fragment.appendChild(div);
	}

	return fragment;
}

/**
 * Robustly copies text to the clipboard.
 */
export async function copyToClipboard(text: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
	} catch (_e) {
		const textArea = document.createElement('textarea');
		textArea.value = text;
		document.body.appendChild(textArea);
		textArea.select();
		document.execCommand('copy');
		document.body.removeChild(textArea);
	}
}

export interface ListSelectionOptions<T> {
	container: HTMLElement;
	getItems: () => T[];
	getId: (item: T) => string;
	selectedIds: Set<string>;
	lastSelectedIndexGetter?: () => number | null;
	lastSelectedIndexSetter?: (index: number | null) => void;
	onSelectionChange: () => void;
}

export function setupListKeybindings<T>(
	options: ListSelectionOptions<T>
): () => void {
	const handler = (e: KeyboardEvent): void => {
		if (!document.contains(options.container)) {
			// Auto-cleanup if container is removed
			document.removeEventListener('keydown', handler, true);
			return;
		}

		// Check if container is actually visible
		if (options.container.offsetParent === null) {
			return;
		}

		const activeEl = document.activeElement;
		const isInput =
			activeEl instanceof HTMLInputElement ||
			activeEl instanceof HTMLTextAreaElement;

		if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
			if (isInput) return; // Allow normal select-all in inputs
			e.preventDefault();
			e.stopPropagation();
			const items = options.getItems();
			items.forEach((item) => options.selectedIds.add(options.getId(item)));
			options.onSelectionChange();
		}
	};
	document.addEventListener('keydown', handler, true);
	return () => document.removeEventListener('keydown', handler, true);
}

export function handleItemSelection<T>(
	e: MouseEvent | KeyboardEvent,
	index: number,
	item: T,
	options: ListSelectionOptions<T>,
	forceToggle = false
): void {
	const lastIndex = options.lastSelectedIndexGetter
		? options.lastSelectedIndexGetter()
		: null;
	const itemId = options.getId(item);

	if (e.shiftKey && lastIndex !== null) {
		const start = Math.min(lastIndex, index);
		const end = Math.max(lastIndex, index);
		const items = options.getItems();
		for (let i = start; i <= end; i++) {
			options.selectedIds.add(options.getId(items[i]));
		}
	} else if (e.ctrlKey || e.metaKey || forceToggle) {
		if (options.selectedIds.has(itemId)) {
			options.selectedIds.delete(itemId);
		} else {
			options.selectedIds.add(itemId);
		}
		if (options.lastSelectedIndexSetter) {
			options.lastSelectedIndexSetter(index);
		}
	}
	options.onSelectionChange();
}

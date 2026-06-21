import { t } from '../infrastructure/lang/helpers';

// onPickrCancel removed — jscolorpicker's submitMode: 'confirm' handles cancel internally

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
			activeEl instanceof HTMLTextAreaElement ||
			(activeEl as HTMLElement)?.isContentEditable;

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

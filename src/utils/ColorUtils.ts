import ColorPicker from '../lib/colorpicker/colorpicker.min.js';

/**
 * Returns true when `color` is a recognised CSS colour prefix
 * (hex, rgb, hsl, var(--…), or the keyword "transparent").
 * Used for lightweight validation before attempting to parse with the
 * colour picker.
 */
export function isValidDefaultColor(color: string): boolean {
	if (!color) return false;
	const trimmed = color.trim();
	if (trimmed === '#') return true;
	if (trimmed.startsWith('var(--')) {
		const resolved = resolveDefaultColor(trimmed);
		return isColorValid(resolved);
	}
	return /^(#|rgb|rgba|hsl|hsla|oklch|transparent)/i.test(trimmed) && isColorValid(trimmed);
}

/**
 * Checks if a color string can be successfully parsed by the color picker.
 */
export function isColorValid(color: string | undefined | null): boolean {
	if (!color || color.trim() === '' || color.trim() === '#') return false;
	try {
		new ColorPicker.Color(color);
		return true;
	} catch {
		return false;
	}
}

/**
 * Resolves a color value for use in the color picker.
 *
 * The color picker cannot parse CSS variables like `var(--my-color)` and
 * silently falls back to transparent. This function detects such values and
 * reads the real computed color from the document body, returning a plain
 * hex/rgb string that the picker can parse. Falls back to the original value
 * if resolution fails.
 */
export function resolveDefaultColor(color: string): string {
	if (!color) return color;
	const trimmed = color.trim();

	// Extract the property name from var(--foo) or var(--foo, fallback)
	const varMatch = trimmed.match(/^var\(\s*(-{2}[\w-]+)(?:\s*,\s*(.+))?\s*\)$/);
	if (!varMatch) return trimmed;

	const propName = varMatch[1];
	const fallback = varMatch[2];
	
	let computed = '';
	if (typeof document !== 'undefined' && typeof getComputedStyle !== 'undefined') {
		computed = getComputedStyle(document.body).getPropertyValue(propName).trim();
	}
	
	if (computed) return computed;
	
	if (fallback) {
		const trimmedFallback = fallback.trim();
		if (trimmedFallback.startsWith('var(--')) {
			return resolveDefaultColor(trimmedFallback);
		}
		return trimmedFallback;
	}
	
	return 'transparent';
}

/**
 * Returns configuration for the jscolorpicker color picker.
 */
export function getColorPickerConfig(opts: {
	isView: boolean;
	container: HTMLElement;
	opacity: boolean | undefined;
	defaultColor: string;
	toggleStyle?: 'button' | 'input';
	dialogPlacement?: string;
}): ConstructorParameters<typeof ColorPicker>[1] {
	const { isView, container, opacity, defaultColor, toggleStyle, dialogPlacement } = opts;

	const safeColor = isColorValid(defaultColor) ? defaultColor : null;

	let targetContainer = container;
	if (isView && typeof document !== 'undefined') {
		let sharedContainer = document.querySelector(
			'.style-manager-color-picker-wrapper'
		) as HTMLElement;
		if (!sharedContainer) {
			sharedContainer = document.createElement('div');
			sharedContainer.className = 'style-manager-color-picker-wrapper style-manager-plugin';
			document.body.appendChild(sharedContainer);
		}
		targetContainer = sharedContainer;
	}

	return {
		container: targetContainer,
		color: safeColor,
		enableAlpha: !!opacity,
		enableEyedropper: true,
		submitMode: 'confirm',
		defaultFormat: 'hex',
		formats: ['hex', 'rgb', 'hsl', 'oklch'],
		showClearButton: false,
		toggleStyle: toggleStyle ?? 'button',
		dialogPlacement: dialogPlacement ?? 'auto',
	};
}

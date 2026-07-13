import chroma from 'chroma-js';
import ColorPicker from 'colorpicker/dist/colorpicker.js';

/**
 * Returns true when `color` is a recognised CSS colour prefix
 * (hex, rgb, hsl, or the keyword "transparent").
 * Used for lightweight validation before attempting to parse with the
 * colour picker.
 */
export function isValidDefaultColor(color: string): boolean {
	if (!color) return false;
	const trimmed = color.trim();
	if (trimmed === '#') return true;
	return isColorValid(trimmed);
}

/**
 * Checks if a color string can be successfully parsed by the color picker.
 */
export function isColorValid(color: string | undefined | null): boolean {
	if (!color || color.trim() === '' || color.trim() === '#') return false;
	const trimmed = color.trim();

	return chroma.valid(trimmed);
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
	const {
		isView,
		container,
		opacity,
		defaultColor,
		toggleStyle,
		dialogPlacement,
	} = opts;

	const safeColor = isColorValid(defaultColor) ? defaultColor : null;

	let targetContainer = container;
	if (isView && typeof activeDocument !== 'undefined') {
		let sharedContainer = activeDocument.querySelector(
			'.style-manager-color-picker-wrapper'
		);
		if (!sharedContainer) {
			sharedContainer = activeDocument.createElement('div');
			sharedContainer.className =
				'style-manager-color-picker-wrapper style-manager-plugin';
			activeDocument.body.appendChild(sharedContainer);
		}
		targetContainer = sharedContainer as HTMLElement;
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

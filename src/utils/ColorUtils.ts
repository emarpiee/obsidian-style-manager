import chroma from 'chroma-js';
import ColorPicker from 'colorpicker/dist/colorpicker.js';

/**
 * jscolorpicker registers anonymous window listeners (pointerdown / keydown)
 * in its constructor but never removes them in destroy(). SafeColorPicker
 * intercepts those registrations so it can clean up after itself, and nulls
 * all internal DOM references on destroy() so the GC can reclaim them even
 * while the now-hollow ColorPicker object itself remains pinned by window.
 */
// Per-instance record of window listeners registered during construction
const pickerListenersMap = new WeakMap<
	object,
	Array<{
		type: string;
		listener: EventListenerOrEventListenerObject;
		options?: boolean | AddEventListenerOptions;
	}>
>();

export class SafeColorPicker extends ColorPicker {
	constructor(
		trigger: HTMLButtonElement | HTMLInputElement,
		config: ConstructorParameters<typeof ColorPicker>[1]
	) {
		const activeListeners: Array<{
			type: string;
			listener: EventListenerOrEventListenerObject;
			options?: boolean | AddEventListenerOptions;
		}> = [];

		const originalAddEventListener = window.addEventListener;

		// Intercept window.addEventListener for the duration of super()
		window.addEventListener = function (
			type: string,
			listener: EventListenerOrEventListenerObject,
			options?: boolean | AddEventListenerOptions
		): void {
			if (type === 'pointerdown' || type === 'keydown') {
				activeListeners.push({ type, listener, options });
			}
			originalAddEventListener.call(window, type, listener, options);
		};

		try {
			super(trigger, config);
			pickerListenersMap.set(this, activeListeners);
		} finally {
			window.addEventListener = originalAddEventListener;
		}
	}

	destroy(): void {
		// Clean up the window listeners registered during constructor
		const listeners = pickerListenersMap.get(this);
		if (listeners) {
			listeners.forEach(({ type, listener, options }) => {
				window.removeEventListener(type, listener, options);
			});
			pickerListenersMap.delete(this);
		}

		super.destroy();

		interface ColorPickerInternals {
			$toggle?: Element;
			$input?: Element;
			$button?: Element;
			$dialog?: Element;
			$formats?: Element[];
			$colorInput?: Element;
			popper?: unknown;
			config?: { container?: unknown };
			changeHandler?: unknown;
			clickHandler?: unknown;
			_color?: unknown;
			_newColor?: unknown;
		}

		const self = this as unknown as ColorPickerInternals;

		// Sever DOM references so the GC can reclaim them even though the
		// ColorPicker instance itself is still pinned by the window listeners.
		self.$toggle?.remove();
		self.$toggle = undefined;
		self.$input = undefined;
		self.$button = undefined;
		self.$dialog = undefined;
		self.$formats = undefined;
		self.$colorInput = undefined;
		self.popper = undefined;
		self.changeHandler = undefined;
		self.clickHandler = undefined;
		self._color = undefined;
		self._newColor = undefined;
		if (self.config) {
			self.config.container = undefined;
		}
	}
}

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
			sharedContainer = (
				activeWindow as unknown as { createDiv: () => HTMLDivElement }
			).createDiv();
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

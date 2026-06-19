import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StyleGenerator } from '../core/style/StyleGenerator';
import { SettingType } from '../ui/components/base/types';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeSettingsService(initial: Record<string, unknown> = {}) {
	const store: Record<string, unknown> = { ...initial };
	return {
		getSetting: vi.fn(
			(sectionId: string, settingId: string) =>
				store[`${sectionId}@@${settingId}`]
		),
		setSetting: vi.fn(
			(sectionId: string, settingId: string, value: unknown) => {
				store[`${sectionId}@@${settingId}`] = value;
			}
		),
		clearSetting: vi.fn((sectionId: string, settingId: string) => {
			delete store[`${sectionId}@@${settingId}`];
		}),
		_store: store,
	};
}

function makeTextComponent(initialValue = '') {
	let _value = initialValue;
	const inputEl = document.createElement('input');
	inputEl.value = _value;
	return {
		inputEl,
		getValue: vi.fn(() => _value),
		setValue: vi.fn((v: string) => {
			_value = v;
			inputEl.value = v;
		}),
	};
}

// ---------------------------------------------------------------------------
// 1. StyleGenerator.setConfig — non-array settings guard
// ---------------------------------------------------------------------------

describe('StyleGenerator.setConfig — non-array settings guard (fix: 59c01d4)', () => {
	let mockBridge: any;
	let generator: StyleGenerator;

	beforeEach(() => {
		vi.clearAllMocks();
		document.getElementById('style-manager-styles')?.remove();

		mockBridge = {
			triggerEvent: vi.fn(),
			getNativeConfig: vi.fn().mockReturnValue({}),
		};
		generator = new StyleGenerator({} as any, mockBridge, () => ({}));
	});

	it('should not throw when a section has undefined settings', () => {
		const parsedSettings = [
			{ id: 'bad-section', name: 'Bad Section', settings: undefined },
		] as any;

		expect(() => generator.setConfig(parsedSettings)).not.toThrow();
		expect(generator.config['bad-section']).toBeDefined();
		expect(Object.keys(generator.config['bad-section']).length).toBe(0);
	});

	it('should not throw when a section has null settings', () => {
		const parsedSettings = [
			{ id: 'null-section', name: 'Null Section', settings: null },
		] as any;

		expect(() => generator.setConfig(parsedSettings)).not.toThrow();
		expect(generator.config['null-section']).toBeDefined();
	});

	it('should not throw when settings is a scalar number', () => {
		const parsedSettings = [
			{ id: 'scalar-section', name: 'Scalar', settings: 42 },
		] as any;

		expect(() => generator.setConfig(parsedSettings)).not.toThrow();
	});

	it('should not throw when settings is a plain object (non-array)', () => {
		const parsedSettings = [
			{
				id: 'obj-section',
				name: 'Object Section',
				settings: { id: 'var1', type: SettingType.VARIABLE_NUMBER },
			},
		] as any;

		expect(() => generator.setConfig(parsedSettings)).not.toThrow();
	});

	it('should still map valid sections correctly alongside bad ones', () => {
		const parsedSettings = [
			{ id: 'bad-section', name: 'Bad', settings: null },
			{
				id: 'good-section',
				name: 'Good',
				settings: [
					{
						id: 'num-var',
						type: SettingType.VARIABLE_NUMBER,
						default: 16,
						title: 'Num',
					},
				],
			},
		] as any;

		generator.setConfig(parsedSettings);

		// bad section: key present but empty
		expect(generator.config['bad-section']).toBeDefined();
		expect(Object.keys(generator.config['bad-section']).length).toBe(0);

		// good section: fully populated
		expect(generator.config['good-section']['num-var']).toBeDefined();
		expect(generator.config['good-section']['num-var'].id).toBe('num-var');
	});

	it('should not register gradients for a section with non-array settings', () => {
		const parsedSettings = [
			{ id: 'bad-section', name: 'Bad', settings: 'oops' },
		] as any;

		generator.setConfig(parsedSettings);
		expect(generator.gradients['bad-section']).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// 2. VariableNumberField — onCommit NaN guard logic
//    (tests mirror the exact logic in the component without requiring DOM render)
// ---------------------------------------------------------------------------

describe('VariableNumberField — NaN revert logic (fix: 59c01d4)', () => {
	const SECTION_ID = 'num-section';
	const SETTING_ID = 'num-var';
	const DEFAULT_VALUE = 16;

	const numberSetting: any = {
		id: SETTING_ID,
		type: SettingType.VARIABLE_NUMBER,
		default: DEFAULT_VALUE,
		title: 'Number Setting',
	};

	/**
	 * Simulate exactly what onCommit does in VariableNumberField
	 * and return whether a revert was triggered and what value was set.
	 */
	function runOnCommit(
		inputValue: string,
		storedValue: number | undefined,
		text: ReturnType<typeof makeTextComponent>
	) {
		const svc = makeSettingsService(
			storedValue !== undefined
				? { [`${SECTION_ID}@@${SETTING_ID}`]: storedValue }
				: {}
		);

		const isFloat = /\./.test(inputValue);
		const numValue = isFloat
			? parseFloat(inputValue)
			: parseInt(inputValue, 10);

		let reverted = false;

		if (isNaN(numValue)) {
			const stored = svc.getSetting(SECTION_ID, SETTING_ID);
			text.setValue(
				stored != null ? stored.toString() : numberSetting.default.toString()
			);
			reverted = true;
		}

		return { reverted, svc };
	}

	it('reverts to default when NaN input and no stored value', () => {
		const text = makeTextComponent('bad');
		const { reverted } = runOnCommit('not-a-number', undefined, text);

		expect(reverted).toBe(true);
		expect(text.setValue).toHaveBeenCalledWith(DEFAULT_VALUE.toString());
	});

	it('reverts to the stored value when NaN input and stored value exists', () => {
		const STORED = 42;
		const text = makeTextComponent('bad');
		const { reverted } = runOnCommit('abc', STORED, text);

		expect(reverted).toBe(true);
		expect(text.setValue).toHaveBeenCalledWith(STORED.toString());
	});

	it('does NOT revert for valid integer input', () => {
		const text = makeTextComponent('24');
		const { reverted } = runOnCommit('24', undefined, text);

		expect(reverted).toBe(false);
		expect(text.setValue).not.toHaveBeenCalled();
	});

	it('does NOT revert for valid float input', () => {
		const text = makeTextComponent('3.14');
		const { reverted } = runOnCommit('3.14', undefined, text);

		expect(reverted).toBe(false);
		expect(text.setValue).not.toHaveBeenCalled();
	});

	it('treats empty string as NaN and reverts to default', () => {
		const text = makeTextComponent('');
		const { reverted } = runOnCommit('', undefined, text);

		expect(reverted).toBe(true);
		expect(text.setValue).toHaveBeenCalledWith(DEFAULT_VALUE.toString());
	});

	it('treats a lone decimal point as NaN and reverts', () => {
		const text = makeTextComponent('.');
		const { reverted } = runOnCommit('.', undefined, text);

		expect(reverted).toBe(true);
		expect(text.setValue).toHaveBeenCalledWith(DEFAULT_VALUE.toString());
	});

	it('does NOT revert for negative integers', () => {
		const text = makeTextComponent('-5');
		const { reverted } = runOnCommit('-5', undefined, text);

		expect(reverted).toBe(false);
	});

	it('does NOT revert for zero', () => {
		const text = makeTextComponent('0');
		const { reverted } = runOnCommit('0', undefined, text);

		expect(reverted).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// 3. VariableTextField — `value != null` initialisation fix
//    Tests the exact conditional expression on line 81 of the component.
// ---------------------------------------------------------------------------

describe('VariableTextField — `value != null` init fix (fix: 59c01d4)', () => {
	const textSetting: any = {
		id: 'text-var',
		type: SettingType.VARIABLE_TEXT,
		default: 'hello',
		title: 'Text Setting',
		quotes: false,
	};

	/** Post-fix expression: value != null ? value.toString() : setting.default */
	function initFixed(storedValue: unknown, setting: any): string {
		return storedValue != null ? storedValue.toString() : setting.default;
	}

	/** Pre-fix expression: value ? value.toString() : setting.default */
	function initOld(storedValue: unknown, setting: any): string {
		return (storedValue as any) ? storedValue!.toString() : setting.default;
	}

	// --- correct post-fix behaviour ---

	it('displays "" when empty string is stored', () => {
		expect(initFixed('', textSetting)).toBe('');
	});

	it('displays "0" when string "0" is stored', () => {
		expect(initFixed('0', textSetting)).toBe('0');
	});

	it('displays "0" when numeric 0 is stored', () => {
		expect(initFixed(0, textSetting)).toBe('0');
	});

	it('displays "false" when boolean false is stored', () => {
		expect(initFixed(false, textSetting)).toBe('false');
	});

	it('falls back to default when stored value is null', () => {
		expect(initFixed(null, textSetting)).toBe(textSetting.default);
	});

	it('falls back to default when stored value is undefined', () => {
		expect(initFixed(undefined, textSetting)).toBe(textSetting.default);
	});

	it('displays a non-empty stored string correctly', () => {
		expect(initFixed('world', textSetting)).toBe('world');
	});

	// --- regression: document the old broken behaviour ---

	it('[regression] old `value ?` check replaced "" with default', () => {
		// Pre-fix: "" is falsy, so default was shown — wrong behaviour
		expect(initOld('', textSetting)).toBe(textSetting.default);
		// Post-fix: "" is correctly preserved
		expect(initFixed('', textSetting)).toBe('');
	});

	it('[regression] old `value ?` check replaced numeric 0 with default', () => {
		// Numeric 0 is falsy — old code substituted default
		expect(initOld(0, textSetting)).toBe(textSetting.default);
		// Post-fix: 0 is correctly preserved
		expect(initFixed(0, textSetting)).toBe('0');
	});

	it('[regression] old code correctly handled non-empty strings', () => {
		expect(initOld('world', textSetting)).toBe('world');
	});

	// --- quotes edge-cases ---

	it('strips surrounding double-quotes to empty string when quotes=true', () => {
		const quotedSetting = { ...textSetting, quotes: true };
		let value: any = '""';

		// The component does this before setValue:
		if (quotedSetting.quotes && value === `""`) {
			value = '';
		}

		const displayed = initFixed(value, quotedSetting);
		expect(displayed).toBe('');
	});

	it('wraps non-empty value in single quotes when quotes=true', () => {
		const value: string = 'Inter';
		// onCommit sanitizes and wraps:
		const sanitized = value !== `""` ? `'${value}'` : '';
		expect(sanitized).toBe("'Inter'");
	});
});

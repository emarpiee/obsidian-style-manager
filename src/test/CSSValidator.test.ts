import { describe, expect, it } from 'vitest';

import { ParseLogList } from '../types';

import { CSSParser } from '../core/css/CSSParser';

describe('CSS Settings Validator and Normalizer', () => {
	const parse = (settings: any, parseLogs: ParseLogList) => {
		const str = `
/* @settings
${JSON.stringify({
	name: 'Test',
	id: 'test',
	settings: [settings],
})}
*/`;
		return CSSParser.parseCSSSettings(
			JSON.stringify({
				name: 'Test',
				id: 'test',
				settings: [settings],
			}),
			'test',
			parseLogs
		);
	};

	it('validates heading level', () => {
		const parseLogs: ParseLogList = [];
		const result = parse({ id: 'h1', type: 'heading', level: 9 }, parseLogs);
		expect((result?.settings[0] as any).level).toBe(6);
		expect(parseLogs.length).toBe(1);
		expect(parseLogs[0].message).toContain('INVALID_HEADING_LEVEL');
	});

	it('validates class-toggle default', () => {
		const parseLogs: ParseLogList = [];
		const result = parse(
			{ id: 'ct1', type: 'class-toggle', default: 'yes' },
			parseLogs
		);
		expect((result?.settings[0] as any).default).toBe(false);
		expect(parseLogs.length).toBe(1);
		expect(parseLogs[0].message).toContain('INVALID_DEFAULT');
	});

	it('validates class-select allowEmpty', () => {
		const parseLogs: ParseLogList = [];
		const result = parse({ id: 'cs1', type: 'class-select' }, parseLogs);
		expect((result?.settings[0] as any).allowEmpty).toBe(false);
		expect(parseLogs.length).toBe(1);
		expect(parseLogs[0].message).toContain('MISSING_ALLOW_EMPTY');
	});

	it('validates variable-text default', () => {
		const parseLogs: ParseLogList = [];
		const result = parse({ id: 'vt1', type: 'variable-text' }, parseLogs);
		expect((result?.settings[0] as any).default).toBe('');
		expect(parseLogs.length).toBe(1);
		expect(parseLogs[0].message).toContain('MISSING_DEFAULT');
	});

	it('validates variable-number default', () => {
		const parseLogs: ParseLogList = [];
		const result = parse({ id: 'vn1', type: 'variable-number' }, parseLogs);
		expect((result?.settings[0] as any).default).toBe(0);
		expect(parseLogs.length).toBe(1);
		expect(parseLogs[0].message).toContain('MISSING_DEFAULT');
	});

	it('validates variable-number-slider missing fields', () => {
		const parseLogs: ParseLogList = [];
		const result = parse(
			{ id: 'vns1', type: 'variable-number-slider' },
			parseLogs
		);
		const s = result?.settings[0] as any;
		expect(s.min).toBe(0);
		expect(s.max).toBe(100);
		expect(s.step).toBe(1);
		expect(s.default).toBe(0);
		expect(parseLogs[0].message).toContain('MISSING_SLIDER_FIELDS');
	});

	it('validates variable-number-slider range swap', () => {
		const parseLogs: ParseLogList = [];
		const result = parse(
			{
				id: 'vns2',
				type: 'variable-number-slider',
				min: 100,
				max: 0,
				step: 1,
				default: 50,
			},
			parseLogs
		);
		const s = result?.settings[0] as any;
		expect(s.min).toBe(0);
		expect(s.max).toBe(100);
		expect(parseLogs[0].message).toContain('INVALID_SLIDER_RANGE');
	});

	it('validates variable-number-slider step <= 0', () => {
		const parseLogs: ParseLogList = [];
		const result = parse(
			{
				id: 'vns3',
				type: 'variable-number-slider',
				min: 0,
				max: 100,
				step: -5,
				default: 50,
			},
			parseLogs
		);
		const s = result?.settings[0] as any;
		expect(s.step).toBe(1);
		expect(parseLogs.length).toBe(1);
		expect(parseLogs[0].message).toContain('INVALID_SLIDER_STEP');
	});

	it('validates variable-number-slider default clamp', () => {
		const parseLogs: ParseLogList = [];
		const result = parse(
			{
				id: 'vns4',
				type: 'variable-number-slider',
				min: 0,
				max: 100,
				step: 1,
				default: 150,
			},
			parseLogs
		);
		const s = result?.settings[0] as any;
		expect(s.default).toBe(100);
		expect(parseLogs.length).toBe(1);
		expect(parseLogs[0].message).toContain('INVALID_SLIDER_DEFAULT');
	});

	it('validates variable-color missing/invalid format', () => {
		const parseLogs: ParseLogList = [];
		const result = parse(
			{ id: 'vc1', type: 'variable-color', format: 'cmyk' },
			parseLogs
		);
		expect((result?.settings[0] as any).format).toBe('hex');
		expect(parseLogs[0].message).toContain('UNSUPPORTED_COLOR_FORMAT');
	});

	it('validates variable-color oklch format', () => {
		const parseLogs: ParseLogList = [];
		const result = parse(
			{ id: 'vc2', type: 'variable-color', format: 'oklch', default: '#' },
			parseLogs
		);
		expect((result?.settings[0] as any).format).toBe('oklch');
		expect(parseLogs.length).toBe(0);
	});

	it('validates variable-themed-color missing defaults', () => {
		const parseLogs: ParseLogList = [];
		const result = parse(
			{ id: 'vtc1', type: 'variable-themed-color', format: 'hex' },
			parseLogs
		);
		const s = result?.settings[0] as any;
		expect(s['default-light']).toBe('#');
		expect(s['default-dark']).toBe('#');
		expect(parseLogs[0].message).toContain('MISSING_THEMED_COLOR_FIELDS');
	});

	it('validates variable-select default', () => {
		const parseLogs: ParseLogList = [];
		const result = parse({ id: 'vs1', type: 'variable-select' }, parseLogs);
		expect((result?.settings[0] as any).default).toBe('');
		expect(parseLogs[0].message).toContain('MISSING_DEFAULT');
	});

	it('validates color-gradient fields', () => {
		const parseLogs: ParseLogList = [];
		const result = parse({ id: 'cg1', type: 'color-gradient' }, parseLogs);
		const s = result?.settings[0] as any;
		expect(s.from).toBe('');
		expect(s.to).toBe('');
		expect(s.format).toBe('hex');
		expect(s.step).toBe(1);
		expect(parseLogs[0].message).toContain('MISSING_GRADIENT_FIELDS');
	});

	it('validates color-gradient step', () => {
		const parseLogs: ParseLogList = [];
		const result = parse(
			{
				id: 'cg2',
				type: 'color-gradient',
				from: '#fff',
				to: '#000',
				format: 'hex',
				step: -1,
			},
			parseLogs
		);
		const s = result?.settings[0] as any;
		expect(s.step).toBe(1);
		expect(parseLogs[0].message).toContain('INVALID_GRADIENT_STEP');
	});
});

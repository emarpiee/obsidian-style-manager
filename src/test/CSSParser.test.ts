import { describe, expect, it, vi } from 'vitest';

import { CSSParser } from '../core/css/CSSParser';
import { ParseLogList, FALLBACK_COLOR, VariableColor, VariableThemedColor } from '../types';

describe('CSSParser', () => {
	describe('parseCSSSettings', () => {
		it('should parse valid YAML settings', () => {
			const yamlStr = `
name: My Theme
id: my-theme
settings:
  - id: accent-color
    title: Accent Color
    type: variable-color
    default: "#ff0000"
`;
			const result = CSSParser.parseCSSSettings(yamlStr, 'test.css');
			expect(result).toBeDefined();
			expect(result?.name).toBe('My Theme');
			expect(result?.id).toBe('my-theme');
			expect(result?.settings.length).toBe(1);
			expect(result?.settings[0].id).toBe('accent-color');
		});

		it('should throw INVALID_DEFAULT warning and fallback for invalid variable-color default', () => {
			const yamlStr = `
name: Color Test
id: color-test
settings:
  - id: invalid-color
    type: variable-color
    format: hex
    default: "invalid-color-value"
`;
			const parseLogs: ParseLogList = [];
			const result = CSSParser.parseCSSSettings(yamlStr, 'test.css', parseLogs);
			expect((result?.settings[0] as VariableColor).default).toBe(FALLBACK_COLOR);
			expect(parseLogs).toContainEqual(expect.objectContaining({
				message: expect.stringContaining('INVALID_DEFAULT'),
				settingId: 'invalid-color',
			}));
		});

		it('should not throw warning for valid variable-color defaults', () => {
			const validColors = ['#ffffff', 'rgb(255,255,255)', 'hsl(0,0%,100%)', 'var(--some-var)', 'transparent'];
			for (const color of validColors) {
				const yamlStr = `
name: Valid Color
id: valid-color
settings:
  - id: test-color
    type: variable-color
    format: hex
    default: "${color}"
`;
				const parseLogs: ParseLogList = [];
				CSSParser.parseCSSSettings(yamlStr, 'test.css', parseLogs);
				expect(parseLogs.filter(log => log.message.includes('INVALID_DEFAULT')).length).toBe(0);
			}
		});

		it('should throw MISSING_DEFAULT warning and fallback for missing variable-color default', () => {
			const yamlStr = `
name: Color Test
id: color-test
settings:
  - id: missing-color
    type: variable-color
    format: hex
`;
			const parseLogs: ParseLogList = [];
			const result = CSSParser.parseCSSSettings(yamlStr, 'test.css', parseLogs);
			expect((result?.settings[0] as VariableColor).default).toBe(FALLBACK_COLOR);
			expect(parseLogs).toContainEqual(expect.objectContaining({
				message: expect.stringContaining('MISSING_DEFAULT'),
				settingId: 'missing-color',
			}));
		});

		it('should throw INVALID_DEFAULT warning and fallback for invalid variable-themed-color defaults', () => {
			const yamlStr = `
name: Themed Color Test
id: themed-color-test
settings:
  - id: themed-color
    type: variable-themed-color
    default-light: "invalid-light"
    default-dark: "#000000"
`;
			const parseLogs: ParseLogList = [];
			const result = CSSParser.parseCSSSettings(yamlStr, 'test.css', parseLogs);
			expect((result?.settings[0] as VariableThemedColor)['default-light']).toBe(FALLBACK_COLOR);
			expect((result?.settings[0] as VariableThemedColor)['default-dark']).toBe('#000000');
			expect(parseLogs).toContainEqual(expect.objectContaining({
				message: expect.stringContaining('INVALID_DEFAULT'),
				settingId: 'themed-color',
			}));
		});

		it('should throw MISSING_THEMED_COLOR_FIELD warning and fallback for missing themed-color fields', () => {
			const yamlStr = `
name: Themed Color Test
id: themed-color-test
settings:
  - id: themed-color
    type: variable-themed-color
    default-light: "#ffffff"
`;
			const parseLogs: ParseLogList = [];
			const result = CSSParser.parseCSSSettings(yamlStr, 'test.css', parseLogs);
			expect((result?.settings[0] as VariableThemedColor)['default-dark']).toBe(FALLBACK_COLOR);
			expect(parseLogs).toContainEqual(expect.objectContaining({
				message: expect.stringContaining('MISSING_THEMED_COLOR_FIELD'),
				settingId: 'themed-color',
			}));
		});


		it('should return undefined if settings property is missing', () => {
			const yamlStr = `
name: Invalid
id: invalid
`;
			const result = CSSParser.parseCSSSettings(yamlStr, 'test.css');
			expect(result).toBeUndefined();
		});

		it('should return undefined if settings property is not an array', () => {
			const yamlStr = `
name: Invalid
id: invalid
settings: "not-an-array"
`;
			const result = CSSParser.parseCSSSettings(yamlStr, 'test.css');
			expect(result).toBeUndefined();
		});

		it('should return undefined if yaml parses to a non-object', () => {
			const yamlStr = `just a string`;
			const result = CSSParser.parseCSSSettings(yamlStr, 'test.css');
			expect(result).toBeUndefined();
		});

		it('should filter out null/undefined settings in the list', () => {
			const yamlStr = `
name: Filter Test
id: filter-test
settings:
  - id: valid
    type: variable-text
    default: "ok"
  - 
  - null
`;
			const result = CSSParser.parseCSSSettings(yamlStr, 'test.css');
			expect(result?.settings.length).toBe(1);
			expect(result?.settings[0].id).toBe('valid');
		});

		it('should handle tabs by converting them to spaces', () => {
			const yamlStr = `
name: Tabbed
id: tabbed
settings:
\t- id: test
\t  type: variable-text
\t  default: "value"
`;
			const result = CSSParser.parseCSSSettings(yamlStr, 'test.css');
			expect(result).toBeDefined();
			expect(result?.name).toBe('Tabbed');
		});
	});

	describe('parseCSSText', () => {
		it('should return empty result if no settings blocks are found', () => {
			const { settingsList, parseLogs } = CSSParser.parseCSSText(
				'body { color: red; }'
			);
			expect(settingsList).toEqual([]);
			expect(parseLogs).toEqual([]);
		});
	});

	describe('parseCSS', () => {
		it('should extract settings from CSS comments', () => {
			const cssContent = `
/* @settings
name: CSS Settings
id: css-settings
settings:
  - id: test-var
    type: variable-number
    default: 10
*/
body { color: red; }
`;
			const mockSheet = {
				ownerNode: {
					textContent: cssContent,
				},
			} as unknown as CSSStyleSheet;

			const { settingsList, parseLogs } = CSSParser.parseCSS(mockSheet);
			expect(parseLogs.length).toBe(0);
			expect(settingsList.length).toBe(1);
			expect(settingsList[0].name).toBe('CSS Settings');
		});

		it('should exclude blocks missing required properties (name, id, or settings)', () => {
			const cssContent = `
/* @settings
id: no-name
settings:
  - id: v
*/
/* @settings
name: No ID
settings:
  - id: v
*/
/* @settings
name: No Settings
id: no-settings
settings: []
*/
`;
			const mockSheet = {
				ownerNode: {
					textContent: cssContent,
				},
			} as unknown as CSSStyleSheet;

			const { settingsList } = CSSParser.parseCSS(mockSheet);
			expect(settingsList.length).toBe(0);
		});

		it('should handle "important" comments (!*)', () => {
			const cssContent = `
/*! @settings
name: Important Settings
id: imp-settings
settings:
  - id: imp-var
    type: variable-text
    default: "important"
*/
`;
			const mockSheet = {
				ownerNode: {
					textContent: cssContent,
				},
			} as unknown as CSSStyleSheet;

			const { settingsList, parseLogs } = CSSParser.parseCSS(mockSheet);
			expect(parseLogs.length).toBe(0);
			expect(settingsList.length).toBe(1);
			expect(settingsList[0].name).toBe('Important Settings');
		});

		it('should ignore @settings outside of comments', () => {
			const cssContent = `
@settings
name: Outside
id: outside
settings:
  - id: var
    type: variable-text
    default: "no"
`;
			const mockSheet = {
				ownerNode: {
					textContent: cssContent,
				},
			} as unknown as CSSStyleSheet;

			const { settingsList } = CSSParser.parseCSS(mockSheet);
			expect(settingsList.length).toBe(0);
		});

		it('should handle empty, null, or incomplete input gracefully', () => {
			expect(CSSParser.parseCSS(null as any)).toEqual({
				settingsList: [],
				parseLogs: [],
			});

			const mockNoOwner = {
				ownerNode: null,
			} as unknown as CSSStyleSheet;
			expect(CSSParser.parseCSS(mockNoOwner)).toEqual({
				settingsList: [],
				parseLogs: [],
			});

			const mockEmptySheet = {
				ownerNode: {
					textContent: '',
				},
			} as unknown as CSSStyleSheet;
			expect(CSSParser.parseCSS(mockEmptySheet)).toEqual({
				settingsList: [],
				parseLogs: [],
			});
		});

		it('should handle multiple settings blocks in one file', () => {
			const cssContent = `
/* @settings
name: Block 1
id: block-1
settings:
  - id: var-1
    type: variable-text
    default: "a"
*/

/* @settings
name: Block 2
id: block-2
settings:
  - id: var-2
    type: variable-text
    default: "b"
*/
`;
			const mockSheet = {
				ownerNode: {
					textContent: cssContent,
				},
			} as unknown as CSSStyleSheet;

			const { settingsList, parseLogs } = CSSParser.parseCSS(mockSheet);
			expect(parseLogs.length).toBe(0);
			expect(settingsList.length).toBe(2);
			expect(settingsList[0].name).toBe('Block 1');
			expect(settingsList[1].name).toBe('Block 2');
		});

		it('should capture errors with correct name attribution', () => {
			const cssContent = `
/* @settings
name: Named Broken
id: named-broken
settings:
  - id: test
    type: : : : broken
*/
/* @settings
id: unnamed-broken
settings:
  - id: test
    type: : : : broken
*/
`;
			const mockSheet = {
				ownerNode: {
					textContent: cssContent,
				},
			} as unknown as CSSStyleSheet;

			const { parseLogs } = CSSParser.parseCSS(mockSheet);
			expect(parseLogs.length).toBe(2);
			expect(parseLogs[0].name).toBe('Named Broken');
			expect(parseLogs[1].name).toBe('Unknown');
		});

		it('should be robust against unusual spacing and newlines', () => {
			const cssContent = `
/*   @settings

name: Spaced Out
id: spaced-out

settings:
  - id: v
    type: text
    default: "ok"

*/
`;
			const mockSheet = {
				ownerNode: {
					textContent: cssContent,
				},
			} as unknown as CSSStyleSheet;

			const { settingsList } = CSSParser.parseCSS(mockSheet);
			expect(settingsList.length).toBe(1);
			expect(settingsList[0].name).toBe('Spaced Out');
		});
	});

	describe('Cache and LRU', () => {
		it('should return identical results for identical CSS text (Cache Hit)', () => {
			const cssContent = `/* @settings\nname: Cache\nid: cache\nsettings:\n  - id: v\n    type: text\n    default: a\n*/`;

			const res1 = CSSParser.parseCSSText(cssContent);
			const res2 = CSSParser.parseCSSText(cssContent);

			expect(res1).toEqual(res2);
			// Since isolation works, they are not the same object, but have same values
			expect(res1).not.toBe(res2);
		});

		it('should return independent objects from cache to prevent mutation leakage', () => {
			const cssContent = `
/* @settings
name: Isolation Test
id: iso-test
settings:
  - id: test-var
    type: variable-number
    default: 1
*/
`;
			const mockSheet = {
				ownerNode: {
					textContent: cssContent,
				},
			} as unknown as CSSStyleSheet;

			// First parse
			const result1 = CSSParser.parseCSS(mockSheet);
			expect(result1.settingsList[0].settings.length).toBe(1);

			// Mutate result1
			result1.settingsList[0].settings.push({
				id: 'mutated',
				type: 'variable-text' as any,
				title: 'Mutated',
				default: 'X',
			});
			expect(result1.settingsList[0].settings.length).toBe(2);

			// Second parse (should be from cache)
			const result2 = CSSParser.parseCSS(mockSheet);
			// If isolation works, result2 should still have only 1 setting
			expect(result2.settingsList[0].settings.length).toBe(1);
			expect(result2.settingsList[0].settings[0].id).toBe('test-var');
		});

		it('should demonstrate that only shallow copy of settings is performed', () => {
			const cssContent = `
/* @settings
name: Shallow Test
id: shallow-test
settings:
  - id: nested
    type: heading
    meta: { value: 1 }
*/
`;
			const mockSheet = {
				ownerNode: {
					textContent: cssContent,
				},
			} as unknown as CSSStyleSheet;

			const result1 = CSSParser.parseCSS(mockSheet);

			// Mutate nested object
			(result1.settingsList[0].settings[0] as any).meta.value = 2;

			const result2 = CSSParser.parseCSS(mockSheet);
			// Since it's a shallow copy of the settings array,
			// the objects INSIDE the array are shared by reference.
			expect((result2.settingsList[0].settings[0] as any).meta.value).toBe(2);
		});

		it('should evict the oldest entry when cache size exceeds 200 (LRU)', () => {
			const cache = (CSSParser as any).parseCache;
			cache.clear();

			// Fill cache to 200
			for (let i = 0; i < 200; i++) {
				CSSParser.parseCSSText(`text-${i}`);
			}
			expect(cache.size).toBe(200);

			// Add 201st
			CSSParser.parseCSSText('text-201');
			expect(cache.size).toBe(200);

			// text-0 should be evicted
			expect(cache.has('text-0')).toBe(false);
			expect(cache.has('text-201')).toBe(true);
		});

		it('should refresh the position of an entry on access (LRU)', () => {
			const cache = (CSSParser as any).parseCache;
			cache.clear();

			// Fill cache with 2 entries
			CSSParser.parseCSSText('text-0');
			CSSParser.parseCSSText('text-1');

			// Access text-0 to move it to the end (most recent)
			CSSParser.parseCSSText('text-0');

			// Now text-1 is the oldest.
			// We need to fill it to 200 to trigger eviction of text-1.
			for (let i = 2; i < 201; i++) {
				CSSParser.parseCSSText(`text-${i}`);
			}

			expect(cache.size).toBe(200);
			expect(cache.has('text-1')).toBe(false); // Should be evicted
			expect(cache.has('text-0')).toBe(true); // Should be kept
		});
	});

	describe('parseMetadata', () => {
		it('should parse simple metadata', () => {
			const css = `
/* @metadata
description: This snippet simplifies the UI.
author: Jane Doe
version: 1.0.0
*/
body { color: red; }
            `;
			const metadata = CSSParser.parseMetadata(css);
			expect(metadata).toBeDefined();
			expect(metadata?.author).toBe('Jane Doe');
			expect(metadata?.version).toBe('1.0.0');
		});

		it('should handle tabs by converting them to spaces', () => {
			const css = `
/* @metadata
description: Tabbed description
author: \tJane Doe
version: \t1.0.0
*/
`;
			const metadata = CSSParser.parseMetadata(css);
			expect(metadata).toBeDefined();
			expect(metadata?.author).toBe('Jane Doe');
			expect(metadata?.version).toBe('1.0.0');
		});

		it('should return only the first metadata block if multiple exist', () => {
			const css = `
/* @metadata
author: First
*/
/* @metadata
author: Second
*/
`;
			const metadata = CSSParser.parseMetadata(css);
			expect(metadata?.author).toBe('First');
		});

		it('should handle "important" comments (!*)', () => {
			const css = `
/*! @metadata
description: Important metadata
author: Admin
version: 2.0.0
*/
body { color: blue; }
            `;
			const metadata = CSSParser.parseMetadata(css);
			expect(metadata).toBeDefined();
			expect(metadata?.author).toBe('Admin');
		});

		it('should return undefined if no metadata block exists', () => {
			const css = `body { color: blue; }`;
			const metadata = CSSParser.parseMetadata(css);
			expect(metadata).toBeUndefined();
		});

		it('should handle malformed YAML gracefully', () => {
			const css = `
/* @metadata
author: [unclosed bracket
*/
            `;
			const metadata = CSSParser.parseMetadata(css);
			expect(metadata).toBeUndefined();
		});
	});
});

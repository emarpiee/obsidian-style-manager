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
import { describe, expect, it } from 'vitest';

import { CSSParser } from '../core/css/CSSParser';

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

		it('should return undefined if settings property is missing', () => {
			const yamlStr = `
name: Invalid
id: invalid
`;
			const result = CSSParser.parseCSSSettings(yamlStr, 'test.css');
			expect(result).toBeUndefined();
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

			const { settingsList, errorList } = CSSParser.parseCSS(mockSheet);
			expect(errorList.length).toBe(0);
			expect(settingsList.length).toBe(1);
			expect(settingsList[0].name).toBe('CSS Settings');
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

			const { settingsList, errorList } = CSSParser.parseCSS(mockSheet);
			expect(errorList.length).toBe(0);
			expect(settingsList.length).toBe(2);
			expect(settingsList[0].name).toBe('Block 1');
			expect(settingsList[1].name).toBe('Block 2');
		});

		it('should capture errors for malformed YAML', () => {
			const cssContent = `
/* @settings
name: Broken
id: broken
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

			const { settingsList, errorList } = CSSParser.parseCSS(mockSheet);
			expect(settingsList.length).toBe(0);
			expect(errorList.length).toBe(1);
			expect(errorList[0].name).toBe('Broken');
		});
	});

	describe('Cache Isolation', () => {
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

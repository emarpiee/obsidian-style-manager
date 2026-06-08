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
import { EditorView } from '@codemirror/view';

/**
 * Definition for an injectable style block.
 */
export interface StyleBlockDefinition {
	id: string;
	label: string;
	icon: string;
	position: 'top' | 'bottom' | 'cursor';
	allowDuplicates: boolean;
	template: string;
	group: 'meta' | 'field';
}

/**
 * Service for injecting pre-defined code blocks (@metadata, @settings) into CSS.
 */
export class StyleBlockService {
	private readonly blocks: StyleBlockDefinition[] = [
		{
			id: 'metadata',
			label: 'Add @metadata block',
			icon: 'tags',
			position: 'top',
			allowDuplicates: false,
			group: 'meta',
			template: `/* @metadata
description: 
author: 
version: 1.0.0
authorUrl: 
license: 
*/`,
		},
		{
			id: 'settings',
			label: 'Add @settings block',
			icon: 'file-code',
			position: 'bottom',
			allowDuplicates: true,
			group: 'meta',
			template: `/* @settings

name: 
id: 
settings:
    - 
        id: 
        title: 
        description: 
        type: heading
        level: 1
        collapsed: false
*/`,
		},
		{
			id: 'heading',
			label: 'Heading',
			icon: 'heading',
			position: 'cursor',
			allowDuplicates: true,
			group: 'field',
			template: `    - 
        id: 
        title: 
        description: 
        type: heading
        level: 1
        collapsed: false`,
		},
		{
			id: 'info-text',
			label: 'Info Text',
			icon: 'info',
			position: 'cursor',
			allowDuplicates: true,
			group: 'field',
			template: `    - 
        id: 
        title: 
        description: 
        type: info-text
        markdown: true`,
		},
		{
			id: 'class-toggle',
			label: 'Class Toggle',
			icon: 'toggle-right',
			position: 'cursor',
			allowDuplicates: true,
			group: 'field',
			template: `    - 
        id: 
        title: 
        description: 
        type: class-toggle
        default: false
        addCommand: true`,
		},
		{
			id: 'class-select',
			label: 'Class Select',
			icon: 'list',
			position: 'cursor',
			allowDuplicates: true,
			group: 'field',
			template: `    - 
        id: 
        title: 
        description: 
        type: class-select
        allowEmpty: false
        default: 
        options:
            - 
                label: 
                value: `,
		},
		{
			id: 'variable-text',
			label: 'Variable Text',
			icon: 'type',
			position: 'cursor',
			allowDuplicates: true,
			group: 'field',
			template: `    - 
        id: 
        title: 
        description: 
        type: variable-text
        default: 
        quotes: true`,
		},
		{
			id: 'variable-number',
			label: 'Variable Number',
			icon: 'hash',
			position: 'cursor',
			allowDuplicates: true,
			group: 'field',
			template: `    - 
        id: 
        title: 
        description: 
        type: variable-number
        default: 0
        format: px`,
		},
		{
			id: 'variable-number-slider',
			label: 'Variable Number Slider',
			icon: 'sliders-horizontal',
			position: 'cursor',
			allowDuplicates: true,
			group: 'field',
			template: `    - 
        id: 
        title: 
        description: 
        type: variable-number-slider
        default: 0
        min: 0
        max: 100
        step: 1
        format: px`,
		},
		{
			id: 'variable-select',
			label: 'Variable Select',
			icon: 'list-checks',
			position: 'cursor',
			allowDuplicates: true,
			group: 'field',
			template: `    - 
        id: 
        title: 
        description: 
        type: variable-select
        default: 
        quotes: true
        options:
            - 
                label: 
                value: `,
		},
		{
			id: 'variable-color',
			label: 'Variable Color',
			icon: 'palette',
			position: 'cursor',
			allowDuplicates: true,
			group: 'field',
			template: `    - 
        id: 
        title: 
        description: 
        type: variable-color
        format: hex
        opacity: true
        alt-format:
            -
                id: 
                format: rgb
        default: '#007AFF'`,
		},
		{
			id: 'variable-themed-color',
			label: 'Variable Themed Color',
			icon: 'contrast',
			position: 'cursor',
			allowDuplicates: true,
			group: 'field',
			template: `    - 
        id: 
        title: 
        description: 
        type: variable-themed-color
        format: hex
        opacity: true
        alt-format:
            -
                id: 
                format: rgb
        default-light: '#007AFF'
        default-dark: '#007AFF'`,
		},
		{
			id: 'color-gradient',
			label: 'Color Gradient',
			icon: 'rainbow',
			position: 'cursor',
			allowDuplicates: true,
			group: 'field',
			template: `    - 
        id: 
        title: 
        description: 
        type: color-gradient
        from: 
        to: 
        step: 10
        format: hex
        pad: 2`,
		},
	];

	/**
	 * Returns the list of available blocks.
	 */
	public getAvailableBlocks(): StyleBlockDefinition[] {
		return this.blocks;
	}

	/**
	 * Injects a block of code into the editor.
	 * @param view The CodeMirror EditorView instance.
	 * @param blockId The ID of the block to inject.
	 */
	public injectBlock(view: EditorView, blockId: string): void {
		const block = this.blocks.find((b) => b.id === blockId);
		if (!block) return;

		const doc = view.state.doc.toString();

		// Check if block already exists if duplicates are not allowed
		if (!block.allowDuplicates && doc.includes(`@${block.id}`)) {
			return;
		}

		let insertPos = 0;
		let insertContent = block.template;

		if (block.position === 'top') {
			insertPos = 0;
			insertContent = insertContent + '\n\n';
		} else if (block.position === 'bottom') {
			insertPos = view.state.doc.length;
			insertContent = '\n\n' + insertContent;
		} else if (block.position === 'cursor') {
			insertPos = view.state.selection.main.head;
			// Add spacing if needed
			const line = view.state.doc.lineAt(insertPos);
			if (line.text.trim().length > 0) {
				insertContent = '\n' + insertContent;
			}
		}

		// Perform the injection
		view.dispatch({
			changes: { from: insertPos, insert: insertContent },
			selection: { anchor: insertPos + insertContent.length }, // Place cursor at the end of inserted content
			scrollIntoView: true,
		});

		// Focus the editor
		view.focus();

		// Specific cursor placement for templates with "id: "
		if (insertContent.includes('id: ')) {
			const idOffset = insertContent.indexOf('id: ') + 'id: '.length;
			const absoluteIdPos = insertPos + idOffset;
			view.dispatch({
				selection: { anchor: absoluteIdPos, head: absoluteIdPos },
			});
		}
	}
}

import { EditorView } from '@codemirror/view';

import {
	SETTINGS_BLOCK_COMPONENT_SPACES_KEY,
	SETTINGS_BLOCK_DASH_SPACES_KEY,
} from '../constants';
import type StyleManagerPlugin from '../main';

import { settingRegExp } from '../utils/CommonUtils';

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
	constructor(private plugin: StyleManagerPlugin) {}

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
        opacity: false
        default: '#'`,
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
        opacity: false
        default-light: '#'
        default-dark: '#'`,
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
		const dashCount =
			(this.plugin.settingsService.getSetting(
				SETTINGS_BLOCK_DASH_SPACES_KEY
			) as number) ?? 4;
		const compCount =
			(this.plugin.settingsService.getSetting(
				SETTINGS_BLOCK_COMPONENT_SPACES_KEY
			) as number) ?? 8;

		const dashStr = ' '.repeat(dashCount) + '- ';
		const compStr = ' '.repeat(compCount);

		return this.blocks.map((block) => {
			if (block.group === 'field' || block.id === 'settings') {
				let template = block.template.replace(/ {4}- /g, dashStr);
				template = template.replace(/ {8}/g, compStr);
				return { ...block, template };
			}
			return block;
		});
	}

	/**
	 * Injects a block of code into the editor.
	 * @param view The CodeMirror EditorView instance.
	 * @param blockId The ID of the block to inject.
	 */
	public injectBlock(view: EditorView, blockId: string): void {
		const blocks = this.getAvailableBlocks();
		const block = blocks.find((b) => b.id === blockId);
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
			if (block.group === 'field') {
				const cursorPos = view.state.selection.main.head;
				const matches = Array.from(doc.matchAll(settingRegExp));

				let targetBlock = null;
				for (const match of matches) {
					if (
						cursorPos >= match.index &&
						cursorPos <= match.index + match[0].length
					) {
						targetBlock = match;
						break;
					}
				}

				if (!targetBlock && matches.length > 0) {
					targetBlock =
						matches.find((m) => m.index > cursorPos) ||
						matches[matches.length - 1];
				}

				if (targetBlock) {
					const blockStart = targetBlock.index;
					const blockEnd = blockStart + targetBlock[0].length;
					const blockContent = targetBlock[0];

					// Find all field starts within this block
					const dashCount =
						(this.plugin.settingsService.getSetting(
							SETTINGS_BLOCK_DASH_SPACES_KEY
						) as number) ?? 4;
					const fieldRegExp = new RegExp(`^ {${dashCount}}- `, 'gm');
					let match;
					const fieldStarts: number[] = [];
					while ((match = fieldRegExp.exec(blockContent)) !== null) {
						fieldStarts.push(blockStart + match.index);
					}

					// Find which field the cursor is in
					let currentFieldIdx = -1;
					for (let i = 0; i < fieldStarts.length; i++) {
						const start = fieldStarts[i];
						const end =
							i < fieldStarts.length - 1 ? fieldStarts[i + 1] : blockEnd;
						if (cursorPos >= start && cursorPos <= end) {
							currentFieldIdx = i;
							break;
						}
					}

					if (currentFieldIdx !== -1) {
						const fieldStart = fieldStarts[currentFieldIdx];
						const line = view.state.doc.lineAt(cursorPos);

						// If cursor is on the same line as the field start and to the left of the dash
						if (
							line.from <= fieldStart &&
							line.to >= fieldStart &&
							cursorPos <= fieldStart + dashCount
						) {
							insertPos = fieldStart;
						} else {
							// Insert after the current field
							const nextFieldStart =
								currentFieldIdx < fieldStarts.length - 1
									? fieldStarts[currentFieldIdx + 1]
									: blockEnd;
							insertPos =
								nextFieldStart === blockEnd ? blockEnd - 2 : nextFieldStart;
						}
					} else {
						// Cursor not in any field
						if (fieldStarts.length > 0 && cursorPos < fieldStarts[0]) {
							// Insert before the first field
							insertPos = fieldStarts[0];
						} else {
							// Insert at the end of the block (before */)
							insertPos = blockEnd - 2;
						}
					}

					// Ensure there's a newline before the new field, but only one.
					const charBefore = doc[insertPos - 1];
					const prefix = charBefore === '\n' ? '' : '\n';

					// Ensure there's a newline after the new field so it doesn't merge with the next one.
					const suffix = '\n';

					insertContent = prefix + insertContent + suffix;
				} else {
					insertPos = cursorPos;
					const line = view.state.doc.lineAt(insertPos);
					if (line.text.trim().length > 0) {
						insertContent = '\n' + insertContent;
					}
				}
			} else {
				insertPos = view.state.selection.main.head;
				// Add spacing if needed
				const line = view.state.doc.lineAt(insertPos);
				if (line.text.trim().length > 0) {
					insertContent = '\n' + insertContent;
				}
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

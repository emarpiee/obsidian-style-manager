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
import { LoremUnit, loremIpsum } from 'lorem-ipsum';
import { Notice, setIcon, setTooltip } from 'obsidian';

import StyleManagerPlugin from '../../main';

export type LoremIpsumUnit = LoremUnit;

interface RenderOptions {
	plugin?: StyleManagerPlugin;
	onOpenInTab?: () => void;
}

export class LoremIpsumGenerator {
	private container: HTMLElement;
	private unitSelect: HTMLSelectElement;
	private inputEl: HTMLInputElement;
	private outputEl: HTMLTextAreaElement;
	private generateBtn: HTMLButtonElement;
	private copyBtn: HTMLButtonElement;

	private generateHandler = (): void => this.generate();
	private copyHandler = async (): Promise<void> => await this.copy();
	private enterHandler = (e: KeyboardEvent): void => {
		if (e.key === 'Enter') this.generate();
	};

	render(container: HTMLElement, options: RenderOptions = {}): void {
		const { plugin, onOpenInTab } = options;
		this.container = container;
		this.container.empty();
		this.container.addClass('style-manager-tool-lorem-ipsum-generator');
		const controls = this.container.createDiv({
			cls: 'style-manager-tool-lorem-ipsum-controls',
		});

		this.generateBtn = controls.createEl('button', {
			text: 'Generate',
			cls: 'mod-cta',
		});

		// Amount Input
		this.inputEl = controls.createEl('input', {
			type: 'number',
			attr: {
				value: '7',
				min: '1',
				max: '10000',
				class: 'style-manager-tool-lorem-ipsum-input',
			},
		});

		// Unit Selection
		this.unitSelect = controls.createEl('select');
		const units: { label: string; value: LoremIpsumUnit }[] = [
			{ label: 'Paragraphs', value: 'paragraphs' },
			{ label: 'Sentences', value: 'sentences' },
			{ label: 'Words', value: 'words' },
		];
		units.forEach(({ label, value }) => {
			this.unitSelect.createEl('option', { text: label, attr: { value } });
		});

		this.copyBtn = controls.createEl('button', {
			text: 'Copy',
			attr: { style: 'display: none;' },
		});

		if (plugin) {
			const openInTabBtn = controls.createDiv({
				cls: 'clickable-icon',
			});
			setIcon(openInTabBtn, 'external-link');
			setTooltip(openInTabBtn, 'Open this tool in a tab');
			openInTabBtn.onclick = async (): Promise<void> => {
				await plugin.activateLoremIpsumView();
				if (onOpenInTab) {
					onOpenInTab();
				}
			};
		}

		// Output Area
		this.outputEl = this.container.createEl('textarea', {
			attr: {
				class: 'style-manager-tool-lorem-ipsum-output',
				readOnly: 'true',
				rows: '10',
			},
		});

		// Events
		this.generateBtn.addEventListener('click', this.generateHandler);
		this.copyBtn.addEventListener('click', this.copyHandler);
		this.inputEl.addEventListener('keydown', this.enterHandler);
	}

	private generate(): void {
		const unit = this.unitSelect.value as LoremIpsumUnit;
		const count = Math.max(
			1,
			Math.min(1000, parseInt(this.inputEl.value) || 3)
		);

		const text = loremIpsum({
			count,
			units: unit,
		});

		this.outputEl.value = text;
		this.copyBtn.style.display = 'inline-block';
	}

	private async copy(): Promise<void> {
		const text = this.outputEl.value;
		if (!text) return;

		try {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(text);
			} else {
				// Fallback
				this.outputEl.select();
				document.execCommand('copy');
			}
			new Notice('Lorem ipsum copied to clipboard');
		} catch (err) {
			new Notice('Failed to copy text to clipboard');
			console.error('Clipboard error:', err);
		}
	}

	destroy(): void {
		this.generateBtn.removeEventListener('click', this.generateHandler);
		this.copyBtn.removeEventListener('click', this.copyHandler);
		this.inputEl.removeEventListener('keydown', this.enterHandler);
		this.container.empty();
	}
}

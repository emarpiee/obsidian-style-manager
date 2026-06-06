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
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

    You should have received a copy of the GNU General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import Pickr from '@simonwep/pickr';
import chroma from 'chroma-js';
import { ItemView, WorkspaceLeaf, Notice, Setting, setIcon, setTooltip } from 'obsidian';

import { getPickrSettings } from '../../utils/UIUtils';

export const colorContrastViewType = 'style-manager-color-contrast-view';

export class ColorContrastCheckerView extends ItemView {
	private fgColor = '#FFFFFF';
	private bgColor = '#7A3198';
	private fgPickr: Pickr | null = null;
	private bgPickr: Pickr | null = null;
	private fgSetting: Setting;
	private bgSetting: Setting;
	private fgSingle: HTMLElement;
	private bgSingle: HTMLElement;
	private previewEl: HTMLElement;
	private normalTextPreviewEl: HTMLElement;
	private largeTextPreviewEl: HTMLElement;
	private resultsEl: HTMLElement;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	onload(): void {
		const { contentEl } = this;

		contentEl.addClass('modal-style-manager');
		contentEl.addClass('style-manager-color-contrast-modal');

		const actionsDiv = contentEl.createDiv({
			cls: 'style-manager-tool-contrast-actions',
		});

		const swapBtn = actionsDiv.createEl('button');
		setIcon(swapBtn, 'repeat');
		swapBtn.createSpan({ text: 'Swap' });
		setTooltip(swapBtn, 'Swap the FG and BG color');
		swapBtn.onclick = (): void => this.swapColors();

		const randomBtn = actionsDiv.createEl('button');
		setIcon(randomBtn, 'dice');
		randomBtn.createSpan({ text: 'Random' });
		setTooltip(randomBtn, 'Randomize FG and BG color');
		randomBtn.onclick = (): void => this.randomizeColors();

		const suggestBtn = actionsDiv.createEl('button');
		setIcon(suggestBtn, 'wand-2');
		suggestBtn.createSpan({ text: 'Suggest' });
		setTooltip(suggestBtn, 'Suggest passing colors');
		suggestBtn.onclick = (): void => this.suggestAccessibleColors();

		const suggestFgBtn = actionsDiv.createEl('button');
		setIcon(suggestFgBtn, 'wand-2');
		suggestFgBtn.createSpan({ text: 'Suggest FG' });
		setTooltip(suggestFgBtn, 'Suggest passing foreground color');
		suggestFgBtn.onclick = (): void => this.suggestForegroundColor();

		const suggestBgBtn = actionsDiv.createEl('button');
		setIcon(suggestBgBtn, 'wand-2');
		suggestBgBtn.createSpan({ text: 'Suggest BG' });
		setTooltip(suggestBgBtn, 'Suggest passing background color');
		suggestBgBtn.onclick = (): void => this.suggestBackgroundColor();

		this.fgSetting = new Setting(contentEl)
			.setClass('style-manager-tool-contrast-color-row')
			.setName('Foreground color')
			.setDesc('Text or icon color');

		const fgWrapper = this.fgSetting.controlEl.createDiv({
			cls: 'single-color-wrapper',
		});
		this.fgSingle = fgWrapper.createDiv({ cls: 'single-color' });
		this.fgSingle.style.setProperty('--pcr-color', this.fgColor);

		const fgCopyBtn = fgWrapper.createEl('button');
		setIcon(fgCopyBtn, 'copy');
		setTooltip(fgCopyBtn, 'Copy');
		fgCopyBtn.onclick = async (): Promise<void> => {
			await this.copyToClipboard(this.fgColor);
			new Notice('Copied!');
		};

		this.fgPickr = Pickr.create(
			getPickrSettings({
				isView: false,
				el: this.fgSingle.createDiv({ cls: 'picker' }),
				containerEl: contentEl,
				swatches: [this.fgColor],
				opacity: false,
				defaultColor: this.fgColor,
			})
		);
		this.fgPickr.on(
			'save',
			(color: Pickr.HSVaColor | null, instance: Pickr) => {
				if (color) {
					this.fgColor = color.toHEXA().toString();
					this.fgSingle.style.setProperty('--pcr-color', this.fgColor);
					this.updateResults();
				}
				instance.hide();
			}
		);

		this.bgSetting = new Setting(contentEl)
			.setClass('style-manager-tool-contrast-color-row')
			.setName('Background color')
			.setDesc('Surface color');

		const bgWrapper = this.bgSetting.controlEl.createDiv({
			cls: 'single-color-wrapper',
		});
		this.bgSingle = bgWrapper.createDiv({ cls: 'single-color' });
		this.bgSingle.style.setProperty('--pcr-color', this.bgColor);

		const bgCopyBtn = bgWrapper.createEl('button');
		setIcon(bgCopyBtn, 'copy');
		setTooltip(bgCopyBtn, 'Copy');
		bgCopyBtn.onclick = async (): Promise<void> => {
			await this.copyToClipboard(this.bgColor);
			new Notice('Copied!');
		};

		this.bgPickr = Pickr.create(
			getPickrSettings({
				isView: false,
				el: this.bgSingle.createDiv({ cls: 'picker' }),
				containerEl: contentEl,
				swatches: [this.bgColor],
				opacity: false,
				defaultColor: this.bgColor,
			})
		);
		this.bgPickr.on(
			'save',
			(color: Pickr.HSVaColor | null, instance: Pickr) => {
				if (color) {
					this.bgColor = color.toHEXA().toString();
					this.bgSingle.style.setProperty('--pcr-color', this.bgColor);
					this.updateResults();
				}
				instance.hide();
			}
		);

		this.previewEl = contentEl.createDiv({
			cls: 'style-manager-tool-contrast-preview',
		});

		this.largeTextPreviewEl = this.previewEl.createDiv({
			cls: 'style-manager-tool-contrast-preview-large',
		});
		this.largeTextPreviewEl.setText('Contrast');

		this.normalTextPreviewEl = this.previewEl.createDiv({
			cls: 'style-manager-tool-contrast-preview-normal',
		});
		this.normalTextPreviewEl.setText(
			'Contrast is the difference in luminance or color that makes an object or its representation in an image or display distinguishable. In visual perception of the real world, contrast is determined by the difference in the color and brightness of the object and other objects within the same field of view.'
		);

		const smallTextPreviewEl = this.previewEl.createDiv({
			cls: 'style-manager-tool-contrast-preview-small',
		});
		smallTextPreviewEl.setText('from Wikipedia, the free encyclopedia');

		this.resultsEl = contentEl.createDiv({
			cls: 'style-manager-tool-contrast-results',
		});

		this.updateResults();
	}

	private swapColors(): void {
		[this.fgColor, this.bgColor] = [this.bgColor, this.fgColor];

		this.fgPickr?.setColor(this.fgColor);
		this.bgPickr?.setColor(this.bgColor);

		this.fgSingle.style.setProperty('--pcr-color', this.fgColor);
		this.bgSingle.style.setProperty('--pcr-color', this.bgColor);

		this.updateResults();
	}

	private randomizeColors(): void {
		this.fgColor = chroma.random().hex();
		this.bgColor = chroma.random().hex();

		this.fgPickr?.setColor(this.fgColor);
		this.bgPickr?.setColor(this.bgColor);

		this.fgSingle.style.setProperty('--pcr-color', this.fgColor);
		this.bgSingle.style.setProperty('--pcr-color', this.bgColor);

		this.updateResults();
	}

	private suggestAccessibleColors(): void {
		let bgColor = chroma.random();
		while (
			Math.max(
				chroma.contrast('#FFFFFF', bgColor),
				chroma.contrast('#000000', bgColor)
			) < 4.5
		) {
			bgColor = chroma.random();
		}
		this.bgColor = bgColor.hex();

		let fgColor = chroma.random();

		let attempts = 0;
		while (chroma.contrast(fgColor, this.bgColor) < 4.5 && attempts < 1000) {
			if (chroma(this.bgColor).luminance() > 0.5) {
				fgColor = fgColor.darken(0.1);
			} else {
				fgColor = fgColor.brighten(0.1);
			}
			attempts++;
		}

		if (chroma.contrast(fgColor, this.bgColor) < 4.5) {
			const whiteContrast = chroma.contrast('#FFFFFF', this.bgColor);
			const blackContrast = chroma.contrast('#000000', this.bgColor);
			this.fgColor = whiteContrast > blackContrast ? '#FFFFFF' : '#000000';
		} else {
			this.fgColor = fgColor.hex();
		}

		this.fgPickr?.setColor(this.fgColor);
		this.bgPickr?.setColor(this.bgColor);

		this.fgSingle.style.setProperty('--pcr-color', this.fgColor);
		this.bgSingle.style.setProperty('--pcr-color', this.bgColor);

		this.updateResults();
	}

	private suggestForegroundColor(): void {
		let fgColor = chroma.random();

		let attempts = 0;
		while (chroma.contrast(fgColor, this.bgColor) < 4.5 && attempts < 1000) {
			if (chroma(this.bgColor).luminance() > 0.5) {
				fgColor = fgColor.darken(0.1);
			} else {
				fgColor = fgColor.brighten(0.1);
			}
			attempts++;
		}

		if (chroma.contrast(fgColor, this.bgColor) < 4.5) {
			const whiteContrast = chroma.contrast('#FFFFFF', this.bgColor);
			const blackContrast = chroma.contrast('#000000', this.bgColor);
			this.fgColor = whiteContrast > blackContrast ? '#FFFFFF' : '#000000';
		} else {
			this.fgColor = fgColor.hex();
		}

		this.fgPickr?.setColor(this.fgColor);
		this.fgSingle.style.setProperty('--pcr-color', this.fgColor);

		this.updateResults();
	}

	private suggestBackgroundColor(): void {
		let bgColor = chroma.random();

		let attempts = 0;
		while (chroma.contrast(this.fgColor, bgColor) < 4.5 && attempts < 1000) {
			if (chroma(this.fgColor).luminance() > 0.5) {
				bgColor = bgColor.darken(0.1);
			} else {
				bgColor = bgColor.brighten(0.1);
			}
			attempts++;
		}

		if (chroma.contrast(this.fgColor, bgColor) < 4.5) {
			const whiteContrast = chroma.contrast(this.fgColor, '#FFFFFF');
			const blackContrast = chroma.contrast(this.fgColor, '#000000');
			this.bgColor = whiteContrast > blackContrast ? '#FFFFFF' : '#000000';
		} else {
			this.bgColor = bgColor.hex();
		}

		this.bgPickr?.setColor(this.bgColor);
		this.bgSingle.style.setProperty('--pcr-color', this.bgColor);

		this.updateResults();
	}

	private updateResults(): void {
		this.updateLabels();
		this.previewEl.style.backgroundColor = this.bgColor;
		this.previewEl.style.color = this.fgColor;

		try {
			const contrast = chroma.contrast(this.fgColor, this.bgColor);

			const normalAA = contrast >= 4.5 ? 'Pass' : 'Fail';
			const normalAAA = contrast >= 7 ? 'Pass' : 'Fail';
			const largeAA = contrast >= 3 ? 'Pass' : 'Fail';
			const largeAAA = contrast >= 4.5 ? 'Pass' : 'Fail';

			this.resultsEl.empty();

			const resultsSetting = new Setting(this.resultsEl)
				.setName('Contrast ratio')
				.setDesc(`Ratio: ${contrast.toFixed(2)}:1`);

			const createBadge = (text: string, pass: boolean): HTMLElement => {
				const badge = createSpan({
					text,
					cls: 'style-manager-tool-contrast-badge',
				});
				badge.style.backgroundColor = pass
					? 'var(--color-green)'
					: 'var(--color-red)';
				badge.style.color = 'var(--text-on-accent)';
				return badge;
			};

			const badgesDiv = resultsSetting.controlEl.createDiv({
				cls: 'style-manager-tool-contrast-badges-container',
			});

			const normalDiv = badgesDiv.createDiv();
			normalDiv.setText('Normal text: ');
			normalDiv.appendChild(
				createBadge(`AA: ${normalAA}`, normalAA === 'Pass')
			);
			normalDiv.appendChild(
				createBadge(`AAA: ${normalAAA}`, normalAAA === 'Pass')
			);

			const largeDiv = badgesDiv.createDiv();
			largeDiv.setText('Large text: ');
			largeDiv.appendChild(createBadge(`AA: ${largeAA}`, largeAA === 'Pass'));
			largeDiv.appendChild(
				createBadge(`AAA: ${largeAAA}`, largeAAA === 'Pass')
			);
		} catch (_e) {
			this.resultsEl.empty();
			this.resultsEl.setText(
				'Invalid color combination for contrast calculation.'
			);
		}
	}

	private updateLabels(): void {
		this.fgSetting.setName(`Foreground color: ${this.fgColor}`);
		this.bgSetting.setName(`Background color: ${this.bgColor}`);
	}

	private async copyToClipboard(text: string): Promise<void> {
		await navigator.clipboard.writeText(text);
	}

	onunload(): void {
		if (this.fgPickr) {
			this.fgPickr.destroyAndRemove();
			this.fgPickr = null;
		}
		if (this.bgPickr) {
			this.bgPickr.destroyAndRemove();
			this.bgPickr = null;
		}
		this.contentEl.empty();
	}

	getViewType(): string {
		return colorContrastViewType;
	}

	getIcon(): string {
		return 'contrast';
	}

	getDisplayText(): string {
		return 'Color contrast checker';
	}
}

function createSpan(options: { text: string; cls: string }): HTMLElement {
	const span = document.createElement('span');
	span.setText(options.text);
	span.addClass(options.cls);
	return span;
}

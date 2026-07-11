import chroma from 'chroma-js';
import { Notice, Setting, setIcon, setTooltip } from 'obsidian';

import ColorPicker from 'colorpicker/dist/colorpicker.js';
import StyleManagerPlugin from '../../main';
import { getColorPickerConfig } from '../../utils/ColorUtils';

interface RenderOptions {
	plugin?: StyleManagerPlugin;
	onOpenInTab?: () => void;
}

export class ColorContrastChecker {
	private fgColor = '#FFFFFF';
	private bgColor = '#7A3198';
	private fgPicker: ColorPicker | null = null;
	private bgPicker: ColorPicker | null = null;
	private fgSetting: Setting;
	private bgSetting: Setting;
	private fgSingle: HTMLElement;
	private bgSingle: HTMLElement;
	private previewEl: HTMLElement;
	private normalTextPreviewEl: HTMLElement;
	private largeTextPreviewEl: HTMLElement;
	private resultsEl: HTMLElement;
	private swapBtn: HTMLElement;
	private randomBtn: HTMLElement;
	private suggestBtn: HTMLElement;

	render(contentEl: HTMLElement, options: RenderOptions = {}): void {
		const { plugin, onOpenInTab } = options;

		contentEl.addClass('style-manager-plugin');
		contentEl.addClass('modal-style-manager');
		contentEl.addClass('style-manager-color-contrast-modal');

		this.resultsEl = contentEl.createDiv({
			cls: 'style-manager-tool-contrast-results',
		});

		const iconsDiv = contentEl.createDiv({
			cls: 'style-manager-tool-contrast-icons',
		});

		const swapBtn = iconsDiv.createDiv({
			cls: 'clickable-icon style-manager-tool-contrast-swap-btn',
		});
		this.swapBtn = swapBtn;
		setIcon(swapBtn, 'arrow-down-up');
		setTooltip(swapBtn, 'Swap the FG and BG color');
		swapBtn.onclick = (): void => this.swapColors();

		const randomBtn = iconsDiv.createDiv({
			cls: 'clickable-icon style-manager-tool-contrast-random-btn',
		});
		this.randomBtn = randomBtn;
		setIcon(randomBtn, 'dice');
		setTooltip(randomBtn, 'Randomize FG and BG color');
		randomBtn.onclick = (): void => this.randomizeColors();

		const suggestBtn = iconsDiv.createDiv({
			cls: 'clickable-icon style-manager-tool-contrast-suggest-btn',
		});
		this.suggestBtn = suggestBtn;
		setIcon(suggestBtn, 'wand-2');
		setTooltip(suggestBtn, 'Suggest passing colors');
		suggestBtn.onclick = (): void => this.suggestAccessibleColors();

		this.previewEl = contentEl.createDiv({
			cls: 'style-manager-tool-contrast-preview',
		});

		this.largeTextPreviewEl = this.previewEl.createDiv({
			cls: 'style-manager-tool-contrast-preview-large',
		});
		this.largeTextPreviewEl.contentEditable = 'true';
		this.largeTextPreviewEl.spellcheck = false;
		this.largeTextPreviewEl.setText('Contrast');

		this.normalTextPreviewEl = this.previewEl.createDiv({
			cls: 'style-manager-tool-contrast-preview-normal',
		});
		this.normalTextPreviewEl.contentEditable = 'true';
		this.normalTextPreviewEl.spellcheck = false;
		this.normalTextPreviewEl.setText(
			'Contrast is the difference in luminance or color that makes an object or its representation in an image or display distinguishable. In visual perception of the real world, contrast is determined by the difference in the color and brightness of the object and other objects within the same field of view.'
		);

		const smallTextPreviewEl = this.previewEl.createDiv({
			cls: 'style-manager-tool-contrast-preview-small',
		});
		smallTextPreviewEl.contentEditable = 'true';
		smallTextPreviewEl.spellcheck = false;
		smallTextPreviewEl.setText('from Wikipedia, the free encyclopedia');

		this.fgSetting = new Setting(contentEl)
			.setClass('style-manager-tool-contrast-color-row')
			.setName('Foreground color')
			.setDesc('Text or icon color');

		const fgWrapper = this.fgSetting.controlEl.createDiv({
			cls: 'single-color-wrapper',
		});
		this.fgSingle = fgWrapper.createDiv({ cls: 'single-color' });

		const fgSuggestBtn = fgWrapper.createDiv({ cls: 'clickable-icon' });
		setIcon(fgSuggestBtn, 'wand-2');
		setTooltip(fgSuggestBtn, 'Suggest passing foreground color');
		fgSuggestBtn.onclick = (): void => this.suggestForegroundColor();

		const fgToggleEl = this.fgSingle.createEl('button');
		this.fgPicker = new ColorPicker(
			fgToggleEl,
			getColorPickerConfig({
				isView: false,
				container: contentEl,
				opacity: false,
				defaultColor: this.fgColor,
			})
		);
		this.fgPicker.on('pick', (color) => {
			if (color) {
				this.fgColor = color.string('hex').toUpperCase();
				this.updateResults();
			}
		});

		this.bgSetting = new Setting(contentEl)
			.setClass('style-manager-tool-contrast-color-row')
			.setName('Background color')
			.setDesc('Surface color');

		const bgWrapper = this.bgSetting.controlEl.createDiv({
			cls: 'single-color-wrapper',
		});
		this.bgSingle = bgWrapper.createDiv({ cls: 'single-color' });

		const bgSuggestBtn = bgWrapper.createDiv({ cls: 'clickable-icon' });
		setIcon(bgSuggestBtn, 'wand-2');
		setTooltip(bgSuggestBtn, 'Suggest passing background color');
		bgSuggestBtn.onclick = (): void => this.suggestBackgroundColor();

		const bgToggleEl = this.bgSingle.createEl('button');
		this.bgPicker = new ColorPicker(
			bgToggleEl,
			getColorPickerConfig({
				isView: false,
				container: contentEl,
				opacity: false,
				defaultColor: this.bgColor,
			})
		);
		this.bgPicker.on('pick', (color) => {
			if (color) {
				this.bgColor = color.string('hex').toUpperCase();
				this.updateResults();
			}
		});

		if (plugin) {
			const openInTabBtn = contentEl.createDiv({
				cls: 'clickable-icon',
			});
			setIcon(openInTabBtn, 'external-link');
			setTooltip(openInTabBtn, 'Open this tool in a tab');
			openInTabBtn.onclick = async (): Promise<void> => {
				await plugin.activateContrastView();
				if (onOpenInTab) {
					onOpenInTab();
				}
			};
		}

		this.updateResults();
	}

	private swapColors(): void {
		[this.fgColor, this.bgColor] = [this.bgColor, this.fgColor];

		this.fgPicker?.setColor(this.fgColor);
		this.bgPicker?.setColor(this.bgColor);

		this.updateResults();
	}

	private randomizeColors(): void {
		this.fgColor = chroma.random().hex();
		this.bgColor = chroma.random().hex();

		this.fgPicker?.setColor(this.fgColor);
		this.bgPicker?.setColor(this.bgColor);

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

		this.fgPicker?.setColor(this.fgColor);
		this.bgPicker?.setColor(this.bgColor);

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

		this.fgPicker?.setColor(this.fgColor);

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

		this.bgPicker?.setColor(this.bgColor);

		this.updateResults();
	}

	private updateResults(): void {
		this.updateLabels();
		this.previewEl.setCssStyles({ backgroundColor: this.bgColor, color: this.fgColor });

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
				const badge = activeDocument.createElement('span');
				badge.setText(text);
				badge.addClass('style-manager-tool-contrast-badge');
				badge.setCssStyles({
					backgroundColor: pass ? 'var(--color-green)' : 'var(--color-red)',
					color: 'var(--text-on-accent)'
				});
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
		} catch {
			this.resultsEl.empty();
			this.resultsEl.setText(
				'Invalid color combination for contrast calculation.'
			);
		}
	}

	private updateLabels(): void {
		this.fgSetting.setName('Foreground color: ');
		const fgHex = this.fgSetting.nameEl.createSpan({
			cls: 'clickable-hex',
			text: this.fgColor,
		});
		setTooltip(fgHex, 'Copy');
		fgHex.onclick = async (): Promise<void> => {
			await this.copyToClipboard(this.fgColor);
			new Notice('Copied foreground color!', 500);
		};

		this.bgSetting.setName('Background color: ');
		const bgHex = this.bgSetting.nameEl.createSpan({
			cls: 'clickable-hex',
			text: this.bgColor,
		});
		setTooltip(bgHex, 'Copy');
		bgHex.onclick = async (): Promise<void> => {
			await this.copyToClipboard(this.bgColor);
			new Notice('Copied background color!', 500);
		};
	}

	private async copyToClipboard(text: string): Promise<void> {
		await navigator.clipboard.writeText(text);
	}

	destroy(): void {
		if (this.fgPicker) {
			this.fgPicker.destroy();
			this.fgPicker = null;
		}
		if (this.bgPicker) {
			this.bgPicker.destroy();
			this.bgPicker = null;
		}
	}
}

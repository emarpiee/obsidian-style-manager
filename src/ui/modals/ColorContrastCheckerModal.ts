import Pickr from '@simonwep/pickr';
import chroma from 'chroma-js';
import { App, Modal, Setting } from 'obsidian';

import { getPickrSettings } from '../../utils/UIUtils';

export class ColorContrastCheckerModal extends Modal {
	private fgColor = '#FFFFFF';
	private bgColor = '#7A3198';
	private fgPickr: Pickr | null = null;
	private bgPickr: Pickr | null = null;
	private fgSingle: HTMLElement;
	private bgSingle: HTMLElement;
	private previewEl: HTMLElement;
	private normalTextPreviewEl: HTMLElement;
	private largeTextPreviewEl: HTMLElement;
	private resultsEl: HTMLElement;

	constructor(app: App) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.titleEl.setText('Color contrast checker');

		contentEl.addClass('style-manager-color-contrast-modal');

		const fgSetting = new Setting(contentEl)
			.setName('Foreground color')
			.setDesc('Text or icon color');

		const fgWrapper = fgSetting.controlEl.createDiv({
			cls: 'themed-color-wrapper',
		});
		this.fgSingle = fgWrapper.createDiv({ cls: 'single-color' });
		this.fgSingle.style.setProperty('--pcr-color', this.fgColor);
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

		const actionsDiv = contentEl.createDiv();
		actionsDiv.style.display = 'flex';
		actionsDiv.style.justifyContent = 'center';
		actionsDiv.style.gap = '10px';
		actionsDiv.style.margin = '10px 0';

		const bgSetting = new Setting(contentEl)
			.setName('Background color')
			.setDesc('Surface color');

		const bgWrapper = bgSetting.controlEl.createDiv({
			cls: 'themed-color-wrapper',
		});
		this.bgSingle = bgWrapper.createDiv({ cls: 'single-color' });
		this.bgSingle.style.setProperty('--pcr-color', this.bgColor);
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

		this.previewEl = contentEl.createDiv();
		this.previewEl.style.marginTop = '20px';
		this.previewEl.style.padding = '20px';
		this.previewEl.style.borderRadius = '8px';
		this.previewEl.style.textAlign = 'center';
		this.previewEl.style.border = '1px solid var(--background-modifier-border)';
		this.previewEl.style.display = 'flex';
		this.previewEl.style.flexDirection = 'column';
		this.previewEl.style.gap = '10px';

		const swapBtn = actionsDiv.createEl('button', { text: 'Swap' });
		swapBtn.onclick = (): void => this.swapColors();

		const randomBtn = actionsDiv.createEl('button', { text: 'Randomize' });
		randomBtn.onclick = (): void => this.randomizeColors();

		const suggestBtn = actionsDiv.createEl('button', { text: 'Suggest' });
		suggestBtn.onclick = (): void => this.suggestAccessibleColors();

		this.largeTextPreviewEl = this.previewEl.createDiv();
		this.largeTextPreviewEl.setText('Contrast');
		this.largeTextPreviewEl.style.fontSize = '24px';
		this.largeTextPreviewEl.style.fontWeight = 'bold';

		this.normalTextPreviewEl = this.previewEl.createDiv();
		this.normalTextPreviewEl.setText(
			'Contrast is the difference in luminance or color that makes an object or its representation in an image or display distinguishable. In visual perception of the real world, contrast is determined by the difference in the color and brightness of the object and other objects within the same field of view.'
		);
		this.normalTextPreviewEl.style.fontSize = '16px';
		this.normalTextPreviewEl.style.fontWeight = 'normal';

		this.normalTextPreviewEl = this.previewEl.createDiv();
		this.normalTextPreviewEl.setText('from Wikipedia, the free encyclopedia');
		this.normalTextPreviewEl.style.fontSize = '8px';
		this.normalTextPreviewEl.style.fontWeight = 'normal';

		this.resultsEl = contentEl.createDiv();
		this.resultsEl.style.marginTop = '10px';

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
		this.bgColor = chroma.random().hex();
		let fgColor = chroma.random();

		let attempts = 0;
		while (chroma.contrast(fgColor, this.bgColor) < 4.5 && attempts < 20) {
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

	private updateResults(): void {
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
				const badge = createSpan({ text });
				badge.style.padding = '4px 8px';
				badge.style.borderRadius = '4px';
				badge.style.marginRight = '8px';
				badge.style.fontSize = '12px';
				badge.style.fontWeight = 'bold';
				badge.style.backgroundColor = pass
					? 'var(--color-green)'
					: 'var(--color-red)';
				badge.style.color = 'var(--text-on-accent)';
				return badge;
			};

			const badgesDiv = resultsSetting.controlEl.createDiv();
			badgesDiv.style.display = 'flex';
			badgesDiv.style.flexDirection = 'column';
			badgesDiv.style.gap = '8px';

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

	onClose(): void {
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
}

import { ToolKeys } from '../constants';
import type StyleManagerPlugin from '../main';

export class BoxOutlineTool {
	private sheet: CSSStyleSheet | undefined;
	private active = false;

	constructor(private plugin: StyleManagerPlugin) {}

	toggle(): void {
		if (!this.active) {
			const color =
				this.plugin.settingsService.settings[ToolKeys.TOOL_BOX_OUTLINE_COLOR] ??
				'red';
			const cssToApply = `* {outline: ${color} 1px solid !important}`;

			if (!this.sheet) {
				this.sheet = new CSSStyleSheet();
				activeDocument.adoptedStyleSheets = [
					...activeDocument.adoptedStyleSheets,
					this.sheet,
				];
				this.plugin.register(() => {
					if (this.sheet) {
						activeDocument.adoptedStyleSheets =
							activeDocument.adoptedStyleSheets.filter((s) => s !== this.sheet);
					}
				});
			}

			void this.sheet.replace(cssToApply);
			this.active = true;
		} else {
			if (this.sheet) {
				void this.sheet.replace('');
			}
			this.active = false;
		}
		this.plugin.app.workspace.trigger('css-change');
	}

	updateColor(): void {
		if (this.sheet && this.active) {
			const color =
				this.plugin.settingsService.settings[ToolKeys.TOOL_BOX_OUTLINE_COLOR] ??
				'red';
			void this.sheet.replace(`* {outline: ${color} 1px solid !important}`);
			this.plugin.app.workspace.trigger('css-change');
		}
	}
}

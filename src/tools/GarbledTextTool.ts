import { Plugin } from 'obsidian';

export class GarbledTextTool {
	private sheet: CSSStyleSheet | undefined;
	private active = false;

	constructor(private plugin: Plugin) {}

	toggle(): void {
		if (!this.active) {
			const cssToApply =
				'body *:not(:hover) { font-family: Flow Circular !important; }';

			if (!this.sheet) {
				this.sheet = new CSSStyleSheet();
				activeDocument.adoptedStyleSheets = [...activeDocument.adoptedStyleSheets, this.sheet];
				this.plugin.register(() => {
					if (this.sheet) {
						activeDocument.adoptedStyleSheets = activeDocument.adoptedStyleSheets.filter(s => s !== this.sheet);
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
}

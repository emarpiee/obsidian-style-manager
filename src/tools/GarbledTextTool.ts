import { Plugin } from 'obsidian';

export class GarbledTextTool {
	private styleEl: HTMLElement | undefined;

	constructor(private plugin: Plugin) {}

	toggle(): void {
		const currentCSS = this.styleEl?.textContent;
		let cssToApply = '';

		if (!currentCSS) {
			cssToApply =
				'body *:not(:hover) { font-family: Flow Circular !important; }';
			this.styleEl = document.createElement('style');
			this.styleEl.setAttribute('type', 'text/css');
			document.head.appendChild(this.styleEl);
			this.plugin.register(() => this.styleEl?.detach());
		} else {
			cssToApply = '';
		}

		if (this.styleEl) {
			this.styleEl.textContent = cssToApply;
		}
		this.plugin.app.workspace.trigger('css-change');
	}
}

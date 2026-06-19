import { TOOL_BOX_OUTLINE_COLOR } from '../constants';
import type StyleManagerPlugin from '../main';

export class BoxOutlineTool {
	private styleEl: HTMLElement | undefined;

	constructor(private plugin: StyleManagerPlugin) {}

	toggle(): void {
		const currentCSS = this.styleEl?.textContent;
		let cssToApply = '';

		if (!currentCSS) {
			const color =
				this.plugin.settingsService.settings[TOOL_BOX_OUTLINE_COLOR] ?? 'red';
			cssToApply = `* {outline: ${color} 1px solid !important}`;
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

	updateColor(): void {
		if (this.styleEl && this.styleEl.textContent) {
			const color =
				this.plugin.settingsService.settings[TOOL_BOX_OUTLINE_COLOR] ?? 'red';
			this.styleEl.textContent = `* {outline: ${color} 1px solid !important}`;
			this.plugin.app.workspace.trigger('css-change');
		}
	}
}

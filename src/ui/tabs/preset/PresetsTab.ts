import { PresetList } from './PresetList';

import StyleManagerPlugin from '../../../main';

/**
 * Renders the Presets tab using PresetList component.
 */
export class PresetsTab {
	constructor(
		private containerEl: HTMLElement,
		private plugin: StyleManagerPlugin,
		private onRerender: () => void
	) {}

	render(): void {
		new PresetList(this.containerEl, this.plugin, this.onRerender).render();
	}
}

import { PresetList } from './PresetList';

import StyleManagerPlugin from '../../../main';

/**
 * Renders the Presets tab using PresetList component.
 */
export class PresetsTab {
	private presetList: PresetList | null = null;

	constructor(
		private containerEl: HTMLElement,
		private plugin: StyleManagerPlugin,
		private onRerender: () => void
	) {}

	render(): void {
		// Destroy previous instance to clean up its document-level keydown listener.
		this.presetList?.destroy();
		this.presetList = new PresetList(
			this.containerEl,
			this.plugin,
			this.onRerender
		);
		this.presetList.render();
	}

	destroy(): void {
		this.presetList?.destroy();
		this.presetList = null;
	}
}

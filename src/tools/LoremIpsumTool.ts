import StyleManagerPlugin from '../main';

export class LoremIpsumTool {
	constructor(private plugin: StyleManagerPlugin) {}

	show(): void {
		void this.plugin.activateLoremIpsumView();
	}
}

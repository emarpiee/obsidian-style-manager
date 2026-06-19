import StyleManagerPlugin from '../main';

export class ColorContrastCheckerTool {
	constructor(private plugin: StyleManagerPlugin) {}

	show(): void {
		this.plugin.activateContrastView();
	}
}

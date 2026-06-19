import { Notice, Plugin } from 'obsidian';

export class CSSCompatibilityTool {
	constructor(private plugin: Plugin) {}

	show(): void {
		const chromeVersion = process.versions.chrome?.split('.')[0];
		const nodeVersion = process.versions.node.split('.')[0];
		const electronVersion = process.versions.electron?.split('.')[0];

		const msg = [
			`Chrome Version: ${chromeVersion}`,
			`Node Version: ${nodeVersion}`,
			`Electron Version: ${electronVersion}`,
		].join('\n');

		new Notice(msg, 7 * 1000);
	}
}

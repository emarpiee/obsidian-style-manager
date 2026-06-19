import { Plugin } from 'obsidian';

declare const electronWindow: {
	toggleDevTools: () => void;
};

export class ToggleDevToolsTool {
	constructor(private plugin: Plugin) {}

	toggle(): void {
		electronWindow.toggleDevTools();
	}
}

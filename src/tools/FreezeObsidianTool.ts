import { Notice } from 'obsidian';
import type StyleManagerPlugin from '../main';
import { ToolKeys } from "../constants";

declare const electronWindow: {
	openDevTools: () => void;
	toggleDevTools: () => void;
};

export class FreezeObsidianTool {
	constructor(private plugin: StyleManagerPlugin) {}

	freeze(delay?: number): void {
		const finalDelay = (delay ??
			this.plugin.settingsService.settings[ToolKeys.TOOL_FREEZE_DELAY] ??
			4) as number;

		const freezeNotice = new Notice(
			`⚠ Will freeze Obsidian in ${finalDelay}s`,
			(finalDelay - 0.2) * 1000
		);
		electronWindow.openDevTools();

		let passSecs = 0;
		const timer = setInterval(() => {
			const timePassed = (finalDelay - passSecs).toFixed(1);
			freezeNotice.setMessage(`⚠ Will freeze Obsidian in ${timePassed}s`);
			passSecs += 0.1;
		}, 100);

		setTimeout(() => {
			// eslint-disable-next-line no-debugger
			debugger;
			clearInterval(timer);
		}, finalDelay * 1000);
	}
}

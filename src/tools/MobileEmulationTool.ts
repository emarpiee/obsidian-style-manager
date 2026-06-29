import { Plugin } from 'obsidian';

import { Logger } from '../utils/Logger';
import { UndocumentedApp } from "../types";

export class MobileEmulationTool {
	constructor(private plugin: Plugin) {}

	toggle(): void {
		const app = this.plugin.app as unknown as UndocumentedApp;
		if (typeof app.emulateMobile === 'function') {
			app.emulateMobile(!app.isMobile);
		} else {
			Logger.error(
				'Mobile emulation is not supported in this version of Obsidian.'
			);
		}
	}
}

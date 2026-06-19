import { Notice, Plugin } from 'obsidian';

export class TestNoticeTool {
	constructor(private plugin: Plugin) {}

	show(): void {
		new Notice(
			'I am a test notice. 👋 \nI will stay here until you click me.',
			0
		);
	}
}

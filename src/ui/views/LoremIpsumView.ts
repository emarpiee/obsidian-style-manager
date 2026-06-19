import { ItemView, WorkspaceLeaf } from 'obsidian';

import { LoremIpsumGenerator } from '../components/LoremIpsumGenerator';

export const loremIpsumViewType = 'style-manager-lorem-ipsum-view';

export class LoremIpsumView extends ItemView {
	private generator: LoremIpsumGenerator;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.generator = new LoremIpsumGenerator();
	}

	onload(): void {
		this.generator.render(this.contentEl);
	}

	onunload(): void {
		this.generator.destroy();
		this.contentEl.empty();
	}

	getViewType(): string {
		return loremIpsumViewType;
	}

	getIcon(): string {
		return 'type-set';
	}

	getDisplayText(): string {
		return 'Lorem ipsum generator';
	}
}

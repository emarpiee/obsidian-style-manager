import { ItemView, WorkspaceLeaf } from 'obsidian';

import { ReadmeComponent } from '../components/ReadmeComponent';

export const readmeViewType = 'style-manager-readme-view';

export class ReadmeView extends ItemView {
	private component: ReadmeComponent;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.component = new ReadmeComponent();
	}

	onload(): void {
		const leaves = this.app.workspace.getLeavesOfType(readmeViewType);
		for (const leaf of leaves) {
			if (leaf !== this.leaf) {
				leaf.detach();
			}
		}
		void this.component.render(this.contentEl, {
			component: this,
		});
	}

	onunload(): void {
		this.component.destroy();
		this.contentEl.empty();
	}

	getViewType(): string {
		return readmeViewType;
	}

	getIcon(): string {
		return 'info';
	}

	getDisplayText(): string {
		return 'Style manager readme';
	}
}

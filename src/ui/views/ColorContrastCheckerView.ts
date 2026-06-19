import { ItemView, WorkspaceLeaf } from 'obsidian';

import { ColorContrastChecker } from '../components/ColorContrastChecker';

export const colorContrastViewType = 'style-manager-color-contrast-view';

export class ColorContrastCheckerView extends ItemView {
	private checker: ColorContrastChecker;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.checker = new ColorContrastChecker();
	}

	onload(): void {
		this.checker.render(this.contentEl);
	}

	onunload(): void {
		this.checker.destroy();
		this.contentEl.empty();
	}

	getViewType(): string {
		return colorContrastViewType;
	}

	getIcon(): string {
		return 'contrast';
	}

	getDisplayText(): string {
		return 'Color contrast checker';
	}
}

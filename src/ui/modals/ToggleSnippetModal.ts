import { App, SuggestModal, setIcon } from 'obsidian';

import { StorageKeys } from '../../constants';
import StyleManagerPlugin from '../../main';

export class ToggleSnippetModal extends SuggestModal<string> {
	constructor(
		app: App,
		private plugin: StyleManagerPlugin
	) {
		super(app);
	}

	onOpen(): void {
		this.setPlaceholder('Search snippets...');
		if (this.inputEl) {
			this.inputEl.value = '';
			this.inputEl.dispatchEvent(new Event('input'));
		}
	}

	getSuggestions(query: string): string[] {
		const customCss = (
			this.app as unknown as { customCss?: { snippets?: string[] } }
		).customCss;
		const snippets = customCss?.snippets ?? [];

		if (!query) return snippets;

		const q = query.toLowerCase();
		return snippets.filter((id) => {
			if (id.toLowerCase().includes(q)) return true;
			const meta = this.plugin.snippetMetadataMap.get(id);
			return (
				meta?.author?.toLowerCase().includes(q) ||
				meta?.description?.toLowerCase().includes(q)
			);
		});
	}

	renderSuggestion(id: string, el: HTMLElement): void {
		const enabledSnippets = (
			this.plugin.settingsService.settings[StorageKeys.SNIPPETS] as string[]
		) ?? [];
		const isEnabled = enabledSnippets.includes(id);
		const meta = this.plugin.snippetMetadataMap.get(id);

		// — Title row: toggle icon + name —
		const titleRow = el.createDiv({ cls: 'style-manager-suggest-title-row' });

		const statusIcon = titleRow.createDiv({
			cls: `style-manager-snippet-suggest-status${isEnabled ? ' is-enabled' : ''}`,
		});
		setIcon(statusIcon, isEnabled ? 'check-circle' : 'circle');

		titleRow.createSpan({
			cls: 'style-manager-suggest-name',
			text: `${id}.css`,
		});

		// — Subtitle row: author only —
		if (meta?.author) {
			el.createDiv({
				cls: 'style-manager-suggest-subtitle suggestion-note',
				text: `by ${meta.author}`,
			});
		}
	}

	onChooseSuggestion(id: string): void {
		void (async (): Promise<void> => {
			const current = new Set(
				(this.plugin.settingsService.settings[StorageKeys.SNIPPETS] as string[]) ?? []
			);

			const wasEnabled = current.has(id);
			if (wasEnabled) current.delete(id);
			else current.add(id);

			await this.plugin.settingsService.setSetting(
				StorageKeys.SNIPPETS,
				Array.from(current),
				{ silentUI: true }
			);

			this.plugin.settingsService.notifications.snippet(
				`${wasEnabled ? 'Disabled' : 'Enabled'} snippet: ${id}`
			);
		})();
	}
}

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

		const enabledSnippets = new Set(
			(this.plugin.settingsService.settings[StorageKeys.SNIPPETS] as string[]) ?? []
		);

		return this.plugin.settingsService.snippetService.filterSnippets(
			snippets,
			query,
			enabledSnippets
		);
	}

	renderSuggestion(id: string, el: HTMLElement): void {
		const enabledSnippets = (
			this.plugin.settingsService.settings[StorageKeys.SNIPPETS] as string[]
		) ?? [];
		const isEnabled = enabledSnippets.includes(id);
		const meta = this.plugin.snippetMetadataMap.get(id);

		el.addClass('style-manager-snippet-suggest-item');

		// — Left: name + author stacked —
		const textBlock = el.createDiv({ cls: 'style-manager-snippet-suggest-text' });

		textBlock.createSpan({
			cls: 'style-manager-suggest-name',
			text: `${id}.css`,
		});

		if (meta?.author) {
			textBlock.createDiv({
				cls: 'style-manager-suggest-subtitle suggestion-note',
				text: `by ${meta.author}`,
			});
		}

		// — Right: status icon —
		const statusIcon = el.createDiv({
			cls: `style-manager-snippet-suggest-status${isEnabled ? ' is-enabled' : ''}`,
		});
		setIcon(statusIcon, isEnabled ? 'check-circle' : 'circle');
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

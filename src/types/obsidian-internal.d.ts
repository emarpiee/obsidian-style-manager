import 'obsidian';

declare module 'obsidian' {
	interface App {
		plugins: {
			plugins: Record<string, unknown>;
			manifests: Record<string, unknown>;
			enabledPlugins: Set<string>;
			getPlugin: (id: string) => unknown;
		};
		internalPlugins: {
			plugins: Record<string, unknown>;
			getPluginById: (id: string) => unknown;
		};
		commands: {
			removeCommand: (id: string) => void;
			commands: Record<string, unknown>;
		};
		customCss: {
			getTheme?: () => string;
			setTheme?: (themeName: string) => void;
			theme?: string;
			themes: Record<string, unknown>;
			snippets: string[];
			enabledSnippets: Set<string>;
			setSnippetEnabled(name: string, enabled: boolean): void;
			setCssEnabledStatus(name: string, enabled: boolean): void;
			requestLoadSnippets(): void;
			getSnippetPath(name: string): string;
			openSnippetsFolder(): void;
		};
	}

	/* eslint-disable no-undef -- Safe for global augmentations */

	interface DataAdapter {
		exists(path: string): Promise<boolean>;
		read(path: string): Promise<string>;
		write(path: string, data: string): Promise<void>;
		trashSystem(path: string): Promise<void>;
		trashLocal(path: string): Promise<void>;
		rename(oldPath: string, newPath: string): Promise<void>;
	}

	interface Workspace {
		on(
			name: 'settings-search-loaded',
			callback: () => void,
			ctx?: unknown
		): EventRef;
		on(
			name: 'css-change',
			callback: (data?: { source: string }) => void,
			ctx?: unknown
		): EventRef;
		on(
			name: 'parse-style-manager',
			callback: () => void,
			ctx?: unknown
		): EventRef;
		on(
			name: 'parse-style-settings',
			callback: () => void,
			ctx?: unknown
		): EventRef;
		on(
			name: string,
			callback: (...data: unknown[]) => unknown,
			ctx?: unknown
		): EventRef;
	}

	interface Vault {
		config: {
			theme?: string;
			accentColor?: string;
		};
		getConfig(key: string): unknown;
		setConfig(key: string, value: unknown): void;
	}
}

declare global {
	interface Window {
		moment: typeof import('moment');
		SettingsSearch: {
			addResources: (...resources: unknown[]) => void;
			removeTabResources: (tabId: string) => void;
		};
		createEl<K extends keyof HTMLElementTagNameMap>(
			tag: K,
			o?: string | Record<string, unknown>,
			callback?: (el: HTMLElementTagNameMap[K]) => void
		): HTMLElementTagNameMap[K];
		createDiv(
			o?: string | Record<string, unknown>,
			callback?: (el: HTMLDivElement) => void
		): HTMLDivElement;
		createSpan(
			o?: string | Record<string, unknown>,
			callback?: (el: HTMLSpanElement) => void
		): HTMLSpanElement;
		createFragment(callback?: (el: DocumentFragment) => void): DocumentFragment;
	}
}

// Support for crypto.randomUUID if not in base types
interface Crypto {
	randomUUID(): string;
}
/* eslint-enable no-undef -- Safe for global augmentations */

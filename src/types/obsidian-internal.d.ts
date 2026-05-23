/*
    Style Manager - Obsidian Plugin
    Copyright (c) 2023 mgmeyers
    Copyright (c) 2026 emarpiee

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
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
	}
}

// Support for crypto.randomUUID if not in base types
interface Crypto {
	randomUUID(): string;
}

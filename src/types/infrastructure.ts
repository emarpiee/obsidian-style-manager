import type StyleManagerPlugin from '../main';

export interface BridgeInternals {
	app: {
		customCss?: { theme?: string };
		vault: {
			adapter: {
				exists: (path: string) => Promise<boolean>;
				stat: (path: string) => Promise<{ mtime: number }>;
				read: (path: string) => Promise<string>;
			};
		};
	};
}

export interface ObsidianCustomCss {
	getSnippetPath?: (id: string) => string;
	snippets?: string[];
	enabledSnippets?: Set<string> | string[];
	themes?: Record<string, unknown>;
	setTheme?: (name: string, ...args: unknown[]) => void;
	requestLoadSnippets?: () => void;
	requestLoadTheme?: () => void;
	getTheme?: () => string;
	theme?: string;
	setCssEnabledStatus?: (name: string, enabled: boolean) => void;
	setSnippetEnabled?: (name: string, enabled: boolean) => void;
}

export interface ObsidianInternalApp {
	customCss: ObsidianCustomCss;
	plugins: { manifests: Record<string, unknown>; plugins: Record<string, unknown> };
}

export interface DeviceBucket {
	isIsolateMode: boolean;
	isolateSettings: Record<string, unknown>;
}

export interface IStore<T> {
	/**
	 * Loads the data from the underlying storage.
	 */
	load(): Promise<T | null>;

	/**
	 * Saves the data to the underlying storage.
	 */
	save(data: T): Promise<void>;
}

export type PluginManifestWithDir = StyleManagerPlugin['manifest'] & {
	dir?: string;
};

export interface UndocumentedApp {
	isMobile: boolean;
	emulateMobile: (toggle: boolean) => void;
}

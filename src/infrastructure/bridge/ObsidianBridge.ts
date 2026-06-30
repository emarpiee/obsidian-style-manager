import {
	AbstractInputSuggest,
	App,
	TAbstractFile,
	TFile,
	TFolder,
	normalizePath,
} from 'obsidian';

import { ObsidianCustomCss, ObsidianInternalApp } from '../../types';
import { Logger } from '../../utils/Logger';

/**
 * ObsidianBridge acts as the Infrastructure Layer (Clean Architecture).
 * It encapsulates all direct interactions with the Obsidian API,
 * providing a stable interface for the Core logic.
 */
export class ObsidianBridge {
	public originalConfigGet: ((key: string) => unknown) | null = null;
	public originalConfigSet: ((key: string, value: unknown) => void) | null =
		null;
	public originalSetTheme: ((name: string, ...args: unknown[]) => void) | null =
		null;
	public originalThemeDescriptor: PropertyDescriptor | undefined;
	private _realThemeValue: string | undefined;

	constructor(private app: App) {}

	/**
	 * Creates a folder suggestion for an input element.
	 */
	public createFolderSuggest(inputEl: HTMLInputElement): FolderSuggest {
		return new FolderSuggest(this.app, inputEl);
	}

	/**
	 * Gets the full path to a snippet file.
	 */
	public getSnippetPath(id: string): string {
		const customCss = (this.app as unknown as ObsidianInternalApp).customCss;
		if (customCss && customCss.getSnippetPath) {
			return customCss.getSnippetPath(id);
		}
		return normalizePath(`${this.app.vault.configDir}/snippets/${id}.css`);
	}

	/**
	 * Gets the full path to a theme file.
	 */
	public getThemePath(id: string): string {
		return normalizePath(`${this.app.vault.configDir}/themes/${id}/theme.css`);
	}

	/**
	 * Gets the full path to a plugin's styles.css.
	 */
	public getPluginPath(id: string): string {
		return normalizePath(
			`${this.app.vault.configDir}/plugins/${id}/styles.css`
		);
	}

	/**
	 * Retrieves a value from the Obsidian native configuration.
	 */
	public getNativeConfig(key: string): unknown {
		const vault = this.app.vault;
		if (this.originalConfigGet) {
			return this.originalConfigGet.call(vault, key);
		}
		return vault.getConfig(key);
	}

	/**
	 * Robustly retrieve the current theme name, bypassing potentially stale vault cache.
	 */
	public getActiveTheme(): string {
		const customCss = (this.app as unknown as ObsidianInternalApp).customCss;
		if (customCss && typeof customCss.getTheme === 'function') {
			return customCss.getTheme() || '';
		}
		if (customCss && customCss.theme) {
			return customCss.theme || '';
		}
		return (this.getNativeConfig('cssTheme') as string) || '';
	}

	/**
	 * Robustly retrieve the current appearance mode (dark/light), bypassing stale cache.
	 */
	public getActiveAppearance(): string {
		const nativeAppearanceRaw = this.getNativeConfig('theme') as string; // 'obsidian' or 'moonstone'
		return nativeAppearanceRaw === 'moonstone' ? 'light' : 'dark';
	}

	/**
	 * Retrieves the names of all currently enabled CSS snippets.
	 */
	public getEnabledSnippets(): string[] {
		try {
			const customCss = (this.app as unknown as ObsidianInternalApp).customCss;
			if (customCss && customCss.enabledSnippets) {
				// Return a fresh array copy (Set or Array)
				return Array.from(customCss.enabledSnippets) as string[];
			}
		} catch (e) {
			Logger.error('Style Manager | Error getting enabled snippets:', e);
		}
		return [];
	}

	/**
	 * Retrieves the names of all installed CSS snippets (enabled or not).
	 */
	public getAllSnippets(): string[] {
		try {
			const customCss = (this.app as unknown as ObsidianInternalApp).customCss;
			if (customCss && customCss.snippets) {
				return Array.from(customCss.snippets);
			}
		} catch (e) {
			Logger.error('Style Manager | Error getting all snippets:', e);
		}
		return [];
	}

	/**
	 * Retrieves the names of all installed themes by scanning the themes directory.
	 */
	public async getInstalledThemes(): Promise<string[]> {
		try {
			const adapter = this.app.vault.adapter;
			const configDir = this.app.vault.configDir;
			const themesPath = normalizePath(`${configDir}/themes`);

			if (!(await adapter.exists(themesPath))) {
				return [];
			}

			const result = await adapter.list(themesPath);
			const installedThemes: string[] = [];

			for (const folderPath of result.folders) {
				const themeId = folderPath.split('/').pop();
				if (!themeId) continue;

				const manifestPath = normalizePath(`${folderPath}/manifest.json`);
				if (await adapter.exists(manifestPath)) {
					installedThemes.push(themeId);
				}
			}

			return installedThemes;
		} catch (e) {
			Logger.error('Style Manager | Error getting installed themes:', e);
			return [];
		}
	}

	/**
	 * Retrieves the IDs of all installed plugins.
	 */
	public getInstalledPlugins(): string[] {
		try {
			const plugins = (this.app as unknown as ObsidianInternalApp).plugins;
			if (plugins && plugins.manifests) {
				return Object.keys(plugins.manifests);
			}
		} catch (e) {
			Logger.error('Style Manager | Error getting installed plugins:', e);
		}
		return [];
	}

	/**
	 * Updates a value in the Obsidian native configuration.
	 */
	public setNativeConfig(key: string, value: unknown): void {
		this.app.vault.setConfig(key, value as string);
	}

	/**
	 * Reads a file from the Obsidian vault.
	 */
	public async readNativeFile(path: string): Promise<string> {
		return await this.app.vault.adapter.read(path);
	}

	/**
	 * Triggers a workspace event.
	 */
	public triggerEvent(name: string, data?: unknown): void {
		this.app.workspace.trigger(name, data);
	}

	/**
	 * Creates a file in the vault.
	 */
	public async createFile(
		path: string,
		content: string | ArrayBuffer | Uint8Array
	): Promise<TFile> {
		if (content instanceof ArrayBuffer) {
			return await this.app.vault.createBinary(path, content);
		}
		if (content instanceof Uint8Array) {
			return await this.app.vault.createBinary(
				path,
				content.buffer as ArrayBuffer
			);
		}
		return await this.app.vault.create(path, content);
	}

	/**
	 * Trashes a file using the file manager (respects vault/system trash settings).
	 */
	public async trashFile(file: TFile): Promise<void> {
		await this.app.fileManager.trashFile(file);
	}

	/**
	 * Checks if a file or folder exists in the vault.
	 */
	public async fileExists(path: string): Promise<boolean> {
		return this.app.vault.getAbstractFileByPath(path) !== null;
	}

	/**
	 * Creates a folder in the vault.
	 */
	public async createFolder(path: string): Promise<void> {
		await this.app.vault.createFolder(path);
	}

	/**
	 * Recursively creates a folder in the vault if it doesn't exist.
	 */
	public async mkdir(path: string): Promise<void> {
		if (path.startsWith('.') || path.includes('/.')) {
			await this.app.vault.adapter.mkdir(path);
			return;
		}

		const parts = path.split('/');
		let currentPath = '';
		for (const part of parts) {
			if (!part) continue;
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			if (this.app.vault.getAbstractFileByPath(currentPath) === null) {
				await this.app.vault.createFolder(currentPath);
			}
		}
	}

	/**
	 * Reads the content of a CSS snippet from the .obsidian/snippets folder.
	 */
	public async readSnippet(name: string): Promise<string | null> {
		try {
			const adapter = this.app.vault.adapter;
			const configDir = this.app.vault.configDir;
			const path = normalizePath(`${configDir}/snippets/${name}.css`);
			if (await adapter.exists(path)) {
				return await adapter.read(path);
			}
		} catch (e) {
			Logger.error(`Style Manager | Error reading snippet "${name}":`, e);
		}
		return null;
	}

	/**
	 * Writes a CSS snippet to the .obsidian/snippets folder.
	 */
	public async writeSnippet(name: string, content: string): Promise<void> {
		try {
			const adapter = this.app.vault.adapter;
			const configDir = this.app.vault.configDir;
			const snippetsFolder = normalizePath(`${configDir}/snippets`);

			if (!(await adapter.exists(snippetsFolder))) {
				await adapter.mkdir(snippetsFolder);
			}

			const path = normalizePath(`${snippetsFolder}/${name}.css`);
			await adapter.write(path, content);
		} catch (e) {
			Logger.error(`Style Manager | Error writing snippet "${name}":`, e);
			throw e;
		}
	}

	/**
	 * Checks if a snippet file exists.
	 */
	public async snippetExists(name: string): Promise<boolean> {
		const adapter = this.app.vault.adapter;
		const configDir = this.app.vault.configDir;
		const path = normalizePath(`${configDir}/snippets/${name}.css`);
		return await adapter.exists(path);
	}

	/**
	 * Reads the content of a theme's theme.css.
	 */
	public async readThemeCss(themeName: string): Promise<string | null> {
		try {
			const adapter = this.app.vault.adapter;
			const configDir = this.app.vault.configDir;
			const path = normalizePath(`${configDir}/themes/${themeName}/theme.css`);
			if (await adapter.exists(path)) {
				return await adapter.read(path);
			}
		} catch (e) {
			Logger.error(
				`Style Manager | Error reading theme CSS "${themeName}":`,
				e
			);
		}
		return null;
	}

	/**
	 * Reads the content of a theme's manifest.json.
	 */
	public async readThemeManifest(themeName: string): Promise<string | null> {
		try {
			const adapter = this.app.vault.adapter;
			const configDir = this.app.vault.configDir;
			const path = normalizePath(
				`${configDir}/themes/${themeName}/manifest.json`
			);
			if (await adapter.exists(path)) {
				return await adapter.read(path);
			}
		} catch (e) {
			Logger.error(
				`Style Manager | Error reading theme manifest "${themeName}":`,
				e
			);
		}
		return null;
	}

	/**
	 * Writes a theme CSS or manifest file to the themes directory.
	 */
	public async writeThemeFile(
		themeName: string,
		filename: string,
		content: string
	): Promise<void> {
		try {
			const adapter = this.app.vault.adapter;
			const configDir = this.app.vault.configDir;
			const themeFolder = normalizePath(`${configDir}/themes/${themeName}`);

			if (!(await adapter.exists(themeFolder))) {
				await adapter.mkdir(themeFolder);
			}

			const path = normalizePath(`${themeFolder}/${filename}`);
			await adapter.write(path, content);
		} catch (e) {
			Logger.error(
				`Style Manager | Error writing theme file "${filename}" for theme "${themeName}":`,
				e
			);
			throw e;
		}
	}

	/**
	 * Checks if a theme exists.
	 */
	public async themeExists(themeName: string): Promise<boolean> {
		const adapter = this.app.vault.adapter;
		const configDir = this.app.vault.configDir;
		const path = normalizePath(`${configDir}/themes/${themeName}/theme.css`);
		return await adapter.exists(path);
	}

	/**
	 * Gets leaves of a specific type from the workspace.
	 */
	public getLeavesOfType(type: string): unknown[] {
		return this.app.workspace.getLeavesOfType(type);
	}

	/**
	 * Calls the native Obsidian setTheme method.
	 */
	public setNativeTheme(themeName: string): void {
		const customCss = this.app.customCss;
		if (customCss && customCss.setTheme) {
			customCss.setTheme(themeName);
		}
	}

	/**
	 * Installs monkey patches to intercept configuration and theme changes.
	 * This is used to implement "Shadow Default" mode and Isolate Mode isolation.
	 *
	 * @param onThemeIntercept Callback triggered when a native theme change is intercepted.
	 * @param getAppearance Getter for the local appearance mode.
	 * @param onAppearanceIntercept Callback triggered when a native appearance change is intercepted.
	 * @param isApplyingPersistentTheme Getter for ignore flag during programmatic PERSISTENCE updates.
	 * @param isApplyingVisualTheme Getter for ignore flag during programmatic VISUAL-ONLY updates.
	 */
	public installPatches(
		getTheme: () => string,
		onThemeIntercept: (theme: string) => void,
		getAppearance: () => string,
		onAppearanceIntercept: (appearance: string) => void,
		getAccentColor: () => string,
		onAccentColorIntercept: (color: string) => void,
		isApplyingPersistentTheme: () => boolean,
		isApplyingVisualTheme: () => boolean
	): void {
		const vault = this.app.vault;
		const customCss = this.app.customCss;
		const bridge = this;

		if (this.originalConfigGet) return;

		// 1. Vault Config Patches
		this.originalConfigGet = vault.getConfig;
		this.originalConfigSet = vault.setConfig;

		vault.getConfig = function (
			this: Record<string, unknown>,
			key: string,
			...args: unknown[]
		): unknown {
			if (!isApplyingPersistentTheme()) {
				if (key === 'cssTheme') return '';
				if (key === 'theme') return getAppearance();
				if (key === 'accentColor') return getAccentColor();
			}
			return (
				bridge.originalConfigGet as (
					this: unknown,
					key: string,
					...args: unknown[]
				) => unknown
			).apply(this, [key, ...args]);
		};

		vault.setConfig = function (
			this: Record<string, unknown>,
			key: string,
			value: unknown,
			...args: unknown[]
		): void {
			if (!isApplyingPersistentTheme()) {
				if (key === 'cssTheme') {
					Logger.log('Style Manager | Bridge: Blocked config save for', key);
					return;
				}
				if (key === 'theme') {
					Logger.log(
						'Style Manager | Bridge: Intercepted native appearance change:',
						value
					);
					onAppearanceIntercept(value as string);
					return;
				}
				if (key === 'accentColor') {
					Logger.log(
						'Style Manager | Bridge: Intercepted native accent color change:',
						value
					);
					onAccentColorIntercept(value as string);
					return;
				}
			}
			return (
				bridge.originalConfigSet as (
					this: unknown,
					key: string,
					value: unknown,
					...args: unknown[]
				) => void
			).apply(this, [key, value, ...args]);
		};

		// 2. CustomCSS Patches
		if (customCss) {
			this.originalSetTheme = customCss.setTheme;
			const internalCss = customCss as unknown as ObsidianCustomCss;

			this.originalThemeDescriptor = Object.getOwnPropertyDescriptor(
				internalCss,
				'theme'
			);

			// Override theme property getter to return the actual active theme.
			// This allows the native Obsidian command palette "Change theme.." to show the
			// correct active badge without breaking the vault.getConfig('cssTheme') trick.
			this._realThemeValue = internalCss.theme;
			Object.defineProperty(internalCss, 'theme', {
				get: () => {
					if (isApplyingPersistentTheme() || isApplyingVisualTheme()) {
						return this._realThemeValue;
					}
					return getTheme();
				},
				set: (val: string) => {
					this._realThemeValue = val;
				},
				configurable: true,
			});

			internalCss.setTheme = function (
				themeName: string,
				...args: unknown[]
			): void {
				// If we are applying a theme internally (Shadow Default clear),
				// we allow the call to reach the original setTheme (for visual clearing)
				// but our vault.setConfig patch will block the actual disk write.
				if (isApplyingVisualTheme() || isApplyingPersistentTheme()) {
					return (
						bridge.originalSetTheme as (
							this: unknown,
							themeName: string,
							...args: unknown[]
						) => void
					).apply(this, [themeName, ...args]);
				}

				// If NOT an internal change, intercept and record locally
				Logger.log(
					'Style Manager | Bridge: Intercepted native setTheme call:',
					themeName
				);
				onThemeIntercept(themeName || 'default');
			};
		}
	}

	/**
	 * Reads the current enabled snippets directly from appearance.json on disk.
	 * This is used to detect changes from Obsidian Sync that haven't been picked up by core.
	 */
	public async getSnippetStatusFromDisk(): Promise<string[]> {
		try {
			const adapter = this.app.vault.adapter;
			const configDir = this.app.vault.configDir;
			const appearancePath = normalizePath(`${configDir}/appearance.json`);

			if (await adapter.exists(appearancePath)) {
				const content = await adapter.read(appearancePath);
				const config = JSON.parse(content);

				// Obsidian typically uses enabledCssSnippets, but we check enabledSnippets as fallback
				const list = config.enabledCssSnippets || config.enabledSnippets || [];

				if (Array.isArray(list)) {
					return list;
				} else {
					Logger.warn(
						'Style Manager | appearance.json enabled snippets key is not an array:',
						list
					);
				}
			} else {
				Logger.log(
					'Style Manager | appearance.json not found at',
					appearancePath
				);
			}
		} catch (e) {
			Logger.error(
				'Style Manager | Error reading appearance.json from disk:',
				e
			);
		}
		return [];
	}

	/**
	 * Programmatically toggles a snippet in Obsidian's core engine.
	 */
	public setSnippetEnabledNative(name: string, enabled: boolean): void {
		const customCss = (this.app as unknown as ObsidianInternalApp).customCss;
		if (customCss) {
			const toggleFn =
				customCss.setCssEnabledStatus || customCss.setSnippetEnabled;
			if (toggleFn) {
				toggleFn.call(customCss, name, enabled);
			}
		}
	}

	/**
	 * Forces Obsidian to re-scan the snippets folder.
	 * Also manually syncs the `snippets` array to remove externally modified files.
	 */
	public async forceLoadSnippets(): Promise<void> {
		const customCss = (this.app as unknown as ObsidianInternalApp).customCss;
		if (customCss && typeof customCss.requestLoadSnippets === 'function') {
			customCss.requestLoadSnippets();
		}

		// Fix Obsidian's modified files issue by scanning the directory manually
		try {
			const configDir = this.app.vault.configDir;
			const snippetsFolder = normalizePath(`${configDir}/snippets`);

			if (await this.app.vault.adapter.exists(snippetsFolder)) {
				const listed = await this.app.vault.adapter.list(snippetsFolder);
				const cssFiles = listed.files
					.filter((f) => f.endsWith('.css'))
					.map((f) => {
						const parts = f.split('/');
						const nameWithExt = parts[parts.length - 1];
						return nameWithExt.substring(0, nameWithExt.length - 4);
					});

				if (customCss && Array.isArray(customCss.snippets)) {
					// Remove deleted files from customCss.snippets
					customCss.snippets = customCss.snippets.filter((s) =>
						cssFiles.includes(s)
					);

					// Also add any that might have been missed
					cssFiles.forEach((s) => {
						if (!customCss.snippets.includes(s)) {
							customCss.snippets.push(s);
						}
					});
				}
			}
		} catch (e) {
			Logger.error('Style Manager | Error fixing customCss snippets list:', e);
		}
	}

	/**
	 * Deletes a CSS snippet from the .obsidian/snippets folder.
	 * Uses configDir to avoid hardcoded paths.
	 * Respects Obsidian's native "Deleted files" setting.
	 */
	public async deleteSnippet(name: string): Promise<void> {
		try {
			const configDir = this.app.vault.configDir;
			const path = normalizePath(`${configDir}/snippets/${name}.css`);
			const adapter = this.app.vault.adapter;

			if (!(await adapter.exists(path))) {
				Logger.warn(
					`Style Manager | Snippet file not found for deletion: ${path}`
				);
				return;
			}

			const trashOption = this.getNativeConfig('trashOption') || 'local';

			if (trashOption === 'none') {
				await adapter.remove(path);
			} else if (trashOption === 'local') {
				await adapter.trashLocal(path);
			} else {
				// system
				try {
					await adapter.trashSystem(path);
					if (await adapter.exists(path)) {
						throw new Error('File still exists after trashSystem');
					}
				} catch (_e) {
					Logger.log(
						`Style Manager | System trash failed for ${name}, trying local trash.`
					);
					await adapter.trashLocal(path);
				}
			}
		} catch (e) {
			Logger.error(`Style Manager | Error deleting snippet "${name}":`, e);
			throw e;
		}
	}

	/**
	 * Forces Obsidian to re-scan the snippets folder and reload styles.
	 */
	public requestLoadSnippets(): void {
		const customCss = (this.app as unknown as ObsidianInternalApp).customCss;
		if (customCss && typeof customCss.requestLoadSnippets === 'function') {
			customCss.requestLoadSnippets();
		}
	}

	/**
	 * Forces Obsidian to reload the current theme.
	 */
	public requestLoadTheme(): void {
		const customCss = (this.app as unknown as ObsidianInternalApp).customCss;
		if (customCss && typeof customCss.requestLoadTheme === 'function') {
			customCss.requestLoadTheme();
		}
	}

	/**
	 * Restores original Obsidian methods.
	 */
	public uninstallPatches(): void {
		const vault = this.app.vault;
		const customCss = this.app.customCss;

		if (this.originalConfigGet) {
			vault.getConfig = this.originalConfigGet;
			vault.setConfig = this.originalConfigSet;
			this.originalConfigGet = null;
			this.originalConfigSet = null;
		}

		if (this.originalSetTheme && customCss) {
			customCss.setTheme = this.originalSetTheme;
			this.originalSetTheme = null;

			const internalCss = customCss as unknown as ObsidianCustomCss;
			if (this.originalThemeDescriptor) {
				// Restore value since it might have changed while patched
				if (
					this.originalThemeDescriptor.writable ||
					this.originalThemeDescriptor.set
				) {
					if ('value' in this.originalThemeDescriptor) {
						this.originalThemeDescriptor.value = this._realThemeValue;
					}
				}
				Object.defineProperty(
					internalCss,
					'theme',
					this.originalThemeDescriptor
				);
			} else {
				// If there was no original descriptor on the instance, it means 'theme' was a prototype getter/setter.
				// We must delete the 'own' property we created to un-shadow the prototype.
				delete internalCss.theme;
			}
			this.originalThemeDescriptor = undefined;
		}
	}
}

/**
 * FolderSuggest provides folder-based autocomplete for input fields.
 */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
	}

	getSuggestions(inputStr: string): TFolder[] {
		const abstractFiles = this.app.vault.getAllLoadedFiles();
		const folders: TFolder[] = [];
		const lowerCaseInputStr = inputStr.toLowerCase();

		abstractFiles.forEach((file: TAbstractFile) => {
			if (
				file instanceof TFolder &&
				file.path.toLowerCase().contains(lowerCaseInputStr)
			) {
				folders.push(file);
			}
		});

		return folders;
	}

	renderSuggestion(file: TFolder, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFolder): void {
		this.inputEl.value = file.path;
		this.inputEl.dispatchEvent(new Event('input'));
		this.close();
	}
}

import { App, normalizePath } from 'obsidian';

import { ThemeManifest } from '../types';
import { NotificationService } from './NotificationService';

import { ObsidianBridge } from '../infrastructure/bridge/ObsidianBridge';
import { Logger } from '../utils/Logger';

export class ThemeBuilderService {
	constructor(
		private app: App,
		private bridge: ObsidianBridge,
		private notifications: NotificationService
	) {}

	/**
	 * Generates a theme ID from a theme name
	 */
	private generateThemeId(name: string): string {
		return name.toLowerCase().replace(/\s+/g, '-');
	}

	/**
	 * Creates a new theme scaffold in .obsidian/themes/
	 */
	async createTheme(manifest: ThemeManifest): Promise<string> {
		const themeId = this.generateThemeId(manifest.name);
		const themePath = normalizePath(`.obsidian/themes/${themeId}`);
		const adapter = this.app.vault.adapter;

		if (await adapter.exists(themePath)) {
			throw new Error(`Theme directory already exists: ${themePath}`);
		}

		await adapter.mkdir(themePath);
		await adapter.write(
			normalizePath(`${themePath}/manifest.json`),
			JSON.stringify(manifest, null, '\t')
		);
		await adapter.write(
			normalizePath(`${themePath}/theme.css`),
			`/* ${manifest.name} theme */\n\n:root {\n\n}\n`
		);

		this.notifications.util(`Created theme: ${manifest.name}`);

		// Force Obsidian to reload themes so the new one shows up
		this.bridge.requestLoadTheme();

		return themeId;
	}

	/**
	 * Deletes a theme directory and its contents
	 */
	async deleteTheme(themeId: string): Promise<void> {
		const themePath = normalizePath(`.obsidian/themes/${themeId}`);
		const adapter = this.app.vault.adapter;

		if (!(await adapter.exists(themePath))) {
			throw new Error(`Theme directory does not exist: ${themePath}`);
		}

		await adapter.rmdir(themePath, true);
		this.notifications.util(`Deleted theme: ${themeId}`);

		this.bridge.requestLoadTheme();
	}

	/**
	 * Duplicates an existing theme
	 */
	async duplicateTheme(
		sourceThemeId: string,
		newName: string
	): Promise<string> {
		const sourcePath = normalizePath(`.obsidian/themes/${sourceThemeId}`);
		const newThemeId = this.generateThemeId(newName);
		const newPath = normalizePath(`.obsidian/themes/${newThemeId}`);
		const adapter = this.app.vault.adapter;

		if (!(await adapter.exists(sourcePath))) {
			throw new Error(`Source theme does not exist: ${sourcePath}`);
		}
		if (await adapter.exists(newPath)) {
			throw new Error(`Target theme already exists: ${newPath}`);
		}

		await adapter.mkdir(newPath);

		// Copy manifest and update name
		const manifestContent = await adapter.read(
			normalizePath(`${sourcePath}/manifest.json`)
		);
		const manifest = JSON.parse(manifestContent) as ThemeManifest;
		manifest.name = newName;
		await adapter.write(
			normalizePath(`${newPath}/manifest.json`),
			JSON.stringify(manifest, null, '\t')
		);

		// Copy theme.css
		const cssContent = await adapter.read(
			normalizePath(`${sourcePath}/theme.css`)
		);
		await adapter.write(normalizePath(`${newPath}/theme.css`), cssContent);

		this.notifications.util(`Duplicated theme to: ${newName}`);
		this.bridge.requestLoadTheme();

		return newThemeId;
	}

	/**
	 * Gets a list of all themes in .obsidian/themes/
	 */
	async getThemes(): Promise<Record<string, ThemeManifest>> {
		const themes: Record<string, ThemeManifest> = {};
		const themeIds = await this.bridge.getInstalledThemes();

		for (const themeId of themeIds) {
			try {
				const manifestContent = await this.bridge.readThemeManifest(themeId);
				if (manifestContent) {
					themes[themeId] = JSON.parse(manifestContent) as ThemeManifest;
				}
			} catch (e) {
				Logger.warn(
					`Style Manager | Failed to load manifest for theme ${themeId}:`,
					e
				);
			}
		}

		return themes;
	}

	/**
	 * Updates the manifest.json for a theme and renames the folder if the name changed
	 */
	async updateThemeManifest(
		themeId: string,
		manifest: ThemeManifest
	): Promise<void> {
		const adapter = this.app.vault.adapter;
		let currentThemeId = themeId;
		const newThemeId = this.generateThemeId(manifest.name);

		if (newThemeId !== currentThemeId) {
			const oldPath = normalizePath(`.obsidian/themes/${currentThemeId}`);
			const newPath = normalizePath(`.obsidian/themes/${newThemeId}`);

			if (!(await adapter.exists(oldPath))) {
				throw new Error(`Theme directory not found: ${oldPath}`);
			}
			if (await adapter.exists(newPath)) {
				throw new Error(`Target theme directory already exists: ${newPath}`);
			}

			await adapter.rename(oldPath, newPath);
			currentThemeId = newThemeId;
		}

		const manifestPath = normalizePath(
			`.obsidian/themes/${currentThemeId}/manifest.json`
		);

		if (!(await adapter.exists(manifestPath))) {
			throw new Error(`Manifest not found for theme: ${currentThemeId}`);
		}

		await adapter.write(manifestPath, JSON.stringify(manifest, null, '\t'));

		this.notifications.util(`Updated manifest for: ${manifest.name}`);
		this.bridge.requestLoadTheme();
	}
}

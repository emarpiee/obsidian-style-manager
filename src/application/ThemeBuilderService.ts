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
import { App } from 'obsidian';

import { NotificationService } from './NotificationService';

import { ObsidianBridge } from '../infrastructure/bridge/ObsidianBridge';

export interface ThemeManifest {
	name: string;
	author: string;
	version: string;
	minAppVersion: string;
	authorUrl?: string;
	fundingUrl?: string | Record<string, string>;
}

export class ThemeBuilderService {
	constructor(
		private app: App,
		private bridge: ObsidianBridge,
		private notifications: NotificationService
	) {}

	/**
	 * Creates a new theme scaffold in .obsidian/themes/
	 */
	async createTheme(manifest: ThemeManifest): Promise<string> {
		const themeId = manifest.name.toLowerCase().replace(/\s+/g, '-');
		const themePath = `.obsidian/themes/${themeId}`;
		const adapter = this.app.vault.adapter;

		if (await adapter.exists(themePath)) {
			throw new Error(`Theme directory already exists: ${themePath}`);
		}

		await adapter.mkdir(themePath);
		await adapter.write(
			`${themePath}/manifest.json`,
			JSON.stringify(manifest, null, '\t')
		);
		await adapter.write(
			`${themePath}/theme.css`,
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
		const themePath = `.obsidian/themes/${themeId}`;
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
		const sourcePath = `.obsidian/themes/${sourceThemeId}`;
		const newThemeId = newName.toLowerCase().replace(/\s+/g, '-');
		const newPath = `.obsidian/themes/${newThemeId}`;
		const adapter = this.app.vault.adapter;

		if (!(await adapter.exists(sourcePath))) {
			throw new Error(`Source theme does not exist: ${sourcePath}`);
		}
		if (await adapter.exists(newPath)) {
			throw new Error(`Target theme already exists: ${newPath}`);
		}

		await adapter.mkdir(newPath);

		// Copy manifest and update name
		const manifestContent = await adapter.read(`${sourcePath}/manifest.json`);
		const manifest = JSON.parse(manifestContent) as ThemeManifest;
		manifest.name = newName;
		await adapter.write(
			`${newPath}/manifest.json`,
			JSON.stringify(manifest, null, '\t')
		);

		// Copy theme.css
		const cssContent = await adapter.read(`${sourcePath}/theme.css`);
		await adapter.write(`${newPath}/theme.css`, cssContent);

		this.notifications.util(`Duplicated theme to: ${newName}`);
		this.bridge.requestLoadTheme();

		return newThemeId;
	}

	/**
	 * Gets a list of all themes in .obsidian/themes/
	 */
	async getThemes(): Promise<Record<string, ThemeManifest>> {
		const themes: Record<string, ThemeManifest> = {};
		const adapter = this.app.vault.adapter;
		const themesPath = '.obsidian/themes';

		if (!(await adapter.exists(themesPath))) {
			return themes;
		}

		const result = await adapter.list(themesPath);
		for (const folderPath of result.folders) {
			const themeId = folderPath.split('/').pop();
			if (!themeId) continue;

			try {
				const manifestPath = `${folderPath}/manifest.json`;
				if (await adapter.exists(manifestPath)) {
					const manifestContent = await adapter.read(manifestPath);
					themes[themeId] = JSON.parse(manifestContent);
				}
			} catch (e) {
				console.error(`Failed to load manifest for theme ${themeId}:`, e);
			}
		}

		return themes;
	}

	/**
	 * Updates the manifest.json for a theme
	 */
	async updateThemeManifest(
		themeId: string,
		manifest: ThemeManifest
	): Promise<void> {
		const adapter = this.app.vault.adapter;
		const manifestPath = `.obsidian/themes/${themeId}/manifest.json`;

		if (!(await adapter.exists(manifestPath))) {
			throw new Error(`Manifest not found for theme: ${themeId}`);
		}

		await adapter.write(manifestPath, JSON.stringify(manifest, null, '\t'));

		this.notifications.util(`Updated manifest for: ${manifest.name}`);
		this.bridge.requestLoadTheme();
	}
}

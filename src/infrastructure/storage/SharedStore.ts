import { normalizePath } from 'obsidian';

import { IStore } from './IStore';

import type StyleManagerPlugin from '../../main';
import { StyleManagerSettings } from '../../types';
import { Logger } from '../../utils/Logger';

/** Typed accessor for manifest.dir which is not in Obsidian's official types. */
type PluginManifestWithDir = StyleManagerPlugin['manifest'] & { dir?: string };

/**
 * Obsidian Shared implementation of IStore.
 * Directly wraps the plugin's data persistence methods for shared (synced) data.
 */
export class SharedStore implements IStore<StyleManagerSettings> {
	constructor(private plugin: StyleManagerPlugin) {}

	/**
	 * Loads settings from Obsidian's data.json.
	 * Returns null if the file does not exist.
	 */
	async load(): Promise<StyleManagerSettings | null> {
		const raw = await this.readRaw();
		if (raw === null)
			return (await this.plugin.loadData()) as StyleManagerSettings | null;

		try {
			return JSON.parse(raw) as StyleManagerSettings;
		} catch (e) {
			Logger.error(
				'Style Manager | Failed to parse data.json, returning null',
				e
			);
			return null;
		}
	}

	/**
	 * Restores the backup file by copying data.json.bak over data.json.
	 */
	async restoreFromBackup(): Promise<boolean> {
		try {
			const vault = this.plugin.app.vault;
			const adapter = vault.adapter;
			const baseDir =
				(this.plugin.manifest as PluginManifestWithDir).dir ||
				normalizePath(`${vault.configDir}/plugins/${this.plugin.manifest.id}`);
			const settingsPath = normalizePath(`${baseDir}/data.json`);
			const backupPath = normalizePath(`${baseDir}/data.json.bak`);

			if (await adapter.exists(backupPath)) {
				await adapter.copy(backupPath, settingsPath);
				return true;
			}
		} catch (e) {
			Logger.error('Style Manager | Error restoring from backup:', e);
		}
		return false;
	}

	/**
	 * Reads the raw content of data.json.
	 * Returns null if the file does not exist.
	 */
	async readRaw(): Promise<string | null> {
		try {
			const vault = this.plugin.app.vault;
			const adapter = vault.adapter;
			const baseDir =
				(this.plugin.manifest as PluginManifestWithDir).dir ||
				normalizePath(`${vault.configDir}/plugins/${this.plugin.manifest.id}`);
			const settingsPath = normalizePath(`${baseDir}/data.json`);

			if (await adapter.exists(settingsPath)) {
				return await adapter.read(settingsPath);
			}
		} catch (e) {
			Logger.warn('Style Manager | Direct disk read failed', e);
		}
		return null;
	}

	/**
	 * Saves settings to Obsidian's data.json.
	 */
	async save(data: StyleManagerSettings): Promise<void> {
		await this.plugin.saveData(data);
	}

	/**
	 * Creates a backup of the current data.json by copying it to data.json.bak.
	 */
	async createBackup(): Promise<boolean> {
		try {
			const vault = this.plugin.app.vault;
			const adapter = vault.adapter;
			const baseDir =
				(this.plugin.manifest as PluginManifestWithDir).dir ||
				normalizePath(`${vault.configDir}/plugins/${this.plugin.manifest.id}`);
			const settingsPath = normalizePath(`${baseDir}/data.json`);
			const backupPath = normalizePath(`${baseDir}/data.json.bak`);

			if (await adapter.exists(settingsPath)) {
				if (await adapter.exists(backupPath)) {
					await adapter.remove(backupPath);
				}
				await adapter.copy(settingsPath, backupPath);
				return true;
			}
		} catch (e) {
			Logger.error('Style Manager | Error creating backup:', e);
		}
		return false;
	}

	/**
	 * Checks if data.json.bak exists.
	 */
	async hasBackup(): Promise<boolean> {
		try {
			const vault = this.plugin.app.vault;
			const adapter = vault.adapter;
			const baseDir =
				(this.plugin.manifest as PluginManifestWithDir).dir ||
				normalizePath(`${vault.configDir}/plugins/${this.plugin.manifest.id}`);
			const backupPath = normalizePath(`${baseDir}/data.json.bak`);
			return await adapter.exists(backupPath);
		} catch (e) {
			Logger.error('Style Manager | Error checking backup:', e);
			return false;
		}
	}
	/**
	 * Returns the last modified time of data.json.
	 */
	async getMTime(): Promise<number> {
		try {
			const vault = this.plugin.app.vault;
			const adapter = vault.adapter;
			const baseDir =
				(this.plugin.manifest as PluginManifestWithDir).dir ||
				normalizePath(`${vault.configDir}/plugins/${this.plugin.manifest.id}`);
			const settingsPath = normalizePath(`${baseDir}/data.json`);

			const stat = await adapter.stat(settingsPath);
			return stat?.mtime || 0;
		} catch {
			return 0;
		}
	}
}

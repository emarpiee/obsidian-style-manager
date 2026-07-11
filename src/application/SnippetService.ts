import { RefreshLevel, SnippetServiceOptions } from '../types';

import { CSSParser } from '../core/css/CSSParser';
import { Logger } from '../utils/Logger';

/**
 * Service for managing CSS snippets synchronization and application.
 */
export class SnippetService {
	constructor(private options: SnippetServiceOptions) {}

	/**
	 * Visually applies a list of enabled snippets to Obsidian.
	 * In Isolate Mode, it overrides memory only. In Shared Mode, it writes to disk.
	 */
	public async applySnippets(
		snippetList: string[],
		isIsolate: boolean
	): Promise<void> {
		const currentEnabled = this.options.bridge.getEnabledSnippets();
		const targetSet = new Set(snippetList);
		let modified = false;

		if (isIsolate) {
			// ISOLATE MODE: Direct memory mutation to bypass appearance.json
			const customCss = (
				this.options.plugin.app as unknown as {
					customCss?: { enabledSnippets?: Set<string> | string[] };
				}
			).customCss;
			if (customCss && customCss.enabledSnippets) {
				if (customCss.enabledSnippets instanceof Set) {
					customCss.enabledSnippets.clear();
					const enabledSet = customCss.enabledSnippets as Set<string>;
					snippetList.forEach((s) => enabledSet.add(s));
					modified = true;
				} else if (Array.isArray(customCss.enabledSnippets)) {
					const enabledArr = customCss.enabledSnippets as string[];
					enabledArr.length = 0;
					enabledArr.push(...snippetList);
					modified = true;
				}
			}
		} else {
			// SHARED MODE: Use native toggles to ensure appearance.json is updated
			// 1. Disable what shouldn't be there
			for (const id of currentEnabled) {
				if (!targetSet.has(id)) {
					this.options.bridge.setSnippetEnabledNative(id, false);
					modified = true;
				}
			}
			// 2. Enable what should be there
			for (const id of snippetList) {
				if (!currentEnabled.includes(id)) {
					this.options.bridge.setSnippetEnabledNative(id, true);
					modified = true;
				}
			}
		}

		if (modified) {
			this.options.bridge.forceLoadSnippets();
			this.options.plugin.settingsService.refreshService.trigger(
				RefreshLevel.PARSE_CSS
			);
		}
	}

	/**
	 * Reconciles Obsidian's in-memory snippet state with the appearance.json file on disk.
	 */
	public async syncSnippetState(options?: {
		skipAdopt?: boolean;
	}): Promise<void> {
		const isIsolate = this.options.getIsolateMode();
		const diskEnabled = await this.options.bridge.getSnippetStatusFromDisk();
		const lockerEnabled = this.options.getLockerSettings();
		const currentEnabled = this.options.bridge.getEnabledSnippets();

		// 1. SYNC FROM DISK: Adopt disk state if it changed natively
		if (!isIsolate && !options?.skipAdopt) {
			const diskString = JSON.stringify([...diskEnabled].sort());
			const lockerString = JSON.stringify([...lockerEnabled].sort());
			const currentString = JSON.stringify([...currentEnabled].sort());

			if (diskString !== currentString && diskString !== lockerString) {
				Logger.log(
					'Style Manager | Snippets: Adopting appearance.json state into Shared Locker.'
				);
				await this.options.setLockerSettings(diskEnabled);
			}
		}

		// 2. APPLY TO OBSIDIAN: Ensure memory matches our locker truth
		const targetEnabled = lockerEnabled;
		const currentSet = new Set(currentEnabled);

		let needsRefresh = false;
		if (
			targetEnabled.length !== currentEnabled.length ||
			targetEnabled.some((s: string) => !currentSet.has(s))
		) {
			needsRefresh = true;
		}

		if (needsRefresh) {
			Logger.log(
				'Style Manager | Snippets: Reconciling memory with locker truth.'
			);
			await this.applySnippets(targetEnabled, isIsolate);
		}
	}

	/**
	 * Creates a new CSS snippet in the .obsidian/snippets folder.
	 * Increments the sync version to notify other devices.
	 */
	public async createSnippet(): Promise<string> {
		const existing = new Set(this.options.bridge.getAllSnippets());
		let name = 'untitled';
		let counter = 1;

		while (existing.has(name)) {
			name = `untitled ${counter}`;
			counter++;
		}

		await this.options.bridge.writeSnippet(name, '');
		this.options.bridge.forceLoadSnippets();

		// Trigger sync version increment
		await this.options.plugin.settingsService.save({ force: true });

		return name;
	}

	/**
	 * Duplicates an existing snippet.
	 */
	public async duplicateSnippet(id: string): Promise<string> {
		const path = this.options.bridge.getSnippetPath(id);
		const adapter = this.options.plugin.app.vault.adapter;

		if (!(await adapter.exists(path))) {
			throw new Error('Source snippet file not found.');
		}

		const content = await adapter.read(path);
		let newName = `${id} copy`;
		let destPath = this.options.bridge.getSnippetPath(newName);
		let counter = 1;

		while (await adapter.exists(destPath)) {
			newName = `${id} copy ${counter}`;
			destPath = this.options.bridge.getSnippetPath(newName);
			counter++;
		}

		await adapter.write(destPath, content);

		// Update metadata map immediately
		const metadata = CSSParser.parseMetadata(content);
		if (metadata) {
			this.options.plugin.snippetMetadataMap.set(newName, metadata);
		}

		await this.options.plugin.settingsService.save({ force: true });
		this.options.bridge.forceLoadSnippets();
		await this.options.plugin.parseAllSnippetMetadata();

		this.options.plugin.settingsService.refreshService.trigger(
			RefreshLevel.PARSE_CSS
		);
		return newName;
	}

	/**
	 * Deletes a snippet and cleans up the Locker (enabled list).
	 */
	public async deleteSnippet(id: string): Promise<void> {
		await this.options.bridge.deleteSnippet(id);

		// Clean up Locker
		const lockerEnabled = this.options.getLockerSettings();
		if (lockerEnabled.includes(id)) {
			const newList = lockerEnabled.filter((sid) => sid !== id);
			await this.options.setLockerSettings(newList);
		}

		this.options.plugin.selectedSnippets.delete(id);
		this.options.plugin.snippetMetadataMap.delete(id);

		this.options.bridge.forceLoadSnippets();
		await this.options.plugin.settingsService.save({ force: true });

		// Give file system time to sync on mobile
		window.setTimeout(() => {
			this.options.plugin.settingsService.refreshService.trigger(
				RefreshLevel.PARSE_CSS
			);
		}, 300);
	}

	/**
	 * Renames a snippet and updates tracking.
	 */
	public async renameSnippet(oldId: string, newId: string): Promise<void> {
		const oldPath = this.options.bridge.getSnippetPath(oldId);
		const newPath = this.options.bridge.getSnippetPath(newId);
		const adapter = this.options.plugin.app.vault.adapter;

		if (await adapter.exists(newPath)) {
			throw new Error(`A snippet named "${newId}" already exists.`);
		}

		const wasEnabled = (
			this.options.plugin.app as unknown as {
				customCss: { enabledSnippets: Set<string> };
			}
		).customCss.enabledSnippets.has(oldId);

		await adapter.rename(oldPath, newPath);

		// Update metadata map
		const metadata = this.options.plugin.snippetMetadataMap.get(oldId);
		if (metadata) {
			this.options.plugin.snippetMetadataMap.set(newId, metadata);
			this.options.plugin.snippetMetadataMap.delete(oldId);
		}

		// Update Locker
		const lockerEnabled = this.options.getLockerSettings();
		if (lockerEnabled.includes(oldId)) {
			const newList = lockerEnabled.filter((id) => id !== oldId);
			newList.push(newId);
			await this.options.setLockerSettings(newList);
		} else {
			await this.options.plugin.settingsService.save({ force: true });
		}

		if (wasEnabled) {
			this.options.bridge.setSnippetEnabledNative(newId, true);
		}

		this.options.bridge.forceLoadSnippets();
		await this.options.plugin.parseAllSnippetMetadata();
		this.options.plugin.settingsService.refreshService.trigger(
			RefreshLevel.PARSE_CSS
		);
	}

	/**
	 * Writes content to a snippet file and refreshes metadata.
	 */
	public async writeSnippetContent(id: string, content: string): Promise<void> {
		const path = this.options.bridge.getSnippetPath(id);
		await this.options.plugin.app.vault.adapter.write(path, content);

		this.options.bridge.requestLoadSnippets();
		await this.options.plugin.parseAllSnippetMetadata();
		this.options.plugin.settingsService.refreshService.trigger(
			RefreshLevel.PARSE_CSS
		);
	}
}

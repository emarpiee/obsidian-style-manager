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
import { normalizePath } from 'obsidian';

import StyleManagerPlugin from '../main';
import { PrefixMetadata, Preset } from '../types';
import {
	ACCENT_COLOR_KEY,
	APPEARANCE_KEY,
	SNIPPETS_KEY,
	THEME_KEY,
} from './SettingsService';

import { ConfirmModal } from '../ui/modals/ConfirmModal';
import { getFormattedTimestamp } from '../utils/CommonUtils';

export class PresetService {
	plugin: StyleManagerPlugin;
	presetSearchQuery: string = '';
	selectedPresets: Set<string> = new Set();
	public lastSelectedIndex: number | null = null;

	constructor(plugin: StyleManagerPlugin) {
		this.plugin = plugin;
	}

	get presets(): Preset[] {
		return (
			(this.plugin.settingsService.settings._manager_presets as Preset[]) || []
		);
	}

	set presets(val: Preset[]) {
		this.plugin.settingsService.setSettings({ _manager_presets: val });
	}

	async savePresets(): Promise<void> {
		await this.plugin.settingsService.setSettings({
			_manager_presets: this.presets,
		});
	}

	public async trashPresets(presets: Preset[]): Promise<void> {
		const trashOption =
			this.plugin.settingsService.bridge.getNativeConfig('trashOption');
		if (trashOption === 'none') return;

		const timestamp = getFormattedTimestamp(
			this.plugin.settingsService.settings[
				'__style_manager_export_date_format'
			] as string
		);
		const timestampPart = timestamp ? `-${timestamp}` : '';
		const bridge = this.plugin.settingsService.bridge;

		for (const preset of presets) {
			try {
				// Generate a recognizable filename for the backup
				const safeName = preset.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
				const filename = `${safeName}-style-manager${timestampPart}.json`;
				const content = JSON.stringify(preset, null, 2);

				// Create and trash via bridge
				const file = await bridge.createFile(filename, content);
				await bridge.trashFile(file);
			} catch (err) {
				console.error('Failed to trash preset backup:', err);
				this.plugin.settingsService.notifications.error(
					`Error backing up preset "${preset.name}".`
				);
			}
		}
	}

	public async saveFileToVault(
		filename: string,
		content: string | ArrayBuffer | Uint8Array
	): Promise<void> {
		let exportPath: string =
			(this.plugin.settingsService.settings[
				'__style_manager_export_path'
			] as string) || '';

		const isZip =
			content instanceof ArrayBuffer ||
			content instanceof Uint8Array ||
			(content &&
				(content as unknown as { buffer: ArrayBuffer }).buffer instanceof
					ArrayBuffer);
		const extension: string = isZip
			? '.zip'
			: (this.plugin.settingsService.settings[
					'__style_manager_export_extension'
				] as string) || '.json';

		// Ensure filename has the correct extension
		const baseName = filename.replace(/\.(json|md|txt|zip)$/, '');
		const targetFilename = `${baseName}${extension}`;

		// Ensure path ends with slash if not empty
		if (exportPath && !exportPath.endsWith('/')) {
			exportPath += '/';
		}

		// Create folder if it doesn't exist (using recursive mkdir)
		const bridge = this.plugin.settingsService.bridge;
		if (exportPath) {
			try {
				await bridge.mkdir(exportPath);
			} catch (e) {
				console.error('Style Manager | Failed to create export folder', e);
			}
		}

		let fullPath = normalizePath(`${exportPath}${targetFilename}`);

		// Handle file collision
		if (await bridge.fileExists(fullPath)) {
			const timestamp = new Date().getTime();
			fullPath = fullPath.replace(extension, `_${timestamp}${extension}`);
		}

		try {
			await bridge.createFile(fullPath, content);
			this.plugin.settingsService.notifications.preset(
				`Exported to vault: ${fullPath}`
			);
		} catch (e) {
			console.error('Style Manager | Failed to save file to vault', e);
			this.plugin.settingsService.notifications.error(
				'Failed to export to vault. Check console for details.'
			);
		}
	}

	getSettingsData(): Record<string, unknown> {
		const data: Record<string, unknown> = {};
		const settings = this.plugin.settingsService.settings;

		// 1. Capture Style Settings (@@)
		for (const key of Object.keys(settings)) {
			if (key.includes('@@')) {
				data[key] = settings[key];
			}
		}

		// 2. Explicitly Capture Active Theme
		const theme = settings[THEME_KEY];
		if (theme !== undefined && theme !== null) {
			data[THEME_KEY] = theme;
		}

		// 3. Explicitly Capture Appearance
		const appearance = settings[APPEARANCE_KEY];
		if (appearance !== undefined && appearance !== null) {
			data[APPEARANCE_KEY] = appearance;
		}

		// 4. Explicitly Capture Snippets
		const snippets = settings[SNIPPETS_KEY];
		if (Array.isArray(snippets)) {
			data[SNIPPETS_KEY] = snippets;
		}

		// 5. Explicitly Capture Accent Color
		const accent = settings[ACCENT_COLOR_KEY];
		if (accent !== undefined && accent !== null) {
			data[ACCENT_COLOR_KEY] = accent;
		}

		return data;
	}

	async saveCurrentSettingsAsPreset(
		presetName: string,
		targetPrefixes: string[] = ['All']
	): Promise<void> {
		// Ensure fresh state before capture
		(
			this.plugin.settingsService as unknown as { updateMerged: () => void }
		).updateMerged();

		const data = this.getSettingsData();

		let filteredData = data;
		const isAll = targetPrefixes.includes('All');

		if (!isAll) {
			filteredData = {};
			for (const key of Object.keys(data)) {
				if (key.includes('@@')) {
					const prefix = key.split('@@')[0];
					if (targetPrefixes.includes(prefix)) {
						filteredData[key] = data[key];
					}
				} else if (key === THEME_KEY && targetPrefixes.includes('__theme')) {
					filteredData[key] = data[key];
				} else if (
					key === APPEARANCE_KEY &&
					targetPrefixes.includes('__appearance')
				) {
					filteredData[key] = data[key];
				} else if (
					key === SNIPPETS_KEY &&
					targetPrefixes.includes('__snippets')
				) {
					filteredData[key] = data[key];
				} else if (
					key === ACCENT_COLOR_KEY &&
					targetPrefixes.includes('__accentColor')
				) {
					filteredData[key] = data[key];
				}
			}
		}

		const newPreset: Preset = {
			id: crypto.randomUUID(),
			name: presetName,
			created: Date.now(),
			data: filteredData,
			targetedPrefixes: isAll ? undefined : targetPrefixes,
		};

		const currentPresets = this.presets;
		currentPresets.unshift(newPreset);
		this.presets = currentPresets;
		await this.savePresets();
		this.plugin.settingsService.notifications.preset(
			`Saved preset: ${presetName}`
		);
	}

	async applyPreset(
		presetId: string,
		isolateOnly: boolean = false
	): Promise<void> {
		const preset = this.presets.find((p) => p.id === presetId);
		if (!preset) return;

		try {
			await this.plugin.settingsService.applySettingsOverlay(
				preset.data,
				isolateOnly
			);
			this.plugin.settingsService.notifications.preset(
				`Applied preset: ${preset.name}${isolateOnly ? ' (isolated)' : ''}.`
			);
		} catch (e) {
			console.error('Style Manager | Preset Error:', e);
			this.plugin.settingsService.notifications.error(
				'Failed to apply preset.'
			);
		}
	}

	public confirmApply(
		presetName: string,
		onConfirm: () => void,
		isolateOnly: boolean = false
	): void {
		if (
			this.plugin.settingsService.settings['__style_manager_skip_apply_confirm']
		) {
			onConfirm();
		} else {
			new ConfirmModal(
				this.plugin.app,
				isolateOnly
					? 'Apply to this devce (isolate)'
					: 'Apply to shared locker',
				isolateOnly
					? `Are you sure you want to apply the preset "${presetName}" to this device?`
					: `Are you sure you want to apply the preset "${presetName}" to the shared locker?`,
				isolateOnly ? 'Confirm' : 'Confirm',
				false,
				onConfirm
			).open();
		}
	}

	getPrefixesMetadata(): PrefixMetadata[] {
		const categories = new Map<string, PrefixMetadata>();

		// 1. Add currently active settings list
		for (const setting of this.plugin.settingsList) {
			categories.set(setting.id, {
				id: setting.id,
				name: setting.name,
				count: 0,
				isActive: true,
			});
		}

		// 2. Add historically saved settings (even if inactive)
		const sections = this.plugin.settingsService.getRawSettingsSections();
		for (const section of sections) {
			const existing = categories.get(section.id);
			if (existing) {
				existing.count = section.count;
			} else {
				categories.set(section.id, {
					id: section.id,
					name: section.id,
					count: section.count,
					isActive: false,
				});
			}
		}

		// 3. Inject current theme name for UI badges
		const themeMeta = categories.get('__theme');
		if (themeMeta) {
			themeMeta.value =
				(this.plugin.settingsService.settings[THEME_KEY] as string) ||
				'Default';
		}

		// 4. Inject current appearance for UI badges
		const appearanceMeta = categories.get('__appearance');
		if (appearanceMeta) {
			const appearance = this.plugin.settingsService.settings[
				APPEARANCE_KEY
			] as string;
			appearanceMeta.value =
				appearance && appearance !== 'system'
					? appearance
					: document.body.classList.contains('theme-dark')
						? 'dark'
						: 'light';
		}

		// 5. Inject current snippets for UI badges
		const snippetsMeta = categories.get('__snippets');
		if (snippetsMeta) {
			const enabledSnippets =
				(this.plugin.settingsService.settings[SNIPPETS_KEY] as string[]) || [];
			snippetsMeta.value = enabledSnippets;
		}

		// 6. Inject current accent color for UI badges
		const accentMeta = categories.get('__accentColor');
		if (accentMeta) {
			const accentColor =
				(this.plugin.settingsService.settings[ACCENT_COLOR_KEY] as string) ||
				'';
			const vConfigAccent =
				this.plugin.settingsService.bridge.getNativeConfig('accentColor');
			const nativeAccent =
				typeof document !== 'undefined'
					? getComputedStyle(document.body)
							.getPropertyValue('--accent-color')
							.trim()
					: '';
			accentMeta.value =
				accentColor || (vConfigAccent as string) || nativeAccent || '#8a5cf5';
		}

		return Array.from(categories.values()).sort((a, b) => {
			if (b.count !== a.count) return b.count - a.count;
			return a.name.localeCompare(b.name);
		});
	}

	public getFormattedTimestamp(format: string = 'YYYYMMDDHHmmss'): string {
		return getFormattedTimestamp(format);
	}
}

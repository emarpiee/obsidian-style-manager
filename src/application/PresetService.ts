import { normalizePath } from 'obsidian';

import { ExportKeys, PreferencesKeys, StorageKeys } from '../constants';
import StyleManagerPlugin from '../main';
import { PrefixMetadata, Preset } from '../types';

import { ConfirmModal } from '../ui/modals/ConfirmModal';
import { getFormattedTimestamp } from '../utils/CommonUtils';
import { Logger } from '../utils/Logger';

export class PresetService {
	plugin: StyleManagerPlugin;
	presetSearchQuery: string = '';
	selectedPresets: Set<string> = new Set();
	public lastSelectedIndex: number | null = null;
	public targetView: 'auto' | 'shared' | 'isolate' = 'auto';

	constructor(plugin: StyleManagerPlugin) {
		this.plugin = plugin;
		this.plugin.settingsService.on('isolate-mode-changed', () => {
			this.targetView = 'auto';
		});
	}

	public getEffectiveViewMode(): 'shared' | 'isolate' {
		if (this.targetView !== 'auto') return this.targetView;
		const alwaysShared =
			this.plugin.settingsService.settings[
				PreferencesKeys.ALWAYS_SHARED_PRESETS
			];
		if (alwaysShared === undefined || alwaysShared === true) {
			return 'shared';
		}
		return this.plugin.settingsService.isIsolateMode() ? 'isolate' : 'shared';
	}

	get presets(): Preset[] {
		const mode = this.getEffectiveViewMode();
		if (mode === 'isolate') {
			return (
				this.plugin.settingsService.isolateModeService.isolateSettings
					._manager_presets || []
			);
		}
		return this.plugin.settingsService.sharedSettings._manager_presets || [];
	}

	public getPresetById(id: string): Preset | undefined {
		const sharedPresets =
			this.plugin.settingsService.sharedSettings._manager_presets || [];
		const isolatePresets =
			this.plugin.settingsService.isolateModeService.isolateSettings
				._manager_presets || [];

		return (
			sharedPresets.find((p) => p.id === id) ||
			isolatePresets.find((p) => p.id === id)
		);
	}

	set presets(val: Preset[]) {
		const mode = this.getEffectiveViewMode();
		void this.plugin.settingsService.setSettings(
			{ _manager_presets: val },
			{ silentUI: true, target: mode }
		);
	}

	async savePresets(): Promise<void> {
		const mode = this.getEffectiveViewMode();
		await this.plugin.settingsService.setSettings(
			{
				_manager_presets: this.presets,
			},
			{ silentUI: true, target: mode }
		);
	}

	public async trashPresets(presets: Preset[]): Promise<void> {
		const trashOption =
			this.plugin.settingsService.bridge.getNativeConfig('trashOption');
		if (trashOption === 'none') return;

		const timestamp = getFormattedTimestamp(
			this.plugin.settingsService.settings[
				ExportKeys.EXPORT_DATE_FORMAT
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
				Logger.error('Style Manager | Failed to trash preset backup:', err);
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
				ExportKeys.EXPORT_PATH
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
					ExportKeys.EXPORT_EXTENSION
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
				Logger.error('Style Manager | Failed to create export folder', e);
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
			Logger.error('Style Manager | Failed to save file to vault', e);
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
		const theme = settings[StorageKeys.THEME];
		if (theme !== undefined && theme !== null) {
			data[StorageKeys.THEME] = theme;
		}

		// 3. Explicitly Capture Appearance
		const appearance = settings[StorageKeys.APPEARANCE];
		if (appearance !== undefined && appearance !== null) {
			data[StorageKeys.APPEARANCE] = appearance;
		}

		// 4. Explicitly Capture Snippets
		const snippets = settings[StorageKeys.SNIPPETS];
		if (Array.isArray(snippets)) {
			data[StorageKeys.SNIPPETS] = snippets;
		}

		// 5. Explicitly Capture Accent Color
		const accent = settings[StorageKeys.ACCENT_COLOR];
		if (accent !== undefined && accent !== null) {
			data[StorageKeys.ACCENT_COLOR] = accent;
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
				} else if (
					key === StorageKeys.THEME &&
					targetPrefixes.includes('__theme')
				) {
					filteredData[key] = data[key];
				} else if (
					key === StorageKeys.APPEARANCE &&
					targetPrefixes.includes('__appearance')
				) {
					filteredData[key] = data[key];
				} else if (
					key === StorageKeys.SNIPPETS &&
					targetPrefixes.includes('__snippets')
				) {
					filteredData[key] = data[key];
				} else if (
					key === StorageKeys.ACCENT_COLOR &&
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

	private async mergePresets(
		presetIds: string[]
	): Promise<{ mergedData: Record<string, unknown> }> {
		const selectedPresets = presetIds
			.map((id) => this.presets.find((p) => p.id === id))
			.filter((p): p is Preset => !!p);

		const mergedData: Record<string, unknown> = {};
		const mergedSnippets = new Set<string>();
		let snippetsEncountered = false;

		for (const preset of selectedPresets) {
			for (const [key, value] of Object.entries(preset.data)) {
				if (key === StorageKeys.SNIPPETS && Array.isArray(value)) {
					snippetsEncountered = true;
					value.forEach((s) => mergedSnippets.add(s as string));
				} else {
					mergedData[key] = value;
				}
			}
		}

		if (snippetsEncountered) {
			const existingSnippets = await Promise.all(
				Array.from(mergedSnippets).map(async (s) => {
					const exists =
						await this.plugin.settingsService.bridge.snippetExists(s);
					return exists ? s : null;
				})
			);
			mergedData[StorageKeys.SNIPPETS] = existingSnippets.filter(
				(s): s is string => s !== null
			);
		}

		return { mergedData };
	}

	async applyPreset(
		presetId: string,
		isolateOnly: boolean = false,
		action: 'overwrite' | 'merge' = 'overwrite'
	): Promise<void> {
		await this.applyPresets([presetId], isolateOnly, action);
	}

	async applyPresets(
		presetIds: string[],
		isolateOnly: boolean = false,
		action: 'overwrite' | 'merge' = 'overwrite'
	): Promise<void> {
		const { mergedData } = await this.mergePresets(presetIds);
		if (
			Object.keys(mergedData).length === 0 &&
			!mergedData[StorageKeys.SNIPPETS]
		)
			return;

		if (action === 'overwrite') {
			await this.plugin.settingsService.resetAllStyleSettings(isolateOnly);
		} else if (action === 'merge') {
			if (mergedData[StorageKeys.SNIPPETS] !== undefined) {
				const currentSnippets =
					(this.plugin.settingsService.settings[
						StorageKeys.SNIPPETS
					] as string[]) || [];
				const presetSnippets = mergedData[StorageKeys.SNIPPETS] as string[];
				mergedData[StorageKeys.SNIPPETS] = Array.from(
					new Set([...currentSnippets, ...presetSnippets])
				);
			}
		}

		try {
			await this.plugin.settingsService.applySettingsOverlay(
				mergedData,
				isolateOnly
			);
			const count = presetIds.length;
			this.plugin.settingsService.notifications.preset(
				`Applied ${count} preset${count > 1 ? 's' : ''}${isolateOnly ? ' (isolated)' : ''}.`
			);
			for (const id of presetIds) {
				const preset = this.getPresetById(id);
				if (preset) {
					this.plugin.settingsService.notifications.preset(
						`Applied ${preset.name}.`
					);
				}
			}
		} catch (e) {
			Logger.error('Style Manager | Preset Error:', e);
			this.plugin.settingsService.notifications.error(
				'Failed to apply presets.'
			);
		}
	}

	async applyPresetsToLocker(
		deviceId: string,
		presetIds: string[],
		action: 'overwrite' | 'merge' = 'overwrite'
	): Promise<void> {
		const { mergedData } = await this.mergePresets(presetIds);
		if (
			Object.keys(mergedData).length === 0 &&
			!mergedData[StorageKeys.SNIPPETS]
		)
			return;

		if (action === 'merge') {
			if (mergedData[StorageKeys.SNIPPETS] !== undefined) {
				const currentSnippets =
					(this.plugin.settingsService.getEffectiveLockerSettings(deviceId)[
						StorageKeys.SNIPPETS
					] as string[]) || [];
				const presetSnippets = mergedData[StorageKeys.SNIPPETS] as string[];
				mergedData[StorageKeys.SNIPPETS] = Array.from(
					new Set([...currentSnippets, ...presetSnippets])
				);
			}
		}

		await this.plugin.settingsService.identity.updateLockerSettings(
			deviceId,
			mergedData,
			action === 'overwrite'
		);
	}

	public confirmApply(
		presetName: string,
		onConfirm: (action: 'overwrite' | 'merge') => void,
		target: 'shared' | 'isolate' | 'remote' = 'shared',
		applyActionKey: string = PreferencesKeys.PRESET_APPLY_ACTION,
		remoteDeviceName?: string
	): void {
		const defaultAction =
			(this.plugin.settingsService.settings[applyActionKey] as string) || 'ask';

		if (defaultAction === 'overwrite') {
			onConfirm('overwrite');
		} else if (defaultAction === 'merge') {
			onConfirm('merge');
		} else {
			const isBulk = applyActionKey !== PreferencesKeys.PRESET_APPLY_ACTION;
			const mergeOverwriteDesc = isBulk
				? 'Do you want to merge these presets with your current settings, or overwrite them?'
				: 'Do you want to merge with your current settings, or overwrite them?';

			let title = 'Apply to shared locker';
			let destText = 'the shared locker';
			if (target === 'isolate') {
				title = 'Apply to this device (isolate)';
				destText = 'this device';
			} else if (target === 'remote') {
				title = remoteDeviceName
					? `Apply to ${remoteDeviceName}`
					: 'Apply to other device (isolate)';
				destText = remoteDeviceName || 'the other device';
			}

			new ConfirmModal(
				this.plugin.app,
				title,
				`Are you sure you want to apply ${isBulk ? 'the selected presets' : `the preset "${presetName}"`} to ${destText}? ${mergeOverwriteDesc}`,
				'Overwrite',
				false,
				() => onConfirm('overwrite'),
				'Merge',
				() => onConfirm('merge')
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
					name: section.name || section.id,
					count: section.count,
					isActive: false,
				});
			}
		}

		// 3. Inject current theme name for UI badges
		const themeMeta = categories.get('__theme');
		if (themeMeta) {
			themeMeta.value =
				(this.plugin.settingsService.settings[StorageKeys.THEME] as string) ||
				'Default';
		}

		// 4. Inject current appearance for UI badges
		const appearanceMeta = categories.get('__appearance');
		if (appearanceMeta) {
			const appearance = this.plugin.settingsService.settings[
				StorageKeys.APPEARANCE
			] as string;
			appearanceMeta.value =
				appearance && appearance !== 'system'
					? appearance
					: activeDocument.body.classList.contains('theme-dark')
						? 'dark'
						: 'light';
		}

		// 5. Inject current snippets for UI badges
		const snippetsMeta = categories.get('__snippets');
		if (snippetsMeta) {
			const enabledSnippets =
				(this.plugin.settingsService.settings[
					StorageKeys.SNIPPETS
				] as string[]) || [];
			snippetsMeta.value = enabledSnippets;
		}

		// 6. Inject current accent color for UI badges
		const accentMeta = categories.get('__accentColor');
		if (accentMeta) {
			const accentColor =
				(this.plugin.settingsService.settings[
					StorageKeys.ACCENT_COLOR
				] as string) || '';
			const vConfigAccent =
				this.plugin.settingsService.bridge.getNativeConfig('accentColor');
			const nativeAccent =
				typeof activeDocument !== 'undefined'
					? getComputedStyle(activeDocument.body)
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

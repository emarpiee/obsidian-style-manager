import JSZip from 'jszip';

import { StorageKeys } from '../constants';
import { BundleData, Preset } from '../types';

import { ObsidianBridge } from '../infrastructure/bridge/ObsidianBridge';

/**
 * Service for creating and extracting preset bundles (ZIP files).
 */
export class BundleService {
	constructor(private bridge: ObsidianBridge) {}

	/**
	 * Creates a ZIP bundle containing preset data and associated CSS snippets.
	 * Supports both a single preset and an array of presets.
	 */
	async createBundle(
		input: Preset | Preset[],
		preferredExtension: string = '.json',
		separatePresets: boolean = false
	): Promise<Uint8Array> {
		const zip = new JSZip();
		const presets = Array.isArray(input) ? input : [input];

		// 1. Add preset data
		const ext = preferredExtension.startsWith('.')
			? preferredExtension
			: `.${preferredExtension}`;

		if (presets.length === 1) {
			zip.file(`preset${ext}`, JSON.stringify(presets[0], null, 2));
		} else if (separatePresets) {
			// Save each preset in its own file within a presets/ folder
			const presetsFolder = zip.folder('presets');
			if (presetsFolder) {
				for (const preset of presets) {
					const safeName = preset.name.replace(/[:/\\?%*|"<>]/g, '-');
					presetsFolder.file(
						`${safeName}${ext}`,
						JSON.stringify(preset, null, 2)
					);
				}
			}
		} else {
			zip.file(`presets${ext}`, JSON.stringify(presets, null, 2));
		}

		// 2. Collect unique snippets across all presets
		const allSnippetNames = new Set<string>();
		for (const preset of presets) {
			const enabledSnippets =
				(preset.data[StorageKeys.SNIPPETS] as string[]) || [];
			enabledSnippets.forEach((name) => allSnippetNames.add(name));
		}

		// 3. Add snippets to bundle
		if (allSnippetNames.size > 0) {
			const snippetsFolder = zip.folder('snippets');
			if (snippetsFolder) {
				for (const name of allSnippetNames) {
					const content = await this.bridge.readSnippet(name);
					if (content !== null) {
						snippetsFolder.file(`${name}.css`, content);
					}
				}
			}
		}

		// 4. Collect unique active themes across all presets
		const allThemeNames = new Set<string>();
		for (const preset of presets) {
			const themeName = preset.data[StorageKeys.THEME] as string | undefined;
			if (themeName && themeName !== 'default') {
				allThemeNames.add(themeName);
			}
		}

		// 5. Add themes to bundle
		if (allThemeNames.size > 0) {
			const themesFolder = zip.folder('themes');
			if (themesFolder) {
				for (const themeName of allThemeNames) {
					const cssContent = await this.bridge.readThemeCss(themeName);
					const manifestContent =
						await this.bridge.readThemeManifest(themeName);
					if (cssContent !== null || manifestContent !== null) {
						const specificThemeFolder = themesFolder.folder(themeName);
						if (specificThemeFolder) {
							if (cssContent !== null) {
								specificThemeFolder.file('theme.css', cssContent);
							}
							if (manifestContent !== null) {
								specificThemeFolder.file('manifest.json', manifestContent);
							}
						}
					}
				}
			}
		}

		return await zip.generateAsync({
			type: 'uint8array',
			compression: 'DEFLATE',
			compressionOptions: { level: 6 },
		});
	}

	/**
	 * Extracts preset data and snippet contents from a ZIP bundle.
	 * Supports single preset or bulk presets with various extensions.
	 */
	async extractBundle(data: ArrayBuffer): Promise<BundleData> {
		const zip = await JSZip.loadAsync(data);
		let presets: Preset[] = [];

		// Flexible search for preset data (preset.json, preset.md, preset.txt, etc.)
		const allFiles = Object.keys(zip.files);

		const singleFileKey = allFiles.find((f) =>
			/^preset\.(json|md|txt)$/.test(f)
		);
		const bulkFileKey = allFiles.find((f) =>
			/^presets\.(json|md|txt)$/.test(f)
		);

		if (singleFileKey) {
			const content = await zip.file(singleFileKey).async('string');
			presets.push(JSON.parse(content) as Preset);
		} else if (bulkFileKey) {
			const content = await zip.file(bulkFileKey).async('string');
			presets = JSON.parse(content) as Preset[];
		} else {
			// Fallback: check presets/ folder
			const presetsFolder = zip.folder('presets');
			if (presetsFolder) {
				const files = presetsFolder.filter((path) =>
					/\.(json|md|txt)$/.test(path)
				);
				for (const file of files) {
					const content = await file.async('string');
					presets.push(JSON.parse(content) as Preset);
				}
			}
		}

		if (presets.length === 0) {
			throw new Error('Invalid bundle: No preset data found.');
		}

		const snippets: { name: string; content: string }[] = [];
		const snippetsFolder = zip.folder('snippets');
		if (snippetsFolder) {
			const files = snippetsFolder.filter((path) => path.endsWith('.css'));
			for (const file of files) {
				const name = file.name.replace(/^snippets\//, '').replace(/\.css$/, '');
				if (!name) continue;

				const content = await file.async('string');
				snippets.push({ name, content });
			}
		}

		const themes: {
			name: string;
			files: { filename: string; content: string }[];
		}[] = [];
		const themesFolder = zip.folder('themes');
		if (themesFolder) {
			const themeNames = new Set<string>();
			themesFolder.forEach((relativePath) => {
				const parts = relativePath.split('/');
				if (parts.length > 0 && parts[0]) {
					themeNames.add(parts[0]);
				}
			});
			for (const themeName of themeNames) {
				const themeFiles: { filename: string; content: string }[] = [];
				const cssFile = themesFolder.file(`${themeName}/theme.css`);
				const manifestFile = themesFolder.file(`${themeName}/manifest.json`);
				if (cssFile) {
					const content = await cssFile.async('string');
					themeFiles.push({ filename: 'theme.css', content });
				}
				if (manifestFile) {
					const content = await manifestFile.async('string');
					themeFiles.push({ filename: 'manifest.json', content });
				}
				if (themeFiles.length > 0) {
					themes.push({ name: themeName, files: themeFiles });
				}
			}
		}

		return { presets, snippets, themes };
	}
}

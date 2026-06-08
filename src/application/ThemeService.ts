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
import { ACCENT_COLOR_KEY, APPEARANCE_KEY, THEME_KEY } from '../constants';
import { NotificationService } from './NotificationService';

import { ObsidianBridge } from '../infrastructure/bridge/ObsidianBridge';
import { Logger } from '../utils/Logger';

export type AppearanceMode = 'light' | 'dark' | 'system' | string;

/**
 * Deps injected by SettingsService to avoid circular references.
 */
export interface ThemeServiceDeps {
	bridge: ObsidianBridge;
	isIsolateMode: () => boolean;
	getSetting: (key: string) => unknown;
	setSetting: (key: string, value: unknown, options?: { silentUI?: boolean }) => void;
	triggerEvent: (name: string) => void;
	notifications: NotificationService;
}

/**
 * Manages theme and appearance lifecycle, including:
 * - Persistent theme application (writes to appearance.json)
 * - Session-only (Isolate Mode) theme injection via <style> tag
 * - Appearance mode (dark/light/system) application
 * - The native theme-css tag suppression/restoration
 * - The body class guard that strips rogue theme classes in Isolate Mode
 */
export class ThemeService {
	public isApplyingTheme: boolean = false;
	public isApplyingPersistentTheme: boolean = false;
	public isApplyingVisualTheme: boolean = false;

	private themeObserver: MutationObserver | null = null;
	private bodyObserver: MutationObserver | null = null;

	constructor(private deps: ThemeServiceDeps) {}

	/**
	 * Applies the given theme visually using the session method for all devices.
	 * If persist=true, it ALSO writes the theme to appearance.json as the master locker,
	 * ensuring synced devices share the configuration.
	 */
	async applyTheme(themeName: string, persist: boolean): Promise<void> {
		if (this.isApplyingVisualTheme) return;

		this.isApplyingTheme = true;
		this.isApplyingPersistentTheme = persist;

		try {
			await this.applySessionTheme(themeName);

			if (persist) {
				const targetTheme =
					themeName === 'default' || !themeName ? '' : themeName;
				this.deps.bridge.setNativeConfig('cssTheme', targetTheme);
			}
		} finally {
			this.isApplyingPersistentTheme = false;
			this.isApplyingTheme = false;
		}
	}

	private async applySessionTheme(themeName: string): Promise<void> {
		this.hideNativeTheme();
		this.startBodyGuard();

		this.isApplyingVisualTheme = true;
		try {
			this.deps.bridge.setNativeTheme('');
		} finally {
			this.isApplyingVisualTheme = false;
		}

		if (themeName === 'default' || !themeName) {
			const localTag = document.getElementById('style-manager-session-theme');
			if (localTag) localTag.remove();
			return;
		}

		try {
			const themePath = this.deps.bridge.getThemePath(themeName);
			const cssContent = await this.deps.bridge.readNativeFile(themePath);

			let styleTag = document.getElementById(
				'style-manager-session-theme'
			) as HTMLStyleElement;
			if (!styleTag) {
				styleTag = document.createElement('style');
				styleTag.id = 'style-manager-session-theme';
				document.head.appendChild(styleTag);
			}

			styleTag.textContent = cssContent;
			this.deps.bridge.triggerEvent('parse-style-manager');
		} catch {
			this.deps.notifications.error(`Could not load theme: ${themeName}`);
		}
	}

	applyAppearance(mode: AppearanceMode, persist: boolean = false): void {
		const isIsolate = this.deps.isIsolateMode();

		if (persist && !isIsolate) {
			this.isApplyingTheme = true;
			this.isApplyingPersistentTheme = true;
			try {
				const targetTheme =
					mode === 'light' ? 'moonstone' : mode === 'dark' ? 'obsidian' : '';
				// We allow empty string (system) to be pushed to native config
				this.deps.bridge.setNativeConfig('theme', targetTheme);
			} finally {
				this.isApplyingPersistentTheme = false;
				this.isApplyingTheme = false;
			}
		}

		const body = document.body;
		let targetMode = mode;
		const isFollowSync = mode === 'system' || !mode;

		if (isFollowSync) {
			if (!isIsolate) {
				body.classList.remove('theme-light', 'theme-dark');
			}
			const nativeTheme = this.deps.bridge.getNativeConfig('theme');
			targetMode = nativeTheme === 'moonstone' ? 'light' : 'dark';
		}

		if (targetMode === 'dark') {
			body.classList.remove('theme-light');
			body.classList.add('theme-dark');
		} else if (targetMode === 'light') {
			body.classList.remove('theme-dark');
			body.classList.add('theme-light');
		}
	}

	applyAccentColor(color: string, persist: boolean = false): void {
		const isIsolate = this.deps.isIsolateMode();

		if (persist && !isIsolate) {
			this.isApplyingTheme = true;
			this.isApplyingPersistentTheme = true;
			try {
				this.deps.bridge.setNativeConfig('accentColor', color);
			} finally {
				this.isApplyingPersistentTheme = false;
				this.isApplyingTheme = false;
			}
		}

		// Remove old style tag if it exists from previous version
		const oldTag = document.getElementById('style-manager-accent-overrides');
		if (oldTag) oldTag.remove();

		const body = document.body;
		const vars = [
			'--accent-color',
			'--accent-h',
			'--accent-s',
			'--accent-l',
			'--interactive-accent',
			'--interactive-accent-rgb',
		];

		if (!color) {
			vars.forEach((v) => body.style.removeProperty(v));
			return;
		}

		const hsl = this.hexToHsl(color);
		const rgb = this.hexToRgb(color);

		body.style.setProperty('--accent-color', color);
		body.style.setProperty('--accent-h', `${hsl.h}`);
		body.style.setProperty('--accent-s', `${hsl.s}%`);
		body.style.setProperty('--accent-l', `${hsl.l}%`);
		body.style.setProperty('--interactive-accent', color);
		body.style.setProperty(
			'--interactive-accent-rgb',
			`${rgb.r}, ${rgb.g}, ${rgb.b}`
		);
	}

	private hexToHsl(hex: string): { h: number; s: number; l: number } {
		let r = 0,
			g = 0,
			b = 0;
		// Strip alpha if present
		if (hex.length >= 7) {
			r = parseInt(hex.slice(1, 3), 16);
			g = parseInt(hex.slice(3, 5), 16);
			b = parseInt(hex.slice(5, 7), 16);
		} else if (hex.length === 4) {
			r = parseInt(hex[1] + hex[1], 16);
			g = parseInt(hex[2] + hex[2], 16);
			b = parseInt(hex[3] + hex[3], 16);
		}
		r /= 255;
		g /= 255;
		b /= 255;
		const max = Math.max(r, g, b),
			min = Math.min(r, g, b);
		let h = 0,
			s = 0;
		const l = (max + min) / 2;
		if (max !== min) {
			const d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
			switch (max) {
				case r:
					h = (g - b) / d + (g < b ? 6 : 0);
					break;
				case g:
					h = (b - r) / d + 2;
					break;
				case b:
					h = (r - g) / d + 4;
					break;
			}
			h /= 6;
		}
		return {
			h: Math.round(h * 360),
			s: Math.round(s * 100),
			l: Math.round(l * 100),
		};
	}

	private hexToRgb(hex: string): { r: number; g: number; b: number } {
		let r = 0,
			g = 0,
			b = 0;
		if (hex.length >= 7) {
			r = parseInt(hex.slice(1, 3), 16);
			g = parseInt(hex.slice(3, 5), 16);
			b = parseInt(hex.slice(5, 7), 16);
		} else if (hex.length === 4) {
			r = parseInt(hex[1] + hex[1], 16);
			g = parseInt(hex[2] + hex[2], 16);
			b = parseInt(hex[3] + hex[3], 16);
		}
		return { r, g, b };
	}

	/**
	 * Adopts the Obsidian native theme and appearance into the settings buffer,
	 * avoiding redundant sync writes. Called during load() in Shared Mode.
	 *
	 * @returns true if any setting was adopted (signals a silent save is needed).
	 */
	adoptNativeSettings(
		getSettingValue: (key: string) => unknown,
		setSettingValue: (key: string, val: unknown) => void
	): boolean {
		if (this.deps.isIsolateMode()) return false;
		let modified = false;

		const rawNativeTheme = (this.deps.bridge.getActiveTheme() || '').trim();
		const nativeTheme = rawNativeTheme || 'default';
		const ourTheme =
			((getSettingValue(THEME_KEY) as string) || '').trim() || 'default';

		// Blank-Native Guard: SM clears the native theme as part of its CSS injection strategy.
		// After that, getActiveTheme() returns 'default'. If we have a real stored preference,
		// comparing '' against it would produce a false mismatch and overwrite the stored preference.
		const nativeIsBlankBecauseSMCleared =
			!rawNativeTheme && ourTheme !== 'default';

		if (!nativeIsBlankBecauseSMCleared && nativeTheme !== ourTheme) {
			Logger.log(
				`Style Manager | Adopting native theme: ${nativeTheme} (was ${ourTheme})`
			);
			setSettingValue(THEME_KEY, nativeTheme);
			modified = true;
		}

		const nativeAppearance = this.deps.bridge.getActiveAppearance();
		const ourAppearance = getSettingValue(APPEARANCE_KEY);

		if (ourAppearance !== nativeAppearance) {
			Logger.log(
				`Style Manager | Adopting native appearance: ${nativeAppearance} (was ${ourAppearance})`
			);
			setSettingValue(APPEARANCE_KEY, nativeAppearance);
			modified = true;
		}

		const nativeAccent = (
			(this.deps.bridge.getNativeConfig('accentColor') as string) || ''
		).toLowerCase();
		const ourAccent = (
			(getSettingValue(ACCENT_COLOR_KEY) as string) || ''
		).toLowerCase();

		if (nativeAccent && ourAccent !== nativeAccent) {
			Logger.log(
				`Style Manager | Adopting native accent color: ${nativeAccent} (was ${ourAccent})`
			);
			setSettingValue(ACCENT_COLOR_KEY, nativeAccent);
			modified = true;
		}

		return modified;
	}

	/** Installs monkey-patches on vault.getConfig/setConfig and customCss.setTheme. */
	installPatches(): void {
		this.deps.bridge.installPatches(
			(theme: string) => this.deps.setSetting(THEME_KEY, theme, { silentUI: true }),
			() => {
				const appearance = this.deps.getSetting(APPEARANCE_KEY) as string;
				if (appearance && appearance !== 'system')
					return appearance === 'dark' ? 'obsidian' : 'moonstone';
				return this.deps.bridge.getNativeConfig('theme') as string;
			},
			(appearance: string) => {
				const val = appearance === 'obsidian' ? 'dark' : 'light';
				this.deps.setSetting(APPEARANCE_KEY, val, { silentUI: true });
				this.applyAppearance(val);
			},
			() => (this.deps.getSetting(ACCENT_COLOR_KEY) as string) || '',
			(color: string) => {
				this.deps.setSetting(ACCENT_COLOR_KEY, color, { silentUI: true });
				this.applyAccentColor(color);
			},
			() => this.isApplyingPersistentTheme,
			() => this.isApplyingVisualTheme
		);
	}

	/** Removes all monkey-patches. */
	uninstallPatches(): void {
		this.deps.bridge.uninstallPatches();
	}

	/** Suppresses the native theme-css tag and watches for re-insertion. */
	hideNativeTheme(): void {
		const nativeThemeTag = document.getElementById('theme-css');
		if (nativeThemeTag) {
			(nativeThemeTag as HTMLStyleElement).disabled = true;
		}

		if (!this.themeObserver) {
			this.themeObserver = new MutationObserver((mutations) => {
				mutations.forEach((mutation) => {
					mutation.addedNodes.forEach((node) => {
						if (node instanceof HTMLElement && node.id === 'theme-css') {
							(node as HTMLStyleElement).disabled = true;
						}
					});
					if (
						mutation.target instanceof HTMLElement &&
						mutation.target.id === 'theme-css'
					) {
						(mutation.target as HTMLStyleElement).disabled = true;
					}
				});
			});

			this.themeObserver.observe(document.head, {
				childList: true,
				attributes: true,
				subtree: true,
				attributeFilter: ['disabled', 'id'],
			});
		}
	}

	/** Re-enables the native theme-css tag and stops observing. */
	restoreNativeTheme(): void {
		if (this.themeObserver) {
			this.themeObserver.disconnect();
			this.themeObserver = null;
		}
		const nativeThemeTag = document.getElementById('theme-css');
		if (nativeThemeTag) {
			(nativeThemeTag as HTMLStyleElement).disabled = false;
		}
	}

	/** Watches document.body for rogue theme-* classes and removes them (Isolate Mode). */
	startBodyGuard(): void {
		if (this.bodyObserver) return;

		this.bodyObserver = new MutationObserver(() => {
			if (!this.deps.isIsolateMode()) return;

			const themeClasses = Array.from(document.body.classList).filter(
				(cls) =>
					cls.startsWith('theme-') &&
					cls !== 'theme-light' &&
					cls !== 'theme-dark'
			);

			if (themeClasses.length > 0) {
				document.body.classList.remove(...themeClasses);
			}
		});

		this.bodyObserver.observe(document.body, {
			attributes: true,
			attributeFilter: ['class'],
		});
	}

	/** Stops the body class guard observer. */
	stopBodyGuard(): void {
		if (this.bodyObserver) {
			this.bodyObserver.disconnect();
			this.bodyObserver = null;
		}
	}

	/** Full cleanup: uninstall patches, restore theme tag, remove session overrides. */
	cleanup(): void {
		this.uninstallPatches();
		this.stopBodyGuard();
		this.restoreNativeTheme();
		document.getElementById('style-manager-session-theme')?.remove();
		this.applyAppearance('system');
	}
}

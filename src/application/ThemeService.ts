import { NotificationService } from './NotificationService';

import { ObsidianBridge } from '../infrastructure/bridge/ObsidianBridge';
import { Logger } from '../utils/Logger';
import { ThemeServiceDeps, AppearanceMode } from "../types";
import { StorageKeys } from "../constants";

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
		this.isApplyingVisualTheme = true;
		try {
			this.deps.bridge.setNativeTheme(
				themeName === 'default' || !themeName ? '' : themeName
			);
		} finally {
			this.isApplyingVisualTheme = false;
		}

		const localTag = document.getElementById('style-manager-session-theme');
		if (localTag) localTag.remove();
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
			((getSettingValue(StorageKeys.THEME) as string) || '').trim() || 'default';

		// Blank-Native Guard: SM clears the native theme as part of its CSS injection strategy.
		// After that, getActiveTheme() returns 'default'. If we have a real stored preference,
		// comparing '' against it would produce a false mismatch and overwrite the stored preference.
		const nativeIsBlankBecauseSMCleared =
			!rawNativeTheme && ourTheme !== 'default';

		if (!nativeIsBlankBecauseSMCleared && nativeTheme !== ourTheme) {
			Logger.log(
				`Style Manager | Adopting native theme: ${nativeTheme} (was ${ourTheme})`
			);
			setSettingValue(StorageKeys.THEME, nativeTheme);
			modified = true;
		}

		const nativeAppearance = this.deps.bridge.getActiveAppearance();
		const ourAppearance = getSettingValue(StorageKeys.APPEARANCE);

		if (ourAppearance !== nativeAppearance) {
			Logger.log(
				`Style Manager | Adopting native appearance: ${nativeAppearance} (was ${ourAppearance})`
			);
			setSettingValue(StorageKeys.APPEARANCE, nativeAppearance);
			modified = true;
		}

		const nativeAccent = (
			(this.deps.bridge.getNativeConfig('accentColor') as string) || ''
		).toLowerCase();
		const ourAccent = (
			(getSettingValue(StorageKeys.ACCENT_COLOR) as string) || ''
		).toLowerCase();

		if (nativeAccent && ourAccent !== nativeAccent) {
			Logger.log(
				`Style Manager | Adopting native accent color: ${nativeAccent} (was ${ourAccent})`
			);
			setSettingValue(StorageKeys.ACCENT_COLOR, nativeAccent);
			modified = true;
		}

		return modified;
	}

	/** Installs monkey-patches on vault.getConfig/setConfig and customCss.setTheme. */
	installPatches(): void {
		this.deps.bridge.installPatches(
			() => (this.deps.getSetting(StorageKeys.THEME) as string) || '',
			(theme: string) =>
				this.deps.setSetting(StorageKeys.THEME, theme, { silentUI: true }),
			() => {
				const appearance = this.deps.getSetting(StorageKeys.APPEARANCE) as string;
				if (appearance && appearance !== 'system')
					return appearance === 'dark' ? 'obsidian' : 'moonstone';
				return this.deps.bridge.getNativeConfig('theme') as string;
			},
			(appearance: string) => {
				const val = appearance === 'obsidian' ? 'dark' : 'light';
				this.deps.setSetting(StorageKeys.APPEARANCE, val, { silentUI: true });
				this.applyAppearance(val);
			},
			() => (this.deps.getSetting(StorageKeys.ACCENT_COLOR) as string) || '',
			(color: string) => {
				this.deps.setSetting(StorageKeys.ACCENT_COLOR, color, { silentUI: true });
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

	/** Full cleanup: uninstall patches, remove session overrides. */
	cleanup(): void {
		this.uninstallPatches();
		document.getElementById('style-manager-session-theme')?.remove();

		// After uninstalling patches, getNativeConfig returns the TRUE shared theme from disk.
		// We re-apply it so that Obsidian's visuals are restored from Isolate Mode.
		const sharedTheme = this.deps.bridge.getNativeConfig('cssTheme') as string;
		this.deps.bridge.setNativeTheme(sharedTheme);

		this.applyAppearance('system');
	}
}

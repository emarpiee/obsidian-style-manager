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
import {
	ACCENT_COLOR_KEY,
	APPEARANCE_KEY,
	SNIPPETS_KEY,
	THEME_KEY,
} from '../constants';
import type StyleManagerPlugin from '../main';
import { RefreshLevel, StyleManagerSettings } from '../types';
import { ThemeService } from './ThemeService';

import type { StyleGenerator } from '../core/style/StyleGenerator';
import { ObsidianBridge } from '../infrastructure/bridge/ObsidianBridge';
import type { ViewManager } from '../ui/ViewManager';

export interface IsolateModeDelegate {
	getSharedSettings(): StyleManagerSettings;
	setSharedSettings(settings: StyleManagerSettings): void;
	save(options?: { silent?: boolean }): Promise<void>;
	updateMerged(): void;
	applyTheme(themeName: string, persist: boolean): Promise<void>;
	applyAppearance(mode: string, persist?: boolean): void;
	applyAccentColor(color: string, persist?: boolean): void;
	triggerGlobal(event: string): void;
	themeService: ThemeService;
	bridge: ObsidianBridge;
	styleGenerator: StyleGenerator;
	viewManager: ViewManager;
	plugin: StyleManagerPlugin;
}

export class IsolateModeService {
	private _isIsolateMode: boolean = false;
	private _isolateSettings: StyleManagerSettings = {};

	constructor(private delegate: IsolateModeDelegate) {}

	public isIsolateMode(): boolean {
		return this._isIsolateMode;
	}

	public get isolateSettings(): StyleManagerSettings {
		return this._isolateSettings;
	}

	public set isolateSettings(settings: StyleManagerSettings) {
		this._isolateSettings = settings;
	}

	public loadState(isIsolate: boolean, settings: StyleManagerSettings): void {
		this._isIsolateMode = isIsolate;
		this._isolateSettings = settings;
	}

	public async setIsolateMode(
		enabled: boolean,
		options?: { skipSave?: boolean }
	): Promise<void> {
		if (enabled === this._isIsolateMode) return Promise.resolve();
		this._isIsolateMode = enabled;

		if (enabled) {
			const hasExistingSettings = Object.keys(this._isolateSettings).length > 0;
			if (!hasExistingSettings) {
				this._isolateSettings = {
					...this.snapshotSharedToIsolate(),
					...this._isolateSettings,
				};
			}
		}

		const savePromise = options?.skipSave
			? Promise.resolve()
			: this.delegate.save();
		this.delegate.updateMerged();

		const currentTheme =
			this.delegate.plugin.settingsService.settings[THEME_KEY];
		if (currentTheme)
			this.delegate.applyTheme(currentTheme as string, !enabled);

		const currentApp =
			this.delegate.plugin.settingsService.settings[APPEARANCE_KEY];
		if (currentApp)
			this.delegate.applyAppearance(currentApp as string, !enabled);

		const currentAccent =
			this.delegate.plugin.settingsService.settings[ACCENT_COLOR_KEY];
		if (currentAccent)
			this.delegate.applyAccentColor(currentAccent as string, !enabled);

		if (!enabled) {
			await this.delegate.plugin.settingsService.refreshService.trigger(
				RefreshLevel.STYLES_ONLY
			);
		} else {
			await this.delegate.plugin.settingsService.syncSnippetState();
			this.delegate.plugin.settingsService.refreshService.trigger(
				RefreshLevel.STYLES_ONLY
			);
		}

		this.delegate.triggerGlobal('isolate-mode-changed');
		this.delegate.triggerGlobal('device-lockers-updated');

		this.delegate.plugin.settingsService.notifications.isolate(
			`Isolate mode ${enabled ? 'enabled' : 'disabled'}`
		);

		return savePromise;
	}

	public snapshotSharedToIsolate(): Record<string, unknown> {
		const snapshot: Record<string, unknown> = {};
		this.delegate.themeService.isApplyingPersistentTheme = true;
		const sharedSettings = this.delegate.getSharedSettings();

		try {
			Object.keys(sharedSettings).forEach((key) => {
				if (
					key.includes('@@') ||
					key === THEME_KEY ||
					key === APPEARANCE_KEY ||
					key === SNIPPETS_KEY ||
					key === ACCENT_COLOR_KEY
				) {
					snapshot[key] = sharedSettings[key];
				}
			});

			if (!snapshot[THEME_KEY]) {
				const currentTheme =
					this.delegate.bridge.getNativeConfig('cssTheme') || 'default';
				snapshot[THEME_KEY] = currentTheme;
			}

			if (!snapshot[APPEARANCE_KEY]) {
				const currentAppearance = this.delegate.bridge.getNativeConfig('theme');
				snapshot[APPEARANCE_KEY] =
					currentAppearance === 'moonstone' ? 'light' : 'dark';
			}

			if (!snapshot[ACCENT_COLOR_KEY]) {
				snapshot[ACCENT_COLOR_KEY] =
					this.delegate.bridge.getNativeConfig('accentColor') || '';
			}

			if (!snapshot[SNIPPETS_KEY]) {
				snapshot[SNIPPETS_KEY] = this.delegate.bridge.getEnabledSnippets();
			}
		} finally {
			this.delegate.themeService.isApplyingPersistentTheme = false;
		}
		return snapshot;
	}

	public async resetIsolateSettings(): Promise<void> {
		this._isolateSettings = this.snapshotSharedToIsolate();
		await this.delegate.save();
		this.delegate.updateMerged();
		this.delegate.plugin.settingsService.refreshService.trigger(
			RefreshLevel.FULL_VISUAL
		);

		// Calling trigger to signify completion
		this.delegate.triggerGlobal('isolate-mode-changed');
		this.delegate.plugin.settingsService.notifications.isolate(
			'Isolate settings have been reset to a fresh shared snapshot.'
		);
	}

	public async pushToShared(): Promise<void> {
		this.delegate.themeService.isApplyingPersistentTheme = true;
		try {
			const localTheme = this._isolateSettings[THEME_KEY];
			if (localTheme) {
				const targetTheme =
					localTheme === 'default' || !localTheme ? '' : localTheme;
				this.delegate.bridge.setNativeConfig('cssTheme', targetTheme);
			}

			const localAppearance = this._isolateSettings[APPEARANCE_KEY];
			if (localAppearance) {
				const targetTheme =
					localAppearance === 'dark' ? 'obsidian' : 'moonstone';
				this.delegate.bridge.setNativeConfig('theme', targetTheme);
			}

			const localAccent = this._isolateSettings[ACCENT_COLOR_KEY];
			if (localAccent) {
				this.delegate.bridge.setNativeConfig('accentColor', localAccent);
			}

			const localSnippets = this._isolateSettings[SNIPPETS_KEY];
			if (Array.isArray(localSnippets)) {
				this.delegate.bridge.setNativeConfig(
					'enabledCssSnippets',
					localSnippets
				);
			}
		} finally {
			this.delegate.themeService.isApplyingPersistentTheme = false;
		}

		const sharedSettings = this.delegate.getSharedSettings();
		this.delegate.setSharedSettings({
			...sharedSettings,
			...this._isolateSettings,
		});
		this._isolateSettings = {};
		this._isIsolateMode = false;

		await this.delegate.save();
		this.delegate.updateMerged();
		await this.delegate.plugin.settingsService.refreshService.trigger(
			RefreshLevel.STYLES_ONLY
		);
		this.delegate.triggerGlobal('isolate-mode-changed');
		this.delegate.triggerGlobal('device-lockers-updated');
		this.delegate.plugin.settingsService.notifications.isolate(
			'Isolated styles pushed to shared locker.'
		);
	}
}

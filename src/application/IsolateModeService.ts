import { StorageKeys } from '../constants';
import {
	IsolateModeDelegate,
	RefreshLevel,
	StyleManagerSettings,
} from '../types';

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
			this.delegate.plugin.settingsService.settings[StorageKeys.THEME];
		if (currentTheme)
			void this.delegate.applyTheme(currentTheme as string, !enabled);

		const currentApp =
			this.delegate.plugin.settingsService.settings[StorageKeys.APPEARANCE];
		if (currentApp)
			this.delegate.applyAppearance(currentApp as string, !enabled);

		const currentAccent =
			this.delegate.plugin.settingsService.settings[StorageKeys.ACCENT_COLOR];
		if (currentAccent)
			this.delegate.applyAccentColor(currentAccent as string, !enabled);

		const currentSnippets =
			(this.delegate.plugin.settingsService.settings[
				StorageKeys.SNIPPETS
			] as string[]) || [];
		await this.delegate.plugin.settingsService.applySnippets(
			currentSnippets,
			enabled
		);

		if (!enabled) {
			await this.delegate.plugin.settingsService.refreshService.trigger(
				RefreshLevel.STYLES_ONLY
			);
		} else {
			await this.delegate.plugin.settingsService.syncSnippetState();
			void this.delegate.plugin.settingsService.refreshService.trigger(
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
					key === StorageKeys.THEME ||
					key === StorageKeys.APPEARANCE ||
					key === StorageKeys.SNIPPETS ||
					key === StorageKeys.ACCENT_COLOR
				) {
					snapshot[key] = sharedSettings[key];
				}
			});

			if (!snapshot[StorageKeys.THEME]) {
				const currentTheme =
					this.delegate.bridge.getNativeConfig('cssTheme') || 'default';
				snapshot[StorageKeys.THEME] = currentTheme;
			}

			if (!snapshot[StorageKeys.APPEARANCE]) {
				const currentAppearance = this.delegate.bridge.getNativeConfig('theme');
				snapshot[StorageKeys.APPEARANCE] =
					currentAppearance === 'moonstone' ? 'light' : 'dark';
			}

			if (!snapshot[StorageKeys.ACCENT_COLOR]) {
				snapshot[StorageKeys.ACCENT_COLOR] =
					this.delegate.bridge.getNativeConfig('accentColor') || '';
			}

			if (!snapshot[StorageKeys.SNIPPETS]) {
				snapshot[StorageKeys.SNIPPETS] =
					this.delegate.bridge.getEnabledSnippets();
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
		void this.delegate.plugin.settingsService.refreshService.trigger(
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
			const localTheme = this._isolateSettings[StorageKeys.THEME];
			if (localTheme) {
				const targetTheme =
					localTheme === 'default' || !localTheme ? '' : localTheme;
				this.delegate.bridge.setNativeConfig('cssTheme', targetTheme);
			}

			const localAppearance = this._isolateSettings[StorageKeys.APPEARANCE];
			if (localAppearance) {
				const targetTheme =
					localAppearance === 'dark' ? 'obsidian' : 'moonstone';
				this.delegate.bridge.setNativeConfig('theme', targetTheme);
			}

			const localAccent = this._isolateSettings[StorageKeys.ACCENT_COLOR];
			if (localAccent) {
				this.delegate.bridge.setNativeConfig('accentColor', localAccent);
			}

			const localSnippets = this._isolateSettings[StorageKeys.SNIPPETS];
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

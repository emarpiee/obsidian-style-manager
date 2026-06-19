import { App, Component, Menu, setIcon, setTooltip } from 'obsidian';

import StyleManagerPlugin from '../../../main';
import { addApplyOptionsToMenu } from '../../tabs/preset/PresetMenuHelper';

export class IsolateModeHeader extends Component {
	private el: HTMLElement | null = null;

	constructor(
		private app: App,
		private plugin: StyleManagerPlugin,
		private containerEl: HTMLElement
	) {
		super();
	}

	setContainer(el: HTMLElement): void {
		this.containerEl = el;
	}

	onload(): void {
		this.registerEvent(
			this.plugin.settingsService.on('isolate-mode-changed', () => {
				this.update();
			})
		);
	}

	/**
	 * Renders a compact status badge into the provided parent element.
	 */
	renderBadge(parentEl: HTMLElement): void {
		const isIsolated = this.plugin.settingsService.isIsolateMode();
		this.el = parentEl.createDiv('style-manager-isolate-badge');
		if (isIsolated) {
			this.el.addClass('is-active');
		}

		setTooltip(
			this.el,
			isIsolated ? 'Manage isolate mode' : 'Enable isolate mode'
		);

		const iconEl = this.el.createSpan('style-manager-isolate-badge-icon');
		setIcon(iconEl, isIsolated ? 'lock' : 'lock-open');

		this.el.createSpan({
			cls: 'style-manager-isolate-badge-text',
			text: 'Isolated',
		});

		this.el.onclick = (_e: MouseEvent): void => {
			if (!isIsolated) {
				// Directly enable Isolate Mode when clicked while disabled
				this.plugin.settingsService.setIsolateMode(true);
				return;
			}

			// Show management menu only when already in Isolate Mode
			const menu = new Menu();

			const isolateSettings = this.plugin.settingsService.getIsolateSettings();
			const sourceName = 'Local isolated locker';

			addApplyOptionsToMenu(
				menu,
				this.plugin,
				{ name: sourceName, data: isolateSettings },
				{
					hideIsolate: true,
					onApplyShared: async () => {
						await this.plugin.settingsService.pushToShared();
					},
					onApplyRemote: async (deviceId: string) => {
						await this.plugin.settingsService.identity.applyPresetToLocker(
							deviceId,
							isolateSettings
						);
						this.plugin.settingsService.notifications.isolate(
							`Settings for "${sourceName}" applied to isolated locker.`
						);
					},
				}
			);

			menu.addSeparator();

			menu.addItem((item) =>
				item
					.setTitle('Disable isolate mode')
					.setIcon('lock-open')
					.onClick(() => {
						this.plugin.settingsService.setIsolateMode(false);
					})
			);

			const rect = this.el.getBoundingClientRect();
			menu.showAtPosition({ x: rect.left, y: rect.bottom });
		};
	}

	/**
	 * Forced update of the banner state.
	 * Currently expects to be re-rendered via the main StyleManagerLayoutRenderer.
	 */
	update(): void {
		// The actual re-render is triggered by SettingMarkup.rerender()
		// which is typically called when settings change.
	}
}

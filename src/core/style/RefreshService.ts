import { StyleGenerator } from './StyleGenerator';

import { RefreshLevel, RefreshOptions, RefreshDelegates } from '../../types';
import { ViewManager } from '../../ui/ViewManager';

/**
 * Service for centralizing UI and CSS refresh operations.
 */
export class RefreshService {
	private delegates: RefreshDelegates = {};

	constructor(
		private styleGenerator: StyleGenerator,
		private viewManager: ViewManager
	) {}

	public setDelegates(delegates: RefreshDelegates): void {
		this.delegates = delegates;
	}

	public trigger(
		level: RefreshLevel,
		options?: RefreshOptions
	): void | Promise<void> {
		if (level >= RefreshLevel.SYSTEM_RELOAD && this.delegates.systemReload) {
			return this.delegates.systemReload(options);
		}

		if (level >= RefreshLevel.PARSE_CSS && this.delegates.parseCSS) {
			this.delegates.parseCSS();
			return; // PARSE_CSS internally handles lower levels
		}

		if (level >= RefreshLevel.FULL_VISUAL) {
			this.fullRefresh();
			return;
		}

		if (level === RefreshLevel.STYLES_ONLY) {
			this.refreshStylesOnly();
			return;
		}

		if (level === RefreshLevel.UI_ONLY) {
			this.rerenderUI();
			return;
		}
	}

	/**
	 * Full visual refresh: removes all classes, re-initializes them,
	 * updates CSS variables, and re-renders all UI components.
	 */
	private fullRefresh(): void {
		this.styleGenerator.removeClasses();
		this.styleGenerator.initClasses();
		this.styleGenerator.setCSSVariables();
		this.viewManager.rerenderAll();
	}

	/**
	 * Partial refresh: only updates CSS variables and classes without a full UI re-render.
	 */
	private refreshStylesOnly(): void {
		this.styleGenerator.removeClasses();
		this.styleGenerator.initClasses();
		this.styleGenerator.setCSSVariables();
	}

	/**
	 * Just rerenders the UI components.
	 */
	private rerenderUI(): void {
		this.viewManager.rerenderAll();
	}
}

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
import { StyleGenerator } from './StyleGenerator';

import { RefreshLevel, RefreshOptions } from '../../types';
import { ViewManager } from '../../ui/ViewManager';

export interface RefreshDelegates {
	parseCSS?: () => void;
	systemReload?: (options?: RefreshOptions) => Promise<void>;
}

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

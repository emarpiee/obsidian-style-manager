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
import fuzzysort from 'fuzzysort';
import { Component } from 'obsidian';

import { SettingsService } from '../../../application/SettingsService';
import { CSSSetting } from '../../../types';
import { getDescription, getTitle } from '../../../utils/CommonUtils';

export abstract class AbstractSettingComponent extends Component {
	parent: AbstractSettingComponent | HTMLElement;
	childEl: HTMLElement | null = null;
	sectionId: string;
	sectionName: string;
	setting: CSSSetting;
	settingsService: SettingsService;
	isView: boolean;
	preparedTitle: Fuzzysort.Prepared;
	preparedDescription: Fuzzysort.Prepared;
	preparedSection: Fuzzysort.Prepared;

	constructor(
		parent: AbstractSettingComponent | HTMLElement,
		sectionId: string,
		sectionName: string,
		setting: CSSSetting,
		settingsService: SettingsService,
		isView: boolean
	) {
		super();
		this.parent = parent;
		this.sectionId = sectionId;
		this.sectionName = sectionName;
		this.setting = setting;
		this.settingsService = settingsService;
		this.isView = isView;

		this.preparedTitle = fuzzysort.prepare(getTitle(setting));
		this.preparedDescription = fuzzysort.prepare(getDescription(setting) || '');
		this.preparedSection = fuzzysort.prepare(sectionName);
	}

	get containerEl(): HTMLElement {
		return this.parent instanceof HTMLElement
			? this.parent
			: (this.parent.childEl as HTMLElement);
	}

	onload(): void {
		this.render();
	}

	onunload(): void {
		this.destroy();
	}

	/**
	 * Matches the Component against `str`. A perfect match returns 0, no match returns negative infinity.
	 *
	 * @param str the string to match this Component against.
	 */
	match(str: string): number {
		if (!str) {
			return Number.NEGATIVE_INFINITY;
		}

		return Math.max(
			fuzzysort.single(str, this.preparedTitle)?.score ??
				Number.NEGATIVE_INFINITY,
			fuzzysort.single(str, this.preparedDescription)?.score ??
				Number.NEGATIVE_INFINITY,
			fuzzysort.single(str, this.preparedSection)?.score ??
				Number.NEGATIVE_INFINITY
		);
	}

	/**
	 * Matches the Component against `str`. A match returns true, no match  or a bad match returns false.
	 *
	 * @param str the string to match this Component against.
	 */
	decisiveMatch(str: string): boolean {
		return this.match(str) > -100000;
	}

	/**
	 * Renders the Component and all it's children into `containerEl`.
	 */
	abstract render(): void;

	/**
	 * Destroys the component and all it's children.
	 */
	abstract destroy(): void;

	/**
	 * Adds or removes the 'is-modified' class based on whether the setting is customized.
	 */
	updateModifiedClass(el?: HTMLElement): void {
		const target =
			el ??
			(this as unknown as { settingEl?: { settingEl: HTMLElement } }).settingEl
				?.settingEl;
		if (!target) return;

		if (this.isModified()) {
			target.addClass('is-modified');
		} else {
			target.removeClass('is-modified');
		}

		// Also update all parent heading count badges recursively
		let currentParent: unknown = this.parent;
		while (currentParent) {
			if (
				typeof (currentParent as { updateCountBadge?: () => void })
					.updateCountBadge === 'function'
			) {
				(currentParent as { updateCountBadge: () => void }).updateCountBadge();
			}
			currentParent = (currentParent as { parent?: unknown }).parent;
		}
	}

	/**
	 * Returns true if this setting has been modified.
	 */
	isModified(): boolean {
		return this.settingsService.getSetting(
			this.sectionId,
			this.setting.id
		) !== undefined;
	}

	/**
	 * Returns the number of results this component represents.
	 */
	getMatchCount(showModifiedOnly: boolean): number {
		return 1;
	}
}

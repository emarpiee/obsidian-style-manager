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
		if (str.startsWith('@id ')) {
			const searchId = str.substring(4).trim().toLowerCase();
			return this.setting.id.toLowerCase().includes(searchId);
		}
		if (str.startsWith('@heading ')) {
			const searchHeading = str.substring(9).trim().toLowerCase();
			if (this.setting.type !== 'heading') {
				return false;
			}
			if (!searchHeading) {
				return true;
			}
			return getTitle(this.setting).toLowerCase().includes(searchHeading);
		}
		if (str.startsWith('@title ') || str === '@title') {
			const searchTitle = str.startsWith('@title ')
				? str.substring(7).trim().toLowerCase()
				: '';
			if (!searchTitle) {
				return true;
			}
			return (getTitle(this.setting) ?? '').toLowerCase().includes(searchTitle);
		}
		if (str.startsWith('@type ')) {
			const searchType = str.substring(6).trim().toLowerCase();
			const knownTypes = [
				'heading', 'info-text', 'class-toggle', 'class-select', 
				'variable-text', 'variable-number', 'variable-number-slider', 
				'variable-select', 'variable-color', 'variable-themed-color', 
				'color-gradient'
			];
			if (knownTypes.includes(searchType)) {
				return this.setting.type.toLowerCase() === searchType;
			}
			return this.setting.type.toLowerCase().includes(searchType);
		}
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
		return (
			this.settingsService.getSetting(this.sectionId, this.setting.id) !==
			undefined
		);
	}

	/**
	 * Returns the number of results this component represents.
	 */
	getMatchCount(_showModifiedOnly: boolean): number {
		return 1;
	}

	/**
	 * Refreshes the visual state of the component.
	 * This is a no-op in the base class but can be overridden by child components
	 * to update their UI when settings are changed externally.
	 */
	refresh(): void {}
}

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
import { Platform, Setting, setIcon, setTooltip } from 'obsidian';

import { ClassMultiToggleSettingComponent } from './ClassMultiToggleSettingComponent';
import { ClassToggleSettingComponent } from './ClassToggleSettingComponent';
import { InfoTextSettingComponent } from './InfoTextSettingComponent';
import { VariableColorSettingComponent } from './VariableColorSettingComponent';
import { VariableNumberSettingComponent } from './VariableNumberSettingComponent';
import { VariableNumberSliderSettingComponent } from './VariableNumberSliderSettingComponent';
import { VariableSelectSettingComponent } from './VariableSelectSettingComponent';
import { VariableTextSettingComponent } from './VariableTextSettingComponent';
import { VariableThemedColorSettingComponent } from './VariableThemedColorSettingComponent';

import { SettingsService } from '../../../application/SettingsService';
import { CSSSetting, Heading } from '../../../types';
import { getDescription, getTitle } from '../../../utils/CommonUtils';
import { CSSEditorModal } from '../../modals/CSSEditorModal';
import { SectionStyleModal } from '../../modals/SectionStyleModal';
import { AbstractSettingComponent } from '../base/AbstractSettingComponent';
import { SettingType } from '../base/types';

function createSettingComponent(
	parent: AbstractSettingComponent,
	sectionId: string,
	sectionName: string,
	setting: CSSSetting,
	settingsService: SettingsService,
	isView: boolean
): AbstractSettingComponent | undefined {
	if (setting.type === SettingType.HEADING) {
		return new HeadingSettingComponent(
			parent,
			sectionId,
			sectionName,
			setting,
			settingsService,
			isView
		);
	} else if (setting.type === SettingType.INFO_TEXT) {
		return new InfoTextSettingComponent(
			parent,
			sectionId,
			sectionName,
			setting,
			settingsService,
			isView
		);
	} else if (setting.type === SettingType.CLASS_TOGGLE) {
		return new ClassToggleSettingComponent(
			parent,
			sectionId,
			sectionName,
			setting,
			settingsService,
			isView
		);
	} else if (setting.type === SettingType.CLASS_SELECT) {
		return new ClassMultiToggleSettingComponent(
			parent,
			sectionId,
			sectionName,
			setting,
			settingsService,
			isView
		);
	} else if (setting.type === SettingType.VARIABLE_TEXT) {
		return new VariableTextSettingComponent(
			parent,
			sectionId,
			sectionName,
			setting,
			settingsService,
			isView
		);
	} else if (setting.type === SettingType.VARIABLE_NUMBER) {
		return new VariableNumberSettingComponent(
			parent,
			sectionId,
			sectionName,
			setting,
			settingsService,
			isView
		);
	} else if (setting.type === SettingType.VARIABLE_NUMBER_SLIDER) {
		return new VariableNumberSliderSettingComponent(
			parent,
			sectionId,
			sectionName,
			setting,
			settingsService,
			isView
		);
	} else if (setting.type === SettingType.VARIABLE_SELECT) {
		return new VariableSelectSettingComponent(
			parent,
			sectionId,
			sectionName,
			setting,
			settingsService,
			isView
		);
	} else if (setting.type === SettingType.VARIABLE_COLOR) {
		return new VariableColorSettingComponent(
			parent,
			sectionId,
			sectionName,
			setting,
			settingsService,
			isView
		);
	} else if (setting.type === SettingType.VARIABLE_THEMED_COLOR) {
		return new VariableThemedColorSettingComponent(
			parent,
			sectionId,
			sectionName,
			setting,
			settingsService,
			isView
		);
	} else {
		return undefined;
	}
}

export function buildSettingComponentTree(opts: {
	containerEl: HTMLElement;
	isView: boolean;
	sectionId: string;
	sectionName: string;
	settings: CSSSetting[];
	settingsService: SettingsService;
}): HeadingSettingComponent {
	const {
		containerEl,
		isView,
		sectionId,
		settings,
		settingsService,
		sectionName,
	} = opts;

	const root: HeadingSettingComponent = new HeadingSettingComponent(
		containerEl,
		sectionId,
		sectionName,
		settings[0],
		settingsService,
		isView
	);

	let currentHeading: HeadingSettingComponent = root;

	for (const setting of settings.splice(1)) {
		if (setting.type === 'heading') {
			const newHeading: Heading = setting as Heading;

			if (newHeading.level < currentHeading.setting.level) {
				while (newHeading.level < currentHeading.setting.level) {
					currentHeading = currentHeading.parent;
				}

				if (currentHeading.setting.id === root.setting.id) {
					currentHeading = currentHeading.addSettingChild(
						newHeading
					) as HeadingSettingComponent;
				} else {
					currentHeading = currentHeading.parent.addSettingChild(
						newHeading
					) as HeadingSettingComponent;
				}
			} else if (newHeading.level === currentHeading.setting.level) {
				currentHeading = currentHeading.parent.addSettingChild(
					newHeading
				) as HeadingSettingComponent;
			} else {
				currentHeading = currentHeading.addSettingChild(
					newHeading
				) as HeadingSettingComponent;
			}
		} else {
			currentHeading.addSettingChild(setting);
		}
	}

	return root;
}

export class HeadingSettingComponent extends AbstractSettingComponent {
	settingsService: SettingsService;
	setting: Heading;
	settingEl: Setting;
	parent: HeadingSettingComponent;
	children: AbstractSettingComponent[] = [];
	filteredChildren: AbstractSettingComponent[] = [];
	filterMode: boolean = false;
	filterResultCount: number = 0;
	resultsEl: HTMLElement;
	countEl: HTMLElement;
	sectionEl: HTMLElement;

	render(): void {
		if (!this.containerEl) return;
		const title = getTitle(this.setting);
		const description = getDescription(this.setting);

		this.sectionEl = this.containerEl.createDiv({
			cls: 'style-manager-style-wrapper',
		});

		const headerGroupEl = this.sectionEl.createDiv({
			cls: 'style-manager-style-item-group',
		});

		this.settingEl = new Setting(headerGroupEl);
		this.settingEl.setHeading();
		this.settingEl.setClass('style-manager-style-heading');
		this.settingEl.setName(title);

		if (description) {
			const descEl = headerGroupEl.createDiv({
				cls: 'style-manager-style-heading-description',
				text: description,
			});
			descEl.addEventListener('click', () => {
				this.toggleVisible();
			});
		}

		this.settingEl.settingEl.dataset.level = this.setting.level.toString();
		this.settingEl.settingEl.dataset.id = this.setting.id;

		const iconContainer = createSpan({
			cls: 'style-manager-collapse-indicator',
		});

		setIcon(iconContainer, 'right-triangle');

		this.settingEl.nameEl.prepend(iconContainer);

		this.resultsEl = this.settingEl.nameEl.createSpan({
			cls: 'style-manager-filter-result-count',
			text: this.filterMode ? `${this.filterResultCount} Results` : undefined,
		});

		const leftBadgesContainer = this.settingEl.nameEl.createDiv(
			'style-manager-badge-container mod-left'
		);
		const rightBadgesContainer = this.settingEl.controlEl.createDiv(
			'style-manager-badge-container mod-right'
		);
		this.settingEl.controlEl.prepend(rightBadgesContainer);

		if (
			this.setting.level === 0 &&
			this.setting.sourceType &&
			this.setting.sourceType !== 'Unknown'
		) {
			const type = this.setting.sourceType as string;
			const isReadOnly = type === 'Theme' || type === 'Plugin';
			const badgeText = type;
			const tooltipText = isReadOnly
				? `View source file: ${type} (Read-only)`
				: `Edit source file: ${type}`;

			const sourceBadge = rightBadgesContainer.createSpan({
				cls: `style-manager-badge-primary source-type mode-${type.toLowerCase()}`,
				text: badgeText,
			});
			setTooltip(sourceBadge, tooltipText);

			sourceBadge.addClass('is-clickable');

			sourceBadge.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();

				const app = this.settingsService.plugin.app;
				const id = this.setting.sourceId;
				if (!id) {
					this.settingsService.notifications.error(
						`Cannot edit: could not determine the file ID for this ${type}.`
					);
					return;
				}

				new CSSEditorModal(app, this.settingsService.plugin, {
					type,
					id,
					readOnly: isReadOnly,
				}).open();
			});
		}

		if (this.setting.isDuplicate) {
			const dupBadge = rightBadgesContainer.createSpan({
				cls: 'style-manager-style-id-duplicate-badge-warning',
			});
			setIcon(dupBadge, 'alert-circle');

			const duplicateNames = this.settingsService.plugin.settingsList
				.filter((s) => s.id === this.setting.id)
				.map((s) => s.name);

			const warningMessage = `Duplicate @setting ID detected:\n${duplicateNames.join('\n')}`;
			setTooltip(dupBadge, warningMessage);
			if (Platform.isMobile) {
				dupBadge.onclick = (e): void => {
					e.stopPropagation();
					this.settingsService.notifications.util(warningMessage);
				};
			}
			rightBadgesContainer.prepend(dupBadge);
		}

		this.countEl = leftBadgesContainer.createSpan({
			cls: 'style-manager-badge-primary count is-clickable',
		});
		this.updateCountBadge();

		this.countEl.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.openSectionStyleModal();
		});

		this.settingEl.settingEl.addEventListener('click', () => {
			this.toggleVisible();
		});

		this.addResetButton();

		this.childEl = this.sectionEl.createDiv({
			cls: 'style-manager-style-settings-container',
		});

		const fullId = `${this.sectionId}:${this.setting.id}`;
		const isExpandedInStore =
			this.settingsService.viewManager.isHeadingExpanded(fullId);
		const initialCollapsed = isExpandedInStore
			? false
			: (this.setting.collapsed ?? this.setting.level === 0);

		this.setCollapsed(initialCollapsed);
	}

	destroy(): void {
		this.removeChildren();
		this.sectionEl?.remove();
		this.settingEl = null as unknown as Setting;
		this.childEl = null as unknown as HTMLElement;
	}

	filter(filterString: string, showModifiedOnly: boolean = false): number {
		this.filteredChildren = [];
		this.filterResultCount = 0;

		const headingMatchesString = filterString ? this.decisiveMatch(filterString) : false;

		for (const child of this.children) {
			if (child.setting.type === SettingType.HEADING) {
				const headingChild = child as HeadingSettingComponent;
				
				// Pass empty string if this heading explicitly matched the text search,
				// so children don't get filtered out by text.
				const childResultCount = headingChild.filter(
					headingMatchesString ? '' : filterString,
					showModifiedOnly
				);

				// Include this child heading if:
				// 1. It contains matching children (childResultCount > 0)
				// 2. OR it explicitly matched the search string AND (we aren't filtering by modified OR it has modified children)
				if (
					childResultCount > 0 || 
					(headingMatchesString && (!showModifiedOnly || headingChild.getTotalAppliedCount() > 0))
				) {
					this.filterResultCount += childResultCount;
					this.filteredChildren.push(child);
				}
			} else {
				// For a leaf setting, it matches if:
				// 1. (The parent heading explicitly matched the string OR there's no string OR the setting itself matched the string)
				// AND
				// 2. (We aren't filtering by modified OR it is modified)
				
				const matchesText = headingMatchesString || !filterString || child.decisiveMatch(filterString);
				const matchesModified = !showModifiedOnly || child.isModified();
				
				if (matchesText && matchesModified) {
					this.filteredChildren.push(child);
					this.filterResultCount += 1;
				}
			}
		}

		this.filterMode = !!filterString || headingMatchesString || showModifiedOnly;

		if (this.filterResultCount > 0 || (headingMatchesString && (!showModifiedOnly || this.getTotalAppliedCount() > 0))) {
			this.setCollapsed(false);
		} else {
			this.setCollapsed(true);
		}

		this.renderChildren();
		if (this.filterMode) {
			this.resultsEl?.setText(`${this.filterResultCount} Results`);
		} else {
			this.resultsEl?.empty();
		}

		return this.filterResultCount;
	}

	clearFilter(): void {
		this.filteredChildren = [];

		for (const child of this.children) {
			if (child.setting.type === SettingType.HEADING) {
				(child as HeadingSettingComponent).clearFilter();
			}
		}

		this.filterMode = false;
		this.setCollapsed(true);
		this.renderChildren();
		this.resultsEl?.empty();
	}

	private renderChildren(): void {
		this.removeChildren();
		if (this.setting.collapsed) {
			return;
		}
		if (this.filterMode) {
			for (const child of this.filteredChildren) {
				this.addChild(child);
			}
		} else {
			for (const child of this.children) {
				this.addChild(child);
			}
		}
	}

	private removeChildren(): void {
		for (const child of this.children) {
			this.removeChild(child);
		}
	}

	private toggleVisible(): void {
		this.setCollapsed(!this.setting.collapsed);
	}

	public setCollapsedRecursive(collapsed: boolean): void {
		this.setCollapsed(collapsed);
		for (const child of this.children) {
			if (child.setting.type === SettingType.HEADING) {
				(child as HeadingSettingComponent).setCollapsedRecursive(collapsed);
			}
		}
	}

	public setCollapsed(collapsed: boolean): void {
		this.setting.collapsed = collapsed;
		this.settingEl?.settingEl.toggleClass('is-collapsed', collapsed);

		const fullId = `${this.sectionId}:${this.setting.id}`;
		this.settingsService.viewManager.setHeadingExpanded(fullId, !collapsed);

		if (collapsed) {
			this.removeChildren();
		} else {
			this.renderChildren();
		}
	}

	private addResetButton(): void {
		const { resetFn } = this.setting;
		this.settingEl.addExtraButton((b) => {
			b.setIcon('reset');
			b.setTooltip('Reset configurations in this section');
			b.extraSettingsEl.onClickEvent((e) => {
				e.stopPropagation();
				if (resetFn) {
					resetFn();
				} else {
					const ids = this.getAllChildrenIds();
					this.settingsService.resetSettings(this.sectionId, ids, {
						silentUI: true,
					});
				}
				this.updateChildrenModifiedClass();
				this.updateModifiedClass();
				this.updateCountBadge();
			});
		});
	}

	private updateChildrenModifiedClass(): void {
		for (const child of this.children) {
			child.updateModifiedClass();
			if (child.setting.type === SettingType.HEADING) {
				(child as HeadingSettingComponent).updateChildrenModifiedClass();
			}
		}
	}

	private getLocalChildrenIds(): string[] {
		return this.children
			.filter((child) => child.setting.type !== SettingType.HEADING)
			.map((child) => child.setting.id);
	}

	private getLocalAppliedCount(): number {
		const ids = this.getLocalChildrenIds();
		const applied = this.settingsService.getSettings(this.sectionId, ids);
		return Object.keys(applied).filter((k) => k.includes('@@')).length;
	}

	private hasModifiedChildren(): boolean {
		for (const child of this.children) {
			if (child.setting.type === SettingType.HEADING) {
				const headingChild = child as HeadingSettingComponent;
				if (
					headingChild.getLocalAppliedCount() > 0 ||
					headingChild.hasModifiedChildren()
				) {
					return true;
				}
			}
		}
		return false;
	}

	private getTotalAppliedCount(): number {
		const ids = this.getAllChildrenIds();
		const applied = this.settingsService.getSettings(this.sectionId, ids);
		return Object.keys(applied).filter((k) => k.includes('@@')).length;
	}

	private updateCountBadge(): void {
		if (!this.countEl) return;

		if (this.setting.level === 0) {
			const totalCount = this.getTotalAppliedCount();
			if (totalCount === 0) {
				this.countEl.setText('');
				this.countEl.removeClass('is-visible');
			} else {
				this.countEl.setText(totalCount.toString());
				this.countEl.addClass('is-visible');
			}
			return;
		}

		const localCount = this.getLocalAppliedCount();
		const hasChildrenMod = this.hasModifiedChildren();

		if (localCount === 0 && !hasChildrenMod) {
			this.countEl.setText('');
			this.countEl.removeClass('is-visible');
		} else {
			let text = '';
			if (localCount > 0) {
				text = localCount.toString();
			}
			if (hasChildrenMod) {
				text += text ? ' ↓' : '↓';
			}
			this.countEl.setText(text);
			this.countEl.addClass('is-visible');
		}
	}

	private openSectionStyleModal(): void {
		let title = getTitle(this.setting);
		title =
			this.sectionName === title ? title : `${this.sectionName} > ${title}`;
		new SectionStyleModal(
			this.settingsService.plugin.app,
			this.settingsService.plugin,
			title,
			this.settingsService.getSettings(this.sectionId, this.getAllChildrenIds())
		).open();
	}

	addSettingChild(child: CSSSetting): AbstractSettingComponent | undefined {
		const newSettingComponent = createSettingComponent(
			this,
			this.sectionId,
			this.sectionName,
			child,
			this.settingsService,
			this.isView
		);
		if (!newSettingComponent) {
			return undefined;
		}

		this.children.push(newSettingComponent);
		return newSettingComponent;
	}

	getAllChildrenIds(): string[] {
		const children: string[] = [];
		for (const child of this.children) {
			children.push(child.setting.id);
			if (child.setting.type === SettingType.HEADING) {
				children.push(
					...(child as HeadingSettingComponent).getAllChildrenIds()
				);
			}
		}
		return children;
	}
}

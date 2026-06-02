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
import { Notice, Platform, Setting, setIcon, setTooltip } from 'obsidian';

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
			const warningMessage = 'Duplicate @setting block ID detected';
			setTooltip(dupBadge, warningMessage);
			if (Platform.isMobile) {
				dupBadge.onclick = (e) => {
					e.stopPropagation();
					new Notice(warningMessage);
				};
			}
			rightBadgesContainer.prepend(dupBadge);
		}

		this.countEl = leftBadgesContainer.createSpan({
			cls: 'style-manager-badge-primary count',
		});
		this.updateCountBadge();

		this.settingEl.settingEl.addEventListener('click', () => {
			this.toggleVisible();
		});

		this.addResetButton();
		this.addExportButton();

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

	filter(filterString: string): number {
		this.filteredChildren = [];
		this.filterResultCount = 0;

		const headingMatches = this.decisiveMatch(filterString);

		for (const child of this.children) {
			if (child.setting.type === SettingType.HEADING) {
				const headingChild = child as HeadingSettingComponent;
				// If the parent heading matched, automatically include all children.
				const childResultCount = headingChild.filter(
					headingMatches ? '' : filterString
				);

				if (childResultCount > 0 || headingMatches) {
					this.filterResultCount += childResultCount;
					this.filteredChildren.push(child);
				}
			} else {
				if (headingMatches || child.decisiveMatch(filterString)) {
					this.filteredChildren.push(child);
					this.filterResultCount += 1;
				}
			}
		}

		this.filterMode = !!filterString || headingMatches;

		if (this.filterResultCount > 0 || headingMatches) {
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
			b.setTooltip('Reset settings in this section');
			b.extraSettingsEl.onClickEvent((e) => {
				e.stopPropagation();
				if (resetFn) {
					resetFn();
				} else {
					const ids = this.getAllChildrenIds();
					this.settingsService.resetSettings(this.sectionId, ids);
				}
				this.updateCountBadge();
			});
		});
	}

	private getAppliedCount(): number {
		const ids = this.getAllChildrenIds();
		const applied = this.settingsService.getSettings(this.sectionId, ids);
		// Count every key containing '@@' to match JSON physical count
		return Object.keys(applied).filter((k) => k.includes('@@')).length;
	}

	private updateCountBadge(): void {
		if (!this.countEl) return;
		const count = this.getAppliedCount();
		if (count === 0) {
			this.countEl.setText('');
			this.countEl.removeClass('is-visible');
		} else {
			this.countEl.setText(count.toString());
			this.countEl.addClass('is-visible');
		}
	}

	private addExportButton(): void {
		this.settingEl.addExtraButton((b) => {
			b.setIcon('ellipsis-vertical');
			b.setTooltip('More options');
			b.extraSettingsEl.onClickEvent((e) => {
				e.stopPropagation();
				let title = getTitle(this.setting);
				title =
					this.sectionName === title ? title : `${this.sectionName} > ${title}`;
				new SectionStyleModal(
					this.settingsService.plugin.app,
					this.settingsService.plugin,
					title,
					this.settingsService.getSettings(
						this.sectionId,
						this.getAllChildrenIds()
					)
				).open();
			});
		});
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

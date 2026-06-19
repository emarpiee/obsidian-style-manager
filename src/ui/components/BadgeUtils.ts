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
import { displayTooltip, setIcon, setTooltip } from 'obsidian';

import StyleManagerPlugin from '../../main';
import { copyToClipboard } from '../../utils/UIUtils';

/**
 * Standardized renderer for the snippet badge across different modals.
 * Handles text formatting, styling, and hover tooltips.
 */
export function renderSnippetBadge(
	container: HTMLElement,
	plugin: StyleManagerPlugin,
	value: string[] | string | number | undefined
): HTMLElement | null {
	let count = 0;
	let snippetList: string[] = [];

	if (Array.isArray(value)) {
		count = value.length;
		snippetList = value;
	} else if (typeof value === 'number') {
		count = value;
	} else if (typeof value === 'string' && !isNaN(parseInt(value))) {
		count = parseInt(value);
	}

	if (count === 0 && snippetList.length === 0) return null;

	const badge = container.createSpan({
		cls: 'style-manager-badge-primary snippets',
		text: `${count} ${count === 1 ? 'snippet' : 'snippets'}`,
	});

	if (snippetList.length > 0) {
		const tooltipText = snippetList.join('\n');
		setTooltip(badge, tooltipText);

		badge.addClass('is-clickable');
		badge.onclick = (e: MouseEvent): void => {
			e.preventDefault();
			e.stopPropagation();
			displayTooltip(badge, tooltipText);
		};
	}

	return badge;
}

/** Renders the gray count badge showing number of modified settings. */
export function renderCountBadge(
	container: HTMLElement,
	count: number
): HTMLElement {
	return container.createSpan({
		cls: 'style-manager-badge-primary count',
		text: `${count}`,
	});
}

/** Renders the theme badge, with optional accent color styling. */
export function renderThemeBadge(
	container: HTMLElement,
	plugin: StyleManagerPlugin,
	theme: string,
	accentColor?: string
): HTMLElement {
	const badge = container.createSpan({
		cls: 'style-manager-badge-primary theme dynamic',
		text: theme,
	});

	if (accentColor) {
		badge.style.setProperty('--sm-badge-dynamic-color', accentColor);
		setTooltip(badge, accentColor);
		badge.addClass('is-clickable');
		badge.onclick = (e: MouseEvent): void => {
			e.preventDefault();
			e.stopPropagation();
			copyToClipboard(accentColor);
			displayTooltip(badge, accentColor);
			plugin.settingsService.notifications.util(
				`Accent color ${accentColor} copied to clipboard`
			);
		};
	}

	return badge;
}

/** Renders the appearance badge (Dark/Light) with moon/sun icon. */
export function renderAppearanceBadge(
	container: HTMLElement,
	appearance: string
): HTMLElement {
	const badge = container.createSpan({
		cls: `style-manager-badge-primary appearance mode-${appearance}`,
	});
	setIcon(badge, appearance === 'dark' ? 'moon' : 'sun');
	return badge;
}

/** Renders the accent color badge showing the hex code and matching color preview. */
export function renderAccentBadge(
	container: HTMLElement,
	color: string
): HTMLElement {
	const badge = container.createSpan({
		cls: 'style-manager-badge-primary accent dynamic',
		text: color,
	});

	badge.style.setProperty('--sm-badge-dynamic-color', color);

	return badge;
}

/** Renders the schedule badge showing a calendar icon. */
export function renderScheduleBadge(
	container: HTMLElement,
	description: string,
	onClick?: () => void
): HTMLElement {
	const badge = container.createSpan({
		cls: 'style-manager-badge-primary schedule',
	});
	setIcon(badge, 'clock');
	setTooltip(badge, description);
	badge.addClass('is-clickable');
	badge.onclick = (e: MouseEvent): void => {
		e.preventDefault();
		e.stopPropagation();
		if (onClick) {
			onClick();
		} else {
			displayTooltip(badge, description);
		}
	};
	return badge;
}

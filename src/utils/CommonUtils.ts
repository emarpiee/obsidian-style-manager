import { Meta, WithDescription, WithTitle } from '../types';

import { lang } from '../infrastructure/lang/helpers';

/**
 * Matches @settings blocks in CSS comments:
 * /* @settings
 * ...
 * *\/
 */
export const settingRegExp = /\/\*!?\s*@settings[\r\n]+?([\s\S]+?)\*\//g;

/**
 * Matches @metadata blocks in CSS comments:
 * /* @metadata
 * ...
 * *\/
 */
export const metadataRegExp = /\/\*!?\s*@metadata[\r\n]+?([\s\S]+?)\*\//;

/**
 * Matches a name line in @settings or @metadata:
 * name: My Section
 */
export const nameRegExp = /^name:\s*(.+)$/m;

export function getTitle<T extends Meta>(config: T): string {
	if (lang) {
		return config[`title.${lang}` as keyof WithTitle] || config.title;
	}

	return config.title;
}

export function getDescription<T extends Meta>(config: T): string | undefined {
	if (lang) {
		return (
			config[`description.${lang}` as keyof WithDescription] ||
			config.description
		);
	}

	return config.description;
}

export function sanitizeText(str: string): string {
	if (str === '') {
		return `""`;
	}

	let sanitized = str.replace(/[;<>]/g, '');

	// Balance quotes to prevent CSS syntax errors / Obsidian crash during typing
	const singleQuotes = (sanitized.match(/'/g) || []).length;
	const doubleQuotes = (sanitized.match(/"/g) || []).length;

	if (singleQuotes % 2 !== 0) {
		sanitized += "'";
	}
	if (doubleQuotes % 2 !== 0) {
		sanitized += '"';
	}

	// Balance url( without closing )
	const openUrl = (sanitized.match(/url\(/g) || []).length;
	const closeUrl = (sanitized.match(/\)/g) || []).length;
	if (openUrl > closeUrl) {
		sanitized += ')'.repeat(openUrl - closeUrl);
	}

	return sanitized;
}

export function getFormattedTimestamp(
	format: string = 'YYYYMMDDHHmmss'
): string {
	if (format === '') return '';
	const moment = window.moment;
	return moment().format(format);
}

export function formatPresetDate(
	timestamp: number,
	format: string = 'MMM. DD, YYYY'
): string {
	const moment = window.moment;
	return moment(timestamp).format(format);
}

/**
 * Centralized filter logic for settings and snippets.
 */
export function matchesFilter(query: string, text: string): boolean {
	if (!query) return true;
	return text.toLowerCase().includes(query.toLowerCase());
}

/**
 * Generates a cryptographically random UUID.
 * Falls back to a pseudo-random string for environments without crypto.randomUUID.
 */
export function generateUuid(): string {
	return (
		window.crypto?.randomUUID?.() ?? Math.random().toString(36).substring(2, 15)
	);
}

/**
 * Utility for stable data comparisons and canonicalization.
 */
export class DataUtils {
	/**
	 * Produces a stable object by sorting all keys recursively.
	 */
	public static canonicalize(data: unknown): unknown {
		if (data === null || typeof data !== 'object' || Array.isArray(data)) {
			return data;
		}
		return Object.keys(data)
			.sort()
			.reduce<Record<string, unknown>>((acc, key) => {
				acc[key] = DataUtils.canonicalize(
					(data as Record<string, unknown>)[key]
				);
				return acc;
			}, {});
	}

	/**
	 * Generates a stable string representation of an object for comparison.
	 */
	public static getCanonicalString(data: unknown): string {
		if (data === null || typeof data === 'undefined') return '';
		return JSON.stringify(DataUtils.canonicalize(data));
	}
}

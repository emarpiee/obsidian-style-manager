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
import { Platform } from 'obsidian';

/**
 * Helper for managing touch and mouse gestures in the UI.
 */
export class GestureHelper {
	private static isSwipingForbidden = false;
	private static touchX = 0;
	private static touchY = 0;

	/**
	 * Installs horizontal swipe gestures to switch between tabs.
	 */
	public static installTabSwipeGestures(
		containerEl: HTMLElement,
		tabs: string[],
		currentTab: string,
		onTabChange: (newTab: string) => void
	): void {
		if (!Platform.isMobile && !Platform.isPhone) return;

		containerEl.addEventListener(
			'touchstart',
			(e: TouchEvent) => {
				const target = e.target as HTMLElement;
				if (
					target.closest('.slider') ||
					target.closest('input') ||
					target.closest('.no-swipe') ||
					target.closest('.style-manager-tab') ||
					target.closest('.pcr-app') ||
					target.closest('.pickr') ||
					target.closest('.style-manager-accent-trigger-container')
				) {
					this.isSwipingForbidden = true;
					return;
				}

				this.isSwipingForbidden = false;
				this.touchX = e.changedTouches[0].clientX;
				this.touchY = e.changedTouches[0].clientY;
			},
			{ passive: true }
		);

		containerEl.addEventListener(
			'touchend',
			(e: TouchEvent) => {
				if (this.isSwipingForbidden) return;

				const diffX = e.changedTouches[0].clientX - this.touchX;
				const diffY = e.changedTouches[0].clientY - this.touchY;

				// Check for horizontal swipe (threshold > 50px)
				if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
					const currentIndex = tabs.indexOf(currentTab);
					const nextIndex =
						diffX > 0
							? (currentIndex - 1 + tabs.length) % tabs.length
							: (currentIndex + 1) % tabs.length;

					if (nextIndex !== currentIndex) {
						onTabChange(tabs[nextIndex]);
					}
				}
			},
			{ passive: true }
		);
	}
}

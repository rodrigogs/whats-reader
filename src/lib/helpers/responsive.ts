/**
 * Responsive utility functions for mobile/desktop detection
 * Uses standard breakpoints consistent with app.css
 */

/**
 * Mobile breakpoint: max-width 767px
 * Matches the CSS media queries in app.css
 */
export const MOBILE_BREAKPOINT = 767;

/**
 * Checks if the current viewport is mobile-sized
 * Uses window.matchMedia for consistency with CSS media queries
 * Safe to use in browser environments only
 *
 * @returns true if viewport is <= 767px, false otherwise
 */
export function isMobileViewport(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}
	return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
}

/**
 * Delay for media auto-load on mobile to ensure highlight animation is visible
 * Small enough to feel instant but long enough to show the highlight effect
 */
export const MOBILE_MEDIA_LOAD_DELAY = 100;

/**
 * Checks if the app is running in Electron environment
 * Safe to use in both server and browser contexts
 *
 * @returns true if running in Electron, false otherwise
 */
export function isElectronApp(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}
	return 'electronAPI' in window;
}

/**
 * Checks if the app is running in Electron on macOS
 * macOS Electron apps need special handling for the custom titlebar
 *
 * @returns true if running in Electron on macOS, false otherwise
 */
export function isElectronMac(): boolean {
	if (!isElectronApp()) {
		return false;
	}
	const electronAPI = (
		window as Window & { electronAPI?: { platform?: string } }
	).electronAPI;
	return electronAPI?.platform === 'darwin';
}

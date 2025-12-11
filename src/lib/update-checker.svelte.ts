/**
 * Update checker service for WhatsApp Backup Reader
 *
 * Checks GitHub releases API for new versions and manages user preferences
 * for update notifications (ignore specific version, never ask again).
 */

import { browser } from '$app/environment';

// Storage keys
const STORAGE_KEY_NEVER = 'update_preference_never';
const STORAGE_KEY_IGNORED_VERSION = 'update_ignored_version';

// GitHub API endpoint for latest release
const RELEASES_API_URL =
	'https://api.github.com/repos/rodrigogs/whats-reader/releases/latest';
const RELEASES_PAGE_URL = 'https://github.com/rodrigogs/whats-reader/releases';

// Current app version (injected at build time)
export const currentVersion = `v${__APP_VERSION__}`;

// Reactive state for update availability
let _updateAvailable = $state(false);
let _latestVersion = $state<string | null>(null);
let _releaseUrl = $state<string | null>(null);
let _releaseNotes = $state<string | null>(null);
let _isChecking = $state(false);
let _checkError = $state<string | null>(null);

// Export reactive getters
export function getUpdateState() {
	return {
		get updateAvailable() {
			return _updateAvailable;
		},
		get latestVersion() {
			return _latestVersion;
		},
		get releaseUrl() {
			return _releaseUrl;
		},
		get releaseNotes() {
			return _releaseNotes;
		},
		get isChecking() {
			return _isChecking;
		},
		get checkError() {
			return _checkError;
		},
	};
}

/**
 * Compare two semantic versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
	// Strip 'v' prefix if present
	const cleanA = a.replace(/^v/, '');
	const cleanB = b.replace(/^v/, '');

	const partsA = cleanA.split('.').map((n) => Number.parseInt(n, 10) || 0);
	const partsB = cleanB.split('.').map((n) => Number.parseInt(n, 10) || 0);

	// Ensure both have same length
	const maxLen = Math.max(partsA.length, partsB.length);
	while (partsA.length < maxLen) partsA.push(0);
	while (partsB.length < maxLen) partsB.push(0);

	for (let i = 0; i < maxLen; i++) {
		if (partsA[i] > partsB[i]) return 1;
		if (partsA[i] < partsB[i]) return -1;
	}

	return 0;
}

/**
 * Check if user has set "never ask again" preference
 */
function isNeverAsk(): boolean {
	if (!browser) return false;
	return localStorage.getItem(STORAGE_KEY_NEVER) === 'true';
}

/**
 * Check if a specific version has been ignored
 */
function isVersionIgnored(version: string): boolean {
	if (!browser) return false;
	return localStorage.getItem(STORAGE_KEY_IGNORED_VERSION) === version;
}

/**
 * Set "never ask again" preference
 */
export function setNeverAsk(): void {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY_NEVER, 'true');
	_updateAvailable = false;
}

/**
 * Ignore a specific version (won't prompt again for this version)
 */
export function ignoreVersion(version: string): void {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY_IGNORED_VERSION, version);
	_updateAvailable = false;
}

/**
 * Reset update preferences (for testing or if user changes mind)
 */
export function resetUpdatePreferences(): void {
	if (!browser) return;
	localStorage.removeItem(STORAGE_KEY_NEVER);
	localStorage.removeItem(STORAGE_KEY_IGNORED_VERSION);
}

/**
 * Dismiss the current update notification without setting any preference
 */
export function dismissUpdate(): void {
	_updateAvailable = false;
}

/**
 * Get the URL to the releases page
 */
export function getReleasesPageUrl(): string {
	return RELEASES_PAGE_URL;
}

/**
 * Check for updates from GitHub releases
 * Returns true if a newer version is available
 */
export async function checkForUpdates(): Promise<boolean> {
	if (!browser) return false;

	// Don't check if user said "never"
	if (isNeverAsk()) {
		return false;
	}

	_isChecking = true;
	_checkError = null;

	try {
		const response = await fetch(RELEASES_API_URL, {
			headers: {
				Accept: 'application/vnd.github.v3+json',
			},
		});

		if (!response.ok) {
			throw new Error(`GitHub API returned ${response.status}`);
		}

		const release = await response.json();

		// Skip drafts and prereleases
		if (release.draft || release.prerelease) {
			_isChecking = false;
			return false;
		}

		const latestVersion = release.tag_name as string;

		// Check if this version is ignored
		if (isVersionIgnored(latestVersion)) {
			_isChecking = false;
			return false;
		}

		// Compare versions
		const comparison = compareVersions(latestVersion, currentVersion);

		if (comparison > 0) {
			// Newer version available
			_updateAvailable = true;
			_latestVersion = latestVersion;
			_releaseUrl = release.html_url as string;
			_releaseNotes = release.body as string | null;
			_isChecking = false;
			return true;
		}

		_isChecking = false;
		return false;
	} catch (error) {
		// Silently fail - don't bother user with network errors
		console.debug('Update check failed:', error);
		_checkError =
			error instanceof Error ? error.message : 'Failed to check for updates';
		_isChecking = false;
		return false;
	}
}

/**
 * Initialize update checker with a delay to not block initial render
 * @param delayMs - Delay in milliseconds before checking (default: 3000ms)
 */
export function initUpdateChecker(delayMs = 3000): void {
	if (!browser) return;

	setTimeout(() => {
		checkForUpdates();
	}, delayMs);
}

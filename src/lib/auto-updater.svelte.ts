/**
 * Auto-Updater Service (Electron only)
 * Uses electron-updater for automatic update downloads and installation
 */

import { browser } from '$app/environment';
import { isElectronApp } from '$lib/helpers/responsive';

// Detect if running in Electron
const isElectron = isElectronApp();

// Storage keys for user preferences
const STORAGE_KEY_NEVER_ASK = 'auto_update_never_ask';
const STORAGE_KEY_IGNORED_VERSION = 'auto_update_ignored_version';

// Update state
let updateAvailable = $state(false);
let latestVersion = $state<string | null>(null);
const currentVersion = $state<string>(`v${__APP_VERSION__}`);
let downloadProgress = $state(0);
let isDownloading = $state(false);
let isUpdateReady = $state(false);
let errorMessage = $state<string | null>(null);
let isDismissed = $state(false);

/**
 * Initialize auto-updater (Electron only)
 */
export function initAutoUpdater() {
	if (!isElectron || !window.electronAPI?.updater) return;

	// Setup auto-update listeners
	const unsubscribe = window.electronAPI.updater.onStatus(handleUpdateStatus);

	// Cleanup on app unmount
	if (browser) {
		window.addEventListener('beforeunload', unsubscribe);
	}
}

/**
 * Handle auto-update status events from Electron
 */
function handleUpdateStatus(status: { event: string; data?: unknown }) {
	switch (status.event) {
		case 'checking-for-update':
			errorMessage = null;
			break;

		case 'update-available': {
			const data = status.data as { version?: string } | undefined;
			const version = `v${data?.version || ''}`;

			// Check if user has set "never ask" preference
			if (isNeverAsk()) {
				updateAvailable = false;
				break;
			}

			// Check if this specific version is ignored
			if (isVersionIgnored(version)) {
				updateAvailable = false;
				break;
			}

			updateAvailable = true;
			latestVersion = version;
			isDismissed = false;
			break;
		}

		case 'update-not-available':
			updateAvailable = false;
			break;

		case 'error': {
			const data = status.data as { message?: string } | undefined;
			errorMessage = data?.message || 'Update check failed';
			break;
		}

		case 'download-progress': {
			const data = status.data as { percent?: number } | undefined;
			isDownloading = true;
			downloadProgress = Math.round(data?.percent || 0);
			break;
		}

		case 'update-downloaded':
			isDownloading = false;
			isUpdateReady = true;
			downloadProgress = 100;
			break;
	}
}

/**
 * Download the available update
 */
export async function downloadUpdate() {
	if (!isElectron || !window.electronAPI?.updater) return;

	try {
		await window.electronAPI.updater.downloadUpdate();
	} catch (err) {
		console.error('Failed to download update:', err);
		errorMessage = 'Failed to download update';
	}
}

/**
 * Install and restart with the new update
 */
export function installUpdate() {
	if (!isElectron || !window.electronAPI?.updater) return;

	try {
		window.electronAPI.updater.quitAndInstall();
	} catch (err) {
		console.error('Failed to install update:', err);
		errorMessage = 'Failed to install update';
	}
}

/**
 * Dismiss the update notification (remind me later)
 */
export function dismissUpdate() {
	isDismissed = true;
	updateAvailable = false;
}

/**
 * Check if user has set "never ask again" preference
 */
function isNeverAsk(): boolean {
	if (!browser) return false;
	return localStorage.getItem(STORAGE_KEY_NEVER_ASK) === 'true';
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
	localStorage.setItem(STORAGE_KEY_NEVER_ASK, 'true');
	isDismissed = true;
	updateAvailable = false;
}

/**
 * Ignore a specific version (won't prompt again for this version)
 */
export function ignoreVersion(version: string): void {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY_IGNORED_VERSION, version);
	isDismissed = true;
	updateAvailable = false;
}

/**
 * Get releases page URL
 */
export function getReleasesPageUrl() {
	return 'https://github.com/rodrigogs/whats-reader/releases';
}

/**
 * Export reactive state
 */
export function getAutoUpdaterState() {
	return {
		get updateAvailable() {
			return updateAvailable && !isDismissed;
		},
		get latestVersion() {
			return latestVersion;
		},
		get currentVersion() {
			return currentVersion;
		},
		get downloadProgress() {
			return downloadProgress;
		},
		get isDownloading() {
			return isDownloading;
		},
		get isUpdateReady() {
			return isUpdateReady;
		},
		get errorMessage() {
			return errorMessage;
		},
		get isElectron() {
			return isElectron;
		},
	};
}

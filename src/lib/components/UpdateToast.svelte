<script lang="ts">
/**
 * UpdateToast component
 *
 * A discrete toast notification that appears when a new version is available.
 * Positioned in the bottom-right corner with slide-in animation.
 *
 * Provides three options:
 * - Update: Opens the release URL
 * - Ignore: Ignores this specific version
 * - Never: Never show update notifications again
 */

import { browser } from '$app/environment';
import * as m from '$lib/paraglide/messages';
import {
	currentVersion,
	dismissUpdate,
	getReleasesPageUrl,
	ignoreVersion,
	setNeverAsk,
} from '$lib/update-checker.svelte';

interface Props {
	latestVersion: string;
	releaseUrl: string;
	onClose?: () => void;
}

let { latestVersion, releaseUrl, onClose }: Props = $props();

// Detect if running in Electron
const isElectron =
	browser && typeof window !== 'undefined' && 'electronAPI' in window;

function handleUpdate() {
	if (isElectron && window.electronAPI?.openExternal) {
		window.electronAPI.openExternal(releaseUrl);
	} else if (browser) {
		window.open(releaseUrl, '_blank', 'noopener,noreferrer');
	}
	dismissUpdate();
	onClose?.();
}

function handleIgnore() {
	ignoreVersion(latestVersion);
	onClose?.();
}

function handleNever() {
	setNeverAsk();
	onClose?.();
}

function handleClose() {
	dismissUpdate();
	onClose?.();
}
</script>

<!-- Toast container with slide-in animation -->
<div
	class="fixed bottom-4 right-4 z-50 animate-slide-in-right"
	role="alert"
	aria-live="polite"
>
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden max-w-sm">
		<!-- Header -->
		<div class="flex items-center justify-between px-4 py-3 bg-[var(--color-whatsapp-teal)] text-white">
			<div class="flex items-center gap-2">
				<!-- Update icon -->
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
				</svg>
				<span class="font-semibold text-sm">{m.update_available()}</span>
			</div>
			<!-- Close button -->
			<button
				type="button"
				class="p-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer"
				onclick={handleClose}
				aria-label={m.close()}
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Content -->
		<div class="px-4 py-3">
			<p class="text-sm text-gray-600 dark:text-gray-300 mb-1">
				{m.update_new_version({ version: latestVersion })}
			</p>
			<p class="text-xs text-gray-400 dark:text-gray-500">
				{m.update_current_version({ version: currentVersion })}
			</p>
		</div>

		<!-- Actions -->
		<div class="px-4 pb-3 flex flex-wrap gap-2">
			<!-- Update button (primary) -->
			<button
				type="button"
				class="flex-1 min-w-[80px] px-3 py-1.5 bg-[var(--color-whatsapp-teal)] hover:bg-[var(--color-whatsapp-dark-green)] text-white text-sm font-medium rounded-md transition-colors cursor-pointer"
				onclick={handleUpdate}
			>
				{m.update_update_button()}
			</button>

			<!-- Ignore button (secondary) -->
			<button
				type="button"
				class="flex-1 min-w-[80px] px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md transition-colors cursor-pointer"
				onclick={handleIgnore}
				title={m.update_ignore_tooltip()}
			>
				{m.update_ignore_button()}
			</button>

			<!-- Never button (tertiary) -->
			<button
				type="button"
				class="w-full px-3 py-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 text-xs transition-colors cursor-pointer"
				onclick={handleNever}
				title={m.update_never_tooltip()}
			>
				{m.update_never_button()}
			</button>
		</div>
	</div>
</div>

<style>
	@keyframes slide-in-right {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	.animate-slide-in-right {
		animation: slide-in-right 0.3s ease-out;
	}
</style>

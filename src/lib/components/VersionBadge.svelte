<script lang="ts">
/**
 * VersionBadge component
 *
 * Displays the current app version in a subtle badge.
 * Clicking opens the releases page on GitHub.
 */

import { browser } from '$app/environment';
import * as m from '$lib/paraglide/messages';
import {
	currentVersion,
	getReleasesPageUrl,
	getUpdateState,
} from '$lib/update-checker.svelte';

// Detect if running in Electron
const isElectron =
	browser && typeof window !== 'undefined' && 'electronAPI' in window;

const updateState = getUpdateState();
const releasesUrl = getReleasesPageUrl();

function handleClick(e: MouseEvent) {
	if (isElectron && window.electronAPI?.openExternal) {
		e.preventDefault();
		window.electronAPI.openExternal(releasesUrl);
	}
}
</script>

<a
	href={releasesUrl}
	target="_blank"
	rel="noopener noreferrer"
	class="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800/50"
	title={m.version_view_releases()}
	onclick={handleClick}
>
	<!-- Version icon -->
	<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
	</svg>
	<span>{currentVersion}</span>
	
	<!-- Update available indicator -->
	{#if updateState.updateAvailable}
		<span class="w-2 h-2 bg-[var(--color-whatsapp-teal)] rounded-full animate-pulse" title={m.update_available()}></span>
	{/if}
	
	<!-- Checking indicator -->
	{#if updateState.isChecking}
		<svg class="w-3 h-3 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
		</svg>
	{/if}
</a>

<script lang="ts">
/**
 * VersionBadge component
 *
 * Displays the current app version in a subtle badge.
 * Clicking opens the releases page on GitHub.
 */

import { browser } from '$app/environment';
import Icon from './Icon.svelte';
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
	<Icon name="tag" size="xs" class="w-3.5 h-3.5" />
	<span>{currentVersion}</span>
	
	<!-- Update available indicator -->
	{#if updateState.updateAvailable}
		<span class="w-2 h-2 bg-[var(--color-whatsapp-teal)] rounded-full animate-pulse" title={m.update_available()}></span>
	{/if}
	
	<!-- Checking indicator -->
	{#if updateState.isChecking}
		<Icon name="spinner" size="xs" class="animate-spin text-gray-400" />
	{/if}
</a>

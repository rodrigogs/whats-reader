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
import { isElectronApp } from '$lib/helpers/responsive';
import * as m from '$lib/paraglide/messages';
import {
	currentVersion,
	dismissUpdate,
	getReleasesPageUrl,
	ignoreVersion,
	setNeverAsk,
} from '$lib/update-checker.svelte';
import Button from './Button.svelte';
import Icon from './Icon.svelte';
import IconButton from './IconButton.svelte';

interface Props {
	latestVersion: string;
	releaseUrl: string;
	onClose?: () => void;
}

let { latestVersion, releaseUrl, onClose }: Props = $props();

// Detect if running in Electron
const isElectron = isElectronApp();

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
				<Icon name="spinner" />
				<span class="font-semibold text-sm">{m.update_available()}</span>
			</div>
			<!-- Close button -->
			<IconButton
				theme="dark"
				size="sm"
				rounded="full"
				onclick={handleClose}
				aria-label={m.close()}
			>
				<Icon name="close" size="sm" />
			</IconButton>
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
			<Button
				variant="primary"
				size="sm"
				class="flex-1 min-w-[80px]"
				onclick={handleUpdate}
			>
				{m.update_update_button()}
			</Button>

			<!-- Ignore button (secondary) -->
			<Button
				variant="secondary"
				size="sm"
				class="flex-1 min-w-[80px]"
				onclick={handleIgnore}
				title={m.update_ignore_tooltip()}
			>
				{m.update_ignore_button()}
			</Button>

			<!-- Never button (tertiary) -->
			<Button
				variant="ghost"
				size="sm"
				class="w-full"
				onclick={handleNever}
				title={m.update_never_tooltip()}
			>
				{m.update_never_button()}
			</Button>
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

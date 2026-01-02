<script lang="ts">
/**
 * Auto-Update Toast
 * Shows update notifications and handles download/install flow
 */

import { browser } from '$app/environment';
import {
	dismissUpdate,
	downloadUpdate,
	getAutoUpdaterState,
	getReleasesPageUrl,
	ignoreVersion,
	installUpdate,
	setNeverAsk,
} from '$lib/auto-updater.svelte';
import * as m from '$lib/paraglide/messages';
import Button from './Button.svelte';
import Icon from './Icon.svelte';
import IconButton from './IconButton.svelte';

interface Props {
	onClose?: () => void;
}

let { onClose }: Props = $props();

const state = getAutoUpdaterState();

const isElectron =
	browser && typeof window !== 'undefined' && 'electronAPI' in window;

async function handleUpdate() {
	await downloadUpdate();
}

function handleInstall() {
	installUpdate();
}

function handleRemindLater() {
	dismissUpdate();
	onClose?.();
}

function handleIgnoreVersion() {
	if (state.latestVersion) {
		ignoreVersion(state.latestVersion);
	}
	onClose?.();
}

function handleNeverAsk() {
	setNeverAsk();
	onClose?.();
}

function handleClose() {
	dismissUpdate();
	onClose?.();
}
</script>

{#if state.updateAvailable || state.isDownloading || state.isUpdateReady}
	<div
		class="fixed bottom-4 right-4 z-50 animate-slide-in-right"
		role="alert"
		aria-live="polite"
	>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden max-w-sm">
			<!-- Header -->
			<div class="flex items-center justify-between px-4 py-3 bg-[var(--color-whatsapp-teal)] text-white">
				<div class="flex items-center gap-2">
					<Icon name="spinner" />
					<span class="font-semibold text-sm">
						{#if state.isUpdateReady}
							{m.update_ready()}
						{:else if state.isDownloading}
							{m.update_downloading()}
						{:else}
							{m.update_available()}
						{/if}
					</span>
				</div>
				<IconButton
					theme="dark"
					size="sm"
					rounded="full"
					onclick={handleClose}
					aria-label={m.update_close()}
				>
					<Icon name="close" size="sm" />
				</IconButton>
			</div>

			<!-- Content -->
			<div class="px-4 py-3">
				{#if state.isUpdateReady}
					<!-- Update downloaded and ready -->
					<p class="text-sm text-gray-700 dark:text-gray-300 mb-3">
						{m.update_ready_message({ version: state.latestVersion || '' })}
					</p>
					<div class="flex gap-2">
						<Button
							variant="primary"
							size="sm"
							class="flex-1"
							onclick={handleInstall}
						>
							{m.update_install_restart()}
						</Button>
						<Button
							variant="secondary"
							size="sm"
							onclick={handleRemindLater}
						>
							{m.update_later()}
						</Button>
					</div>
				{:else if state.isDownloading}
					<!-- Downloading update -->
					<p class="text-sm text-gray-700 dark:text-gray-300 mb-2">
						{m.update_downloading_message()}
					</p>
					<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
						<div
							class="bg-[var(--color-whatsapp-teal)] h-2 rounded-full transition-all duration-300"
							style="width: {state.downloadProgress}%"
						></div>
					</div>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
						{state.downloadProgress}%
					</p>
				{:else}
					<!-- Update available -->
					<p class="text-sm text-gray-700 dark:text-gray-300 mb-3">
						{m.update_new_version_message({ current: state.currentVersion, latest: state.latestVersion || '' })}
					</p>
					<!-- Primary actions: Update and Remind Later -->
					<div class="flex gap-2 mb-2">
						<Button
							variant="primary"
							size="sm"
							class="flex-1"
							onclick={handleUpdate}
							title={m.update_download()}
						>
							{m.update_update_button()}
						</Button>
						<Button
							variant="secondary"
							size="sm"
							class="flex-1"
							onclick={handleRemindLater}
							title={m.update_later()}
						>
							{m.update_later()}
						</Button>
					</div>
					<!-- Secondary actions: Ignore Version and Never Ask -->
					<div class="flex gap-2">
						<Button
							variant="ghost"
							size="sm"
							class="flex-1"
							onclick={handleIgnoreVersion}
							title={m.update_ignore_tooltip()}
						>
							{m.update_ignore_button()}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							class="flex-1"
							onclick={handleNeverAsk}
							title={m.update_never_tooltip()}
						>
							{m.update_never_button()}
						</Button>
					</div>
				{/if}

				{#if state.errorMessage}
					<p class="text-xs text-red-600 dark:text-red-400 mt-2">
						{state.errorMessage}
					</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

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
		animation: slide-in-right 0.3s ease-out forwards;
	}
</style>

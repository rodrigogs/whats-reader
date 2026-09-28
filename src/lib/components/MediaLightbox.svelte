<script lang="ts">
import { browser } from '$app/environment';
import { galleryState } from '$lib/gallery.svelte';
import { resolveLightboxItem } from '$lib/helpers/lightbox';
import { isMobileViewport } from '$lib/helpers/responsive';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import { loadMediaFile } from '$lib/parser';
import Icon from './Icon.svelte';
import IconButton from './IconButton.svelte';

interface Props {
	onNavigateToMessage: (messageId: string) => void;
	/** Invoked after navigating on a mobile viewport, so a caller-owned panel
	 * (e.g. the Media Gallery) can close itself to reveal the chat. No-op if
	 * the lightbox was opened from a chat bubble instead of the gallery. */
	onCloseGallery?: () => void;
}

let { onNavigateToMessage, onCloseGallery }: Props = $props();

const lightboxPath = $derived.by(() => galleryState.lightboxMediaPath);

// Resolved against the UNFILTERED list (galleryState.allItems), not the
// gallery's filtered `items`, so a bubble click resolves even while the
// Media Gallery has a participant/type filter active (GH-92 decision 2).
const lightboxItem = $derived.by(() =>
	resolveLightboxItem(galleryState.allItems, lightboxPath),
);

let lightboxUrl = $state<string | null>(null);
let lightboxLoading = $state(false);
let lightboxError = $state<string | null>(null);

$effect(() => {
	const it = lightboxItem;
	if (!it) {
		lightboxUrl = null;
		lightboxError = null;
		lightboxLoading = false;
		return;
	}

	lightboxLoading = true;
	lightboxError = null;

	let isCancelled = false;

	loadMediaFile(it.media)
		.then((url) => {
			if (isCancelled) return;
			lightboxUrl = url;
		})
		.catch((err) => {
			if (isCancelled) return;
			lightboxError = err instanceof Error ? err.message : String(err);
		})
		.finally(() => {
			if (isCancelled) return;
			lightboxLoading = false;
		});

	return () => {
		isCancelled = true;
	};
});

function closeLightbox() {
	galleryState.setLightbox(null);
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape' && lightboxPath) {
		closeLightbox();
	}
}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if lightboxItem}
	<!-- Lightbox: rendered once at the app root so it is visible whether or
	     not the Media Gallery panel is open (GH-92). -->
	<div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
		<button
			type="button"
			class="absolute inset-0 cursor-default"
			onclick={closeLightbox}
			aria-label={m.close()}
		></button>
		<div class="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-xl">
			<div class="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
				<div class="min-w-0">
					<p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{lightboxItem.name}</p>
					<p class="text-xs text-gray-500 dark:text-gray-400 truncate">
						{#if lightboxItem.messageSender}
							{lightboxItem.messageSender}
						{:else}
							{m.media_gallery_unknown_sender()}
						{/if}
						·
						{#if lightboxItem.messageTimestamp}
							{new Date(lightboxItem.messageTimestamp).toLocaleString(getLocale())}
						{:else}
							{m.media_gallery_unknown_date()}
						{/if}
					</p>
				</div>
				<div class="flex items-center gap-2">
					{#if lightboxItem.messageId}
						<button
							type="button"
							class="h-9 w-9 inline-flex items-center justify-center rounded-lg text-[var(--color-whatsapp-teal)] hover:bg-[var(--color-whatsapp-teal)]/10 dark:hover:bg-[var(--color-whatsapp-teal)]/15 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-whatsapp-teal)]/60"
							onclick={() => {
								const messageId = lightboxItem?.messageId;
								closeLightbox();
								if (messageId) {
									onNavigateToMessage(messageId);
									// On mobile devices, close the gallery after navigating
									// This ensures the message is visible and not hidden behind the gallery overlay
									if (browser && isMobileViewport()) {
										onCloseGallery?.();
									}
								}
							}}
							aria-label={m.media_gallery_go_to_message()}
							title={m.media_gallery_go_to_message()}
						>
							<Icon name="arrow-circle-right" size="md" />
						</button>
					{:else}
						<span class="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700">
							{m.media_gallery_unlinked()}
						</span>
					{/if}
					<IconButton
						theme="light"
						size="sm"
						onclick={closeLightbox}
						aria-label={m.close()}
					>
						<Icon name="close" size="md" />
					</IconButton>
				</div>
			</div>

			<div class="bg-black/5 dark:bg-black/20">
				{#if lightboxLoading}
					<div class="p-10 text-center text-sm text-gray-500 dark:text-gray-400">{m.media_gallery_loading()}</div>
				{:else if lightboxError}
					<div class="p-10 text-center text-sm text-red-600 dark:text-red-400">
						{m.media_gallery_load_error()}{#if lightboxError}: {lightboxError}{/if}
					</div>
				{:else if lightboxUrl}
					{#if lightboxItem.type === 'image'}
						<img src={lightboxUrl} alt={lightboxItem.name} class="max-h-[70vh] w-full object-contain" />
					{:else if lightboxItem.type === 'video'}
						<video
							src={lightboxUrl}
							controls
							class="max-h-[70vh] w-full"
							aria-label={lightboxItem.name}
						>
							<track kind="captions" />
						</video>
					{:else if lightboxItem.type === 'audio'}
						<audio
							src={lightboxUrl}
							controls
							class="w-full p-4"
							aria-label={lightboxItem.name}
						></audio>
					{:else}
						<div class="p-6 text-center">
							<a
								href={lightboxUrl}
								download={lightboxItem.name}
								class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-whatsapp-teal)] text-white hover:opacity-90 transition-opacity"
							>
								{lightboxItem.name}
							</a>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}

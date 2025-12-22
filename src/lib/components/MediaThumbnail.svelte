<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import type { GalleryItem } from '$lib/gallery.svelte';
import { getImageThumbnailUrl } from '$lib/gallery-thumbnails';

interface Props {
	item: GalleryItem;
	selected: boolean;
	onToggleSelected: (path: string) => void;
	onOpen: (path: string) => void;
}

let { item, selected, onToggleSelected, onOpen }: Props = $props();

let rootEl = $state<HTMLElement | null>(null);
let thumbnailUrl = $state<string | null>(null);
let isLoadingThumb = $state(false);

let observer: IntersectionObserver | null = null;

function mediaIconPath(type: GalleryItem['type']): string {
	// Heroicons-ish, but inlined for consistency with existing components.
	if (type === 'video') {
		return 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14V10zM4 6a2 2 0 012-2h7a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z';
	}
	if (type === 'audio') {
		return 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z';
	}
	if (type === 'document') {
		return 'M7 2h8l4 4v14a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2z';
	}
	return 'M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z';
}

async function ensureThumbnail(): Promise<void> {
	if (thumbnailUrl || isLoadingThumb) return;
	if (item.type !== 'image') return;

	isLoadingThumb = true;
	try {
		thumbnailUrl = await getImageThumbnailUrl(item.media);
	} finally {
		isLoadingThumb = false;
	}
}

onMount(() => {
	if (!rootEl) return;

	observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				ensureThumbnail();
				observer?.disconnect();
				observer = null;
			}
		},
		{ root: null, rootMargin: '200px' },
	);

	observer.observe(rootEl);
});

onDestroy(() => {
	observer?.disconnect();
});
</script>

<div
	bind:this={rootEl}
	class="group relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
>
	<button
		type="button"
		class="block w-full aspect-square bg-gray-50 dark:bg-gray-900/40"
		onclick={() => onOpen(item.path)}
	>
		{#if item.type === 'image' && thumbnailUrl}
			<img
				src={thumbnailUrl}
				alt={item.name}
				loading="lazy"
				decoding="async"
				class="w-full h-full object-cover"
			/>
		{:else}
			<div class="w-full h-full flex items-center justify-center">
				<svg
					class="w-10 h-10 text-gray-300 dark:text-gray-600"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d={mediaIconPath(item.type)}
					/>
				</svg>
			</div>
		{/if}
	</button>

	<button
		type="button"
		class="absolute top-2 right-2 w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 backdrop-blur flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
		class:opacity-100={selected}
		onclick={() => onToggleSelected(item.path)}
		aria-pressed={selected}
	>
		{#if selected}
			<span class="w-5 h-5 rounded-full bg-[var(--color-whatsapp-teal)] flex items-center justify-center">
				<svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
				</svg>
			</span>
		{:else}
			<svg class="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
				<circle cx="12" cy="12" r="9" />
			</svg>
		{/if}
	</button>

	<div class="px-2 py-2">
		<p class="text-xs text-gray-600 dark:text-gray-300 truncate" title={item.name}>
			{item.name}
		</p>
		{#if item.messageTimestamp}
			<p class="text-[11px] text-gray-400 truncate">
				{new Date(item.messageTimestamp).toLocaleString(undefined, {
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
				})}
			</p>
		{/if}
	</div>
</div>

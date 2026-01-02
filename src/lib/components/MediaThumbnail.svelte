<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import type { GalleryItem } from '$lib/gallery.svelte';
import { getImageThumbnailUrl } from '$lib/gallery-thumbnails';
import {
	formatFileSize,
	getDocumentColor,
	getFileExtension,
} from '$lib/helpers/document-utils';
import {
	clearFrameCache,
	extractAudioDuration,
	extractVideoFrames,
	extractVideoThumbnail,
	formatDuration,
	getFrameIndexFromPosition,
	type VideoFrameCache,
} from '$lib/helpers/video-thumbnails';
import { getLocale } from '$lib/paraglide/runtime';
import Icon from './Icon.svelte';

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

// Video preview state
let videoThumbnailUrl = $state<string | null>(null);
let videoFrameCache = $state<VideoFrameCache | null>(null);
let isLoadingVideoFrames = $state(false);
let isHoveringVideo = $state(false);
let currentFrameIndex = $state(0);
let videoPreviewEl = $state<HTMLElement | null>(null);

// Audio state
let audioDuration = $state<number | null>(null);

let observer: IntersectionObserver | null = null;

function mediaIconPath(type: GalleryItem['type']): string {
	// Heroicons-ish, but inlined for consistency with existing components.
	if (type === 'video') {
		return 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14V10zM4 6a2 2 0 012-2h7a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z';
	}
	if (type === 'audio') {
		return 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z';
	}
	// Generic icon for 'other' and unrecognized media types
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

async function ensureVideoThumbnail(): Promise<void> {
	if (videoThumbnailUrl || isLoadingThumb) return;
	if (item.type !== 'video') return;

	isLoadingThumb = true;
	try {
		const blob = item.media.blob || (await loadMediaBlob());
		videoThumbnailUrl = await extractVideoThumbnail(blob);
	} catch (err) {
		console.error('Failed to extract video thumbnail:', err);
	} finally {
		isLoadingThumb = false;
	}
}

async function ensureAudioDuration(): Promise<void> {
	if (audioDuration !== null || isLoadingThumb) return;
	if (item.type !== 'audio') return;

	isLoadingThumb = true;
	try {
		const blob = item.media.blob || (await loadMediaBlob());
		audioDuration = await extractAudioDuration(blob);
	} catch (err) {
		console.error('Failed to extract audio duration:', err);
	} finally {
		isLoadingThumb = false;
	}
}

async function loadVideoFrames(): Promise<void> {
	if (videoFrameCache || isLoadingVideoFrames) return;
	if (item.type !== 'video') return;

	isLoadingVideoFrames = true;
	try {
		// Load the media blob if not already loaded
		const blob = item.media.blob || (await loadMediaBlob());
		videoFrameCache = await extractVideoFrames(blob, item.path, 10);
	} catch (err) {
		console.error('Failed to extract video frames:', err);
	} finally {
		isLoadingVideoFrames = false;
	}
}

async function loadMediaBlob(): Promise<Blob> {
	if (!item.media._zipEntry) {
		throw new Error('No ZIP entry for media file');
	}
	const blob = await item.media._zipEntry.async('blob');
	return blob;
}

function handleVideoMouseEnter(): void {
	if (item.type !== 'video') return;
	isHoveringVideo = true;
	loadVideoFrames();
}

function handleVideoMouseLeave(): void {
	isHoveringVideo = false;
	currentFrameIndex = 0;
}

function handleVideoMouseMove(event: MouseEvent): void {
	if (!isHoveringVideo || !videoFrameCache || !videoPreviewEl) return;

	const rect = videoPreviewEl.getBoundingClientRect();
	const mouseX = event.clientX - rect.left;
	const frameIndex = getFrameIndexFromPosition(
		mouseX,
		rect.width,
		videoFrameCache.frameCount,
	);

	currentFrameIndex = frameIndex;
}

function handleVideoFocus(): void {
	if (item.type !== 'video') return;
	isHoveringVideo = true;
	loadVideoFrames();
}

function handleVideoBlur(): void {
	isHoveringVideo = false;
	currentFrameIndex = 0;
}

function handleVideoKeyDown(event: KeyboardEvent): void {
	if (item.type !== 'video' || !videoFrameCache) return;

	if (event.key === 'ArrowLeft') {
		event.preventDefault();
		currentFrameIndex = Math.max(0, currentFrameIndex - 1);
	} else if (event.key === 'ArrowRight') {
		event.preventDefault();
		currentFrameIndex = Math.min(
			videoFrameCache.frameCount - 1,
			currentFrameIndex + 1,
		);
	} else if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		onOpen(item.path);
	}
}

onMount(() => {
	if (!rootEl) return;

	observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				if (item.type === 'image') {
					ensureThumbnail();
				} else if (item.type === 'video') {
					ensureVideoThumbnail();
				} else if (item.type === 'audio') {
					ensureAudioDuration();
				}
				if (observer) {
					observer.disconnect();
					observer = null;
				}
			}
		},
		{ root: null, rootMargin: '200px' },
	);

	observer.observe(rootEl);
});

onDestroy(() => {
	if (observer) {
		observer.disconnect();
		observer = null;
	}
	// Cleanup video frame cache to prevent memory leaks
	if (item.type === 'video' && videoFrameCache) {
		clearFrameCache(item.path);
	}
	// Release video thumbnail data URL to help garbage collection
	if (item.type === 'video' && videoThumbnailUrl) {
		videoThumbnailUrl = null;
	}
});
</script>

<div
	bind:this={rootEl}
	class="group relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
>
	<button
		type="button"
		bind:this={videoPreviewEl}
		class={`relative block w-full aspect-square bg-gray-50 dark:bg-gray-900/40 cursor-pointer${item.type === 'video' ? ' hover:cursor-ew-resize' : ''}`}
		onclick={() => onOpen(item.path)}
		onmouseenter={handleVideoMouseEnter}
		onmouseleave={handleVideoMouseLeave}
		onmousemove={handleVideoMouseMove}
		onfocus={handleVideoFocus}
		onblur={handleVideoBlur}
		onkeydown={handleVideoKeyDown}
		aria-label={`Open ${item.name}`}
	>
		{#if item.type === 'image' && thumbnailUrl}
			<img
				src={thumbnailUrl}
				alt={item.name}
				loading="lazy"
				decoding="async"
				class="w-full h-full object-cover"
			/>
		{:else if item.type === 'video' && videoFrameCache && isHoveringVideo}
			<!-- Video preview with scrubbing -->
			<img
				src={videoFrameCache.frames[currentFrameIndex]}
				alt={item.name}
				class="w-full h-full object-cover"
			/>
			<!-- Progress indicator -->
			<div class="absolute bottom-0 left-0 right-0 h-1 bg-black/30 backdrop-blur-sm">
				<div
					class="h-full bg-[var(--color-whatsapp-teal)]"
					style:width="{(videoFrameCache.frameCount > 1 ? currentFrameIndex / (videoFrameCache.frameCount - 1) : 1) * 100}%"
				></div>
			</div>
		{:else if item.type === 'video' && videoThumbnailUrl}
			<!-- Static video thumbnail -->
			<img
				src={videoThumbnailUrl}
				alt={item.name}
				loading="lazy"
				decoding="async"
				class="w-full h-full object-cover"
			/>
			<!-- Play icon overlay -->
			<div class="absolute inset-0 flex items-center justify-center bg-black/20">
				<div class="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
					<Icon name="play" size="lg" class="text-gray-800 ml-0.5" />
				</div>
			</div>
		{:else}
			<div class="w-full h-full flex items-center justify-center">
				{#if item.type === 'document'}
					<!-- Document thumbnail with colored extension badge -->
					{@const color = getDocumentColor(item.name)}
					{@const ext = getFileExtension(item.name)}
					<div class="flex flex-col items-center justify-center gap-1">
						<!-- Document file icon -->
						<div class="relative w-14 h-16">
							<!-- Page background -->
							<div class="absolute inset-0 bg-white dark:bg-gray-200 rounded shadow-md border border-gray-200 dark:border-gray-300"></div>
							<!-- Folded corner -->
							<div class="absolute top-0 right-0 w-4 h-4 bg-gray-100 dark:bg-gray-300 rounded-bl shadow-inner"></div>
							<!-- Extension badge (only show if extension exists) -->
							{#if ext}
								<div
									class="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm"
									style:background-color={color}
								>
									{ext}
								</div>
							{:else}
								<!-- Generic document icon for files without extension -->
								<svg
									class="absolute bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 text-gray-400"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
									/>
								</svg>
							{/if}
						</div>
						{#if item.size > 0}
							<span class="text-[11px] text-gray-500 dark:text-gray-400">
								{formatFileSize(item.size)}
							</span>
						{/if}
					</div>
				{:else if item.type === 'audio'}
					<!-- Audio icon with duration -->
					<div class="flex flex-col items-center gap-2">
						<svg
							class="w-8 h-8 text-gray-400 dark:text-gray-500"
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
						{#if audioDuration !== null}
							<span class="text-sm font-medium text-gray-600 dark:text-gray-300">
								{formatDuration(audioDuration)}
							</span>
						{/if}
					</div>
				{:else}
					<!-- Generic icon -->
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
				{/if}
				{#if item.type === 'video' && isLoadingVideoFrames}
					<div class="absolute inset-0 flex items-center justify-center bg-black/10">
						<div class="w-6 h-6 border-2 border-[var(--color-whatsapp-teal)] border-t-transparent rounded-full animate-spin"></div>
					</div>
				{/if}
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
				<Icon name="check" size="xs" class="text-white" stroke-width="3" />
			</span>
		{:else}
			<Icon name="circle" size="md" class="text-gray-300 dark:text-gray-600" />
		{/if}
	</button>

	<div class="px-2 py-2">
		<p class="text-xs text-gray-600 dark:text-gray-300 truncate" title={item.name}>
			{item.name}
		</p>
		{#if item.messageTimestamp}
			<p class="text-[11px] text-gray-400 truncate">
				{new Date(item.messageTimestamp).toLocaleString(getLocale(), {
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
				})}
			</p>
		{/if}
	</div>
</div>

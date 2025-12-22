<script lang="ts">
import JSZip from 'jszip';
import { onDestroy, tick } from 'svelte';
import { type DateKey, galleryState } from '$lib/gallery.svelte';
import { cleanupThumbnailUrls } from '$lib/gallery-thumbnails';
import * as m from '$lib/paraglide/messages';
import { loadMediaFile } from '$lib/parser';
import { appState } from '$lib/state.svelte';
import MediaThumbnail from './MediaThumbnail.svelte';

interface Props {
	onClose: () => void;
	onNavigateToMessage: (messageId: string) => void;
}

let { onClose, onNavigateToMessage }: Props = $props();

$effect(() => {
	galleryState.syncToChatTitle(appState.selectedChat?.title ?? null);
});

const items = $derived.by(() => galleryState.items);
const itemsByDate = $derived.by(() => galleryState.itemsByDate);
const datesWithMedia = $derived.by(() => galleryState.datesWithMedia);
const dateBoundaries = $derived.by(() => galleryState.dateBoundaries);
const selectedCount = $derived.by(() => galleryState.selectedCount);
const lightboxPath = $derived.by(() => galleryState.lightboxMediaPath);
const scrollToDateKey = $derived.by(() => galleryState.scrollToDateKey);

const lightboxItem = $derived.by(() => {
	const path = lightboxPath;
	if (!path) return null;
	return items.find((it) => it.path === path) ?? null;
});

let lightboxUrl = $state<string | null>(null);
let lightboxLoading = $state(false);
let lightboxError = $state<string | null>(null);

let isDownloading = $state(false);
let downloadProgress = $state(0);
let downloadError = $state<string | null>(null);

// Date picker state
let showDatePicker = $state(false);
let datePickerMonth = $state(new Date());

// Scroll container ref
let scrollContainerRef = $state<HTMLElement | null>(null);

// Handle scroll-to-date
$effect(() => {
	const dateKey = scrollToDateKey;
	if (!dateKey || !scrollContainerRef) return;

	tick().then(() => {
		const section = scrollContainerRef?.querySelector(
			`[data-date="${dateKey}"]`,
		);
		if (section) {
			section.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
		galleryState.clearScrollToDate();
	});
});

function sanitizeFilename(name: string): string {
	return name.replace(/[\\/?%*:|"<>]/g, '_').trim() || 'file';
}

function makeUniqueFilename(name: string, seen: Map<string, number>): string {
	const safe = sanitizeFilename(name);
	const prev = seen.get(safe) ?? 0;
	seen.set(safe, prev + 1);
	if (prev === 0) return safe;

	const dot = safe.lastIndexOf('.');
	if (dot <= 0) return `${safe} (${prev + 1})`;
	const base = safe.slice(0, dot);
	const ext = safe.slice(dot);
	return `${base} (${prev + 1})${ext}`;
}

async function downloadSelected(): Promise<void> {
	const selected = galleryState.selectedItems;
	if (selected.length === 0 || isDownloading) return;

	downloadError = null;
	isDownloading = true;
	downloadProgress = 0;

	try {
		const zip = new JSZip();
		const seenNames = new Map<string, number>();
		const total = selected.length;

		for (let i = 0; i < selected.length; i++) {
			const item = selected[i];
			const entry = item.media._zipEntry;
			if (!entry) continue;

			const filename = makeUniqueFilename(item.name, seenNames);
			const folder = zip.folder(item.type) ?? zip;
			const arrayBuffer = await entry.async('arraybuffer');
			folder.file(filename, arrayBuffer);

			downloadProgress = Math.round(((i + 1) / total) * 100);
		}

		const outBlob = await zip.generateAsync({ type: 'blob' });
		const url = URL.createObjectURL(outBlob);
		const chatTitle = sanitizeFilename(appState.selectedChat?.title ?? 'chat');
		const date = new Date().toISOString().split('T')[0];
		const a = document.createElement('a');
		a.href = url;
		a.download = `whats-reader-media-${chatTitle}-${date}.zip`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	} catch (err) {
		downloadError = err instanceof Error ? err.message : String(err);
	} finally {
		isDownloading = false;
	}
}

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

	loadMediaFile(it.media)
		.then((url) => {
			lightboxUrl = url;
		})
		.catch((err) => {
			lightboxError = err instanceof Error ? err.message : String(err);
		})
		.finally(() => {
			lightboxLoading = false;
		});
});

function closeLightbox() {
	galleryState.setLightbox(null);
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape') {
		if (showDatePicker) {
			showDatePicker = false;
		} else if (lightboxPath) {
			closeLightbox();
		} else {
			onClose();
		}
	}
}

// Date picker helpers
function formatDateKey(dateKey: DateKey): string {
	if (dateKey === 'unknown') return m.media_gallery_unknown_date();
	const date = new Date(`${dateKey}T00:00:00`);
	return date.toLocaleDateString(undefined, {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}

function getMonthDays(
	month: Date,
): { date: Date; dateKey: DateKey; inMonth: boolean }[] {
	const year = month.getFullYear();
	const monthIndex = month.getMonth();
	const firstDay = new Date(year, monthIndex, 1);
	const lastDay = new Date(year, monthIndex + 1, 0);

	const days: { date: Date; dateKey: DateKey; inMonth: boolean }[] = [];

	// Pad start of month to align with weekday (Sunday = 0)
	const startPad = firstDay.getDay();
	for (let i = startPad - 1; i >= 0; i--) {
		const d = new Date(year, monthIndex, -i);
		days.push({
			date: d,
			dateKey: d.toISOString().slice(0, 10),
			inMonth: false,
		});
	}

	// Days in month
	for (let day = 1; day <= lastDay.getDate(); day++) {
		const d = new Date(year, monthIndex, day);
		days.push({
			date: d,
			dateKey: d.toISOString().slice(0, 10),
			inMonth: true,
		});
	}

	// Pad end to fill 6 rows (42 cells)
	while (days.length < 42) {
		const d = new Date(
			year,
			monthIndex + 1,
			days.length - lastDay.getDate() - startPad + 1,
		);
		days.push({
			date: d,
			dateKey: d.toISOString().slice(0, 10),
			inMonth: false,
		});
	}

	return days;
}

function prevMonth() {
	const newMonth = new Date(
		datePickerMonth.getFullYear(),
		datePickerMonth.getMonth() - 1,
		1,
	);
	// Don't go before the oldest month with media
	const { minDate } = dateBoundaries;
	if (minDate) {
		const minMonth = new Date(`${minDate}T00:00:00`);
		minMonth.setDate(1);
		if (newMonth < minMonth) return;
	}
	datePickerMonth = newMonth;
}

function nextMonth() {
	const newMonth = new Date(
		datePickerMonth.getFullYear(),
		datePickerMonth.getMonth() + 1,
		1,
	);
	// Don't go past the newest month with media
	const { maxDate } = dateBoundaries;
	if (maxDate) {
		const maxMonth = new Date(`${maxDate}T00:00:00`);
		maxMonth.setDate(1);
		if (newMonth > maxMonth) return;
	}
	datePickerMonth = newMonth;
}

// Check if we can navigate to prev/next month
const canGoPrevMonth = $derived.by(() => {
	const { minDate } = dateBoundaries;
	if (!minDate) return false;
	const minMonth = new Date(`${minDate}T00:00:00`);
	minMonth.setDate(1);
	const prevMonth = new Date(
		datePickerMonth.getFullYear(),
		datePickerMonth.getMonth() - 1,
		1,
	);
	return prevMonth >= minMonth;
});

const canGoNextMonth = $derived.by(() => {
	const { maxDate } = dateBoundaries;
	if (!maxDate) return false;
	const maxMonth = new Date(`${maxDate}T00:00:00`);
	maxMonth.setDate(1);
	const nextMonth = new Date(
		datePickerMonth.getFullYear(),
		datePickerMonth.getMonth() + 1,
		1,
	);
	return nextMonth <= maxMonth;
});

function selectDate(dateKey: DateKey) {
	showDatePicker = false;
	galleryState.goToDate(dateKey);
}

function openDatePicker() {
	// Start at most recent date with media
	const firstDate = itemsByDate.sortedKeys.find((k) => k !== 'unknown');
	if (firstDate) {
		datePickerMonth = new Date(`${firstDate}T00:00:00`);
	} else {
		datePickerMonth = new Date();
	}
	showDatePicker = true;
}

onDestroy(() => {
	cleanupThumbnailUrls();
});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex flex-col h-full bg-white dark:bg-gray-800">
	<!-- Header -->
	<div class="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
		<div class="flex items-center justify-between h-10 gap-3">
			<div class="min-w-0 flex items-center gap-2">
				<svg
					class="w-5 h-5 flex-shrink-0 text-[var(--color-whatsapp-teal)]"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
					<path stroke-linecap="round" stroke-linejoin="round" d="M7 15l3-3 3 3 3-3 2 2" />
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 9h.01" />
				</svg>
				<h2 class="min-w-0 text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
					{m.media_gallery_title()}
				</h2>
				{#if selectedCount > 0}
					<span class="text-xs text-gray-500 dark:text-gray-300 bg-gray-100/70 dark:bg-gray-700/70 px-2 py-0.5 rounded-full whitespace-nowrap">
						{m.media_gallery_selected({ count: selectedCount })}
					</span>
				{/if}
			</div>
			<div class="flex items-center gap-1.5 flex-shrink-0">
				<!-- Go to Date button -->
				{#if items.length > 0}
					<button
						type="button"
						class="h-9 w-9 inline-flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-whatsapp-teal)]/50"
						onclick={openDatePicker}
						aria-label={m.media_gallery_go_to_date()}
						title={m.media_gallery_go_to_date()}
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
					</button>
				{/if}
				{#if selectedCount > 0}
					<button
						type="button"
						class="relative h-9 w-9 inline-flex items-center justify-center rounded-lg text-[var(--color-whatsapp-teal)] hover:bg-[var(--color-whatsapp-teal)]/10 dark:hover:bg-[var(--color-whatsapp-teal)]/15 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-whatsapp-teal)]/60"
						onclick={downloadSelected}
						disabled={isDownloading}
						aria-busy={isDownloading}
						aria-label={m.media_gallery_download_selected()}
						title={isDownloading ? m.media_gallery_downloading({ progress: downloadProgress }) : m.media_gallery_download_selected()}
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
						</svg>
						{#if isDownloading}
							<span class="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-black/35 text-[10px] text-white/90 tabular-nums">
								{downloadProgress}%
							</span>
						{/if}
					</button>
					<button
						type="button"
						class="h-9 w-9 inline-flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-whatsapp-teal)]/50"
						onclick={() => galleryState.clearSelection()}
						aria-label={m.media_gallery_clear_selection()}
						title={m.media_gallery_clear_selection()}
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<rect x="4" y="4" width="16" height="16" rx="2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6" />
						</svg>
					</button>
				{/if}
				<button
					type="button"
					class="h-9 w-9 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-whatsapp-teal)]/50"
					onclick={onClose}
					aria-label={m.media_gallery_close()}
					title={m.media_gallery_close()}
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>
		{#if downloadError}
			<div class="mt-2 text-xs text-red-600 dark:text-red-400">
				{m.media_gallery_download_failed()}: {downloadError}
			</div>
		{/if}
	</div>

	<div class="flex-1 overflow-y-auto p-3" bind:this={scrollContainerRef}>
		{#if items.length === 0}
			<div class="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
				<svg class="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
				</svg>
				<p class="text-gray-500 dark:text-gray-400 text-sm">{m.media_gallery_empty()}</p>
			</div>
		{:else}
			<!-- Date-grouped sections -->
			{#each itemsByDate.sortedKeys as dateKey (dateKey)}
				{@const dateItems = itemsByDate.map.get(dateKey) ?? []}
				<section data-date={dateKey} class="mb-4">
					<!-- Sticky date header -->
					<div class="sticky -top-3 z-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm -mx-3 px-3 py-2 mb-2 border-b border-gray-100 dark:border-gray-700/50 flex items-center gap-2">
						<span class="text-xs font-medium text-gray-600 dark:text-gray-300">
							{formatDateKey(dateKey)}
						</span>
						<span class="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700/50 px-1.5 py-0.5 rounded-full">
							{dateItems.length}
						</span>
					</div>
					<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
						{#each dateItems as item (item.id)}
							<MediaThumbnail
								{item}
								selected={galleryState.isSelected(item.path)}
								onToggleSelected={(path) => galleryState.toggleSelected(path)}
								onOpen={(path) => galleryState.setLightbox(path)}
							/>
						{/each}
					</div>
				</section>
			{/each}
		{/if}
	</div>

	<!-- Date Picker Modal -->
	{#if showDatePicker}
		<div class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
			<button
				type="button"
				class="absolute inset-0 cursor-default"
				onclick={() => (showDatePicker = false)}
				aria-label={m.close()}
			></button>
			<div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-sm overflow-hidden">
				<!-- Modal header -->
				<div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
					<h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{m.media_gallery_go_to_date()}</h3>
					<button
						type="button"
						class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors cursor-pointer"
						onclick={() => (showDatePicker = false)}
						aria-label={m.close()}
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<!-- Month navigation -->
				<div class="flex items-center justify-between px-4 py-3">
					<button
						type="button"
						class="p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed {canGoPrevMonth ? 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700' : 'text-gray-300 dark:text-gray-600'}"
						onclick={prevMonth}
						disabled={!canGoPrevMonth}
						aria-label="Previous month"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
						</svg>
					</button>
					<span class="text-sm font-medium text-gray-900 dark:text-gray-100">
						{datePickerMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
					</span>
					<button
						type="button"
						class="p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed {canGoNextMonth ? 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700' : 'text-gray-300 dark:text-gray-600'}"
						onclick={nextMonth}
						disabled={!canGoNextMonth}
						aria-label="Next month"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
						</svg>
					</button>
				</div>

				<!-- Calendar grid -->
				<div class="px-4 pb-4">
					<!-- Weekday headers -->
					<div class="grid grid-cols-7 gap-1 mb-1">
						{#each ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as day}
							<div class="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1">{day}</div>
						{/each}
					</div>
					<!-- Day cells -->
					<div class="grid grid-cols-7 gap-1">
						{#each getMonthDays(datePickerMonth) as { date, dateKey, inMonth }}
							{@const hasMedia = datesWithMedia.has(dateKey)}
							{@const mediaTypes = hasMedia ? galleryState.getMediaTypesForDate(dateKey) : null}
							{@const tooltipParts = mediaTypes ? [mediaTypes.images > 0 ? `${mediaTypes.images} 📷` : '', mediaTypes.videos > 0 ? `${mediaTypes.videos} 🎬` : '', mediaTypes.audio > 0 ? `${mediaTypes.audio} 🎵` : ''].filter(Boolean).join('  ') : ''}
							<button
								type="button"
								class="relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors cursor-pointer
									{inMonth ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-600'}
									{hasMedia ? 'hover:bg-[var(--color-whatsapp-teal)]/10 font-medium' : 'cursor-default'}
									{hasMedia && inMonth ? 'bg-[var(--color-whatsapp-teal)]/5' : ''}"
								onclick={() => hasMedia && selectDate(dateKey)}
								disabled={!hasMedia}
								title={tooltipParts}
							>
								<span class="leading-none">{date.getDate()}</span>
								{#if hasMedia && inMonth && mediaTypes}
									<div class="absolute bottom-0.5 flex items-center justify-center gap-px">
										{#if mediaTypes.images > 0}
											<span class="w-1 h-1 rounded-full bg-[var(--color-whatsapp-teal)]"></span>
										{/if}
										{#if mediaTypes.videos > 0}
											<span class="w-1 h-1 rounded-full bg-purple-500"></span>
										{/if}
										{#if mediaTypes.audio > 0}
											<span class="w-1 h-1 rounded-full bg-amber-500"></span>
										{/if}
									</div>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if lightboxItem}
		<!-- Lightbox -->
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
								{new Date(lightboxItem.messageTimestamp).toLocaleString()}
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
									}
								}}
								aria-label={m.media_gallery_go_to_message()}
								title={m.media_gallery_go_to_message()}
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</button>
						{:else}
							<span class="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700">
								{m.media_gallery_unlinked()}
							</span>
						{/if}
						<button
							type="button"
							class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors cursor-pointer"
							onclick={closeLightbox}
							aria-label={m.close()}
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
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
							<video src={lightboxUrl} controls class="max-h-[70vh] w-full">
								<track kind="captions" />
							</video>
						{:else if lightboxItem.type === 'audio'}
							<audio src={lightboxUrl} controls class="w-full p-4"></audio>
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
</div>

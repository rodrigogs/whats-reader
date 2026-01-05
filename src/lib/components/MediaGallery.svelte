<script lang="ts">
import JSZip from 'jszip';
import { onDestroy, tick } from 'svelte';
import {
	type DateKey,
	galleryState,
	type MediaTypeFilter,
} from '$lib/gallery.svelte';
import { cleanupThumbnailUrls } from '$lib/gallery-thumbnails';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import { loadMediaFile } from '$lib/parser';
import { appState } from '$lib/state.svelte';
import Dropdown from './Dropdown.svelte';
import DropdownList from './DropdownList.svelte';
import DropdownSearch from './DropdownSearch.svelte';
import Icon from './Icon.svelte';
import IconButton from './IconButton.svelte';
import ListItemButton from './ListItemButton.svelte';
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
const allItems = $derived.by(() => galleryState.allItems);
const itemsByDate = $derived.by(() => galleryState.itemsByDate);
const datesWithMedia = $derived.by(() => galleryState.datesWithMedia);
const dateBoundaries = $derived.by(() => galleryState.dateBoundaries);
const selectedCount = $derived.by(() => galleryState.selectedCount);
const lightboxPath = $derived.by(() => galleryState.lightboxMediaPath);
const scrollToDateKey = $derived.by(() => galleryState.scrollToDateKey);
const hasActiveFilter = $derived.by(() => galleryState.hasActiveFilter);
const filterParticipants = $derived.by(() => galleryState.filterParticipants);
const filterTypes = $derived.by(() => galleryState.filterTypes);
const mediaParticipants = $derived.by(() => galleryState.mediaParticipants);

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

// Options dropdown state
let showOptionsDropdown = $state(false);
let optionsButtonRef = $state<HTMLButtonElement | null>(null);

// Participant filter modal state
let showParticipantFilter = $state(false);
let participantSearchQuery = $state('');
let participantSearchInputRef = $state<HTMLInputElement | null>(null);

// Type filter modal state
let showTypeFilter = $state(false);

// Scroll container ref
let scrollContainerRef = $state<HTMLElement | null>(null);

// Auto-focus participant search input when modal opens
$effect(() => {
	if (showParticipantFilter && participantSearchInputRef) {
		(async () => {
			await tick();
			participantSearchInputRef?.focus();
		})();
	}
});

// Filter participants based on search query
const filteredMediaParticipants = $derived.by(() => {
	const query = participantSearchQuery.toLowerCase().trim();
	if (!query) return mediaParticipants;
	return mediaParticipants.filter((p) => p.toLowerCase().includes(query));
});

// Performance optimization: Use Sets for O(1) lookups instead of O(n) includes
const filterParticipantsSet = $derived(new Set(filterParticipants));
const filterTypesSet = $derived(new Set(filterTypes));

// Handle scroll-to-date
$effect(() => {
	const dateKey = scrollToDateKey;
	if (!dateKey || !scrollContainerRef) return;

	let isCancelled = false;

	tick().then(() => {
		if (isCancelled) return;
		const section = scrollContainerRef?.querySelector(
			`[data-date="${dateKey}"]`,
		);
		if (section) {
			section.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
		galleryState.clearScrollToDate();
	});

	return () => {
		isCancelled = true;
	};
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
	if (e.key === 'Escape') {
		if (showOptionsDropdown) {
			showOptionsDropdown = false;
		} else if (showParticipantFilter) {
			showParticipantFilter = false;
		} else if (showTypeFilter) {
			showTypeFilter = false;
		} else if (showDatePicker) {
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
	return date.toLocaleDateString(getLocale(), {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}

function toLocalDateKey(date: Date): DateKey {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
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
			dateKey: toLocalDateKey(d),
			inMonth: false,
		});
	}

	// Days in month
	for (let day = 1; day <= lastDay.getDate(); day++) {
		const d = new Date(year, monthIndex, day);
		days.push({
			date: d,
			dateKey: toLocalDateKey(d),
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
			dateKey: toLocalDateKey(d),
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

function buildMediaTooltip(
	images: number,
	videos: number,
	audio: number,
): string {
	const parts: string[] = [];
	// Simple approach: "{count} {type}" works reasonably well across languages
	if (images > 0) parts.push(`${images} ${m.media_photo().toLowerCase()}`);
	if (videos > 0) parts.push(`${videos} ${m.media_video().toLowerCase()}`);
	if (audio > 0) parts.push(`${audio} ${m.media_audio().toLowerCase()}`);
	return parts.join(', ');
}

function openDatePicker() {
	// Start at most recent date with media
	const firstDate = itemsByDate.sortedKeys.find((k) => k !== 'unknown');
	if (firstDate) {
		datePickerMonth = new Date(`${firstDate}T00:00:00`);
	} else {
		datePickerMonth = new Date();
	}
	showOptionsDropdown = false;
	showDatePicker = true;
}

function openParticipantFilter() {
	showOptionsDropdown = false;
	participantSearchQuery = '';
	showParticipantFilter = true;
}

function openTypeFilter() {
	showOptionsDropdown = false;
	showTypeFilter = true;
}

function toggleParticipant(participant: string) {
	galleryState.toggleParticipantFilter(participant);
}

function toggleType(type: MediaTypeFilter) {
	galleryState.toggleTypeFilter(type);
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
				<Icon name="image" size="md" class="flex-shrink-0 text-[var(--color-whatsapp-teal)]" />
				<h2 class="min-w-0 text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
					{m.media_gallery_title()}
				</h2>
				{#if hasActiveFilter}
					<span class="text-xs text-[var(--color-whatsapp-teal)] bg-[var(--color-whatsapp-teal)]/10 px-2 py-0.5 rounded-full whitespace-nowrap">
						{items.length} / {allItems.length}
					</span>
				{:else if selectedCount > 0}
					<span class="text-xs text-gray-500 dark:text-gray-300 bg-gray-100/70 dark:bg-gray-700/70 px-2 py-0.5 rounded-full whitespace-nowrap">
						{m.media_gallery_selected({ count: selectedCount })}
					</span>
				{/if}
			</div>
			<div class="flex items-center gap-1.5 flex-shrink-0">
				<!-- Options button -->
				{#if allItems.length > 0}
					<IconButton
						bind:ref={optionsButtonRef}
						theme="light"
						size="lg"
						onclick={() => (showOptionsDropdown = !showOptionsDropdown)}
						aria-label={m.media_gallery_options()}
						title={m.media_gallery_options()}
					>
						<Icon name="dots-vertical" size="md" class={hasActiveFilter ? 'text-[var(--color-whatsapp-teal)]' : ''} />
					</IconButton>
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
						<Icon name="download" size="md" />
						{#if isDownloading}
							<span class="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-black/35 text-[10px] text-white/90 tabular-nums">
								{downloadProgress}%
							</span>
						{/if}
					</button>
					<IconButton
						theme="light"
						size="lg"
						onclick={() => galleryState.clearSelection()}
						aria-label={m.media_gallery_clear_selection()}
						title={m.media_gallery_clear_selection()}
					>
						<Icon name="minus" size="md" />
					</IconButton>
				{/if}
				<IconButton
					theme="light"
					size="lg"
					onclick={onClose}
					aria-label={m.media_gallery_close()}
					title={m.media_gallery_close()}
				>
					<Icon name="close" size="md" />
				</IconButton>
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
				<Icon name="image" size="2xl" class="text-gray-300 dark:text-gray-600 mb-3" />
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
					<IconButton
						theme="light"
						size="sm"
						onclick={() => (showDatePicker = false)}
						aria-label={m.close()}
					>
						<Icon name="close" size="md" />
					</IconButton>
				</div>

				<!-- Month navigation -->
				<div class="flex items-center justify-between px-4 py-3">
					<IconButton
						theme="light"
						size="sm"
						onclick={prevMonth}
						disabled={!canGoPrevMonth}
						class={!canGoPrevMonth ? 'opacity-30' : ''}
						aria-label={m.calendar_previous_month()}
					>
						<Icon name="chevron-left" size="md" />
					</IconButton>
					<span class="text-sm font-medium text-gray-900 dark:text-gray-100">
						{datePickerMonth.toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' })}
					</span>
					<IconButton
						theme="light"
						size="sm"
						onclick={nextMonth}
						disabled={!canGoNextMonth}
						class={!canGoNextMonth ? 'opacity-30' : ''}
						aria-label={m.calendar_next_month()}
					>
						<Icon name="chevron-right" size="md" />
					</IconButton>
				</div>

				<!-- Calendar grid -->
				<div class="px-4 pb-4">
					<!-- Weekday headers -->
					<div class="grid grid-cols-7 gap-1 mb-1">
						{#each [m.calendar_weekday_sun(), m.calendar_weekday_mon(), m.calendar_weekday_tue(), m.calendar_weekday_wed(), m.calendar_weekday_thu(), m.calendar_weekday_fri(), m.calendar_weekday_sat()] as day}
							<div class="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1">{day}</div>
						{/each}
					</div>
					<!-- Day cells -->
					<div class="grid grid-cols-7 gap-1">
						{#each getMonthDays(datePickerMonth) as { date, dateKey, inMonth }}
							{@const hasMedia = datesWithMedia.has(dateKey)}
							{@const mediaTypes = hasMedia ? galleryState.getMediaTypesForDate(dateKey) : null}
							{@const tooltipParts = mediaTypes ? buildMediaTooltip(mediaTypes.images, mediaTypes.videos, mediaTypes.audio) : ''}
							<button
								type="button"
								class="relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors cursor-pointer
									{inMonth ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-600'}
									{hasMedia ? 'hover:bg-[var(--color-whatsapp-teal)]/10 font-medium' : 'cursor-default'}
									{hasMedia && inMonth ? 'bg-[var(--color-whatsapp-teal)]/5' : ''}"
								onclick={() => hasMedia && selectDate(dateKey)}
								disabled={!hasMedia}
								title={tooltipParts}
								aria-label={hasMedia ? `${date.getDate()}, ${tooltipParts}` : `${date.getDate()}`}
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

	<!-- Options Dropdown -->
	<Dropdown
		anchor={optionsButtonRef}
		open={showOptionsDropdown}
		onClose={() => (showOptionsDropdown = false)}
		width="w-56"
		placement="bottom-end"
	>
		<DropdownList maxHeight="max-h-64">
			<ListItemButton onclick={openDatePicker}>
				<Icon name="calendar" size="sm" />
				<span>{m.media_gallery_go_to_date()}</span>
			</ListItemButton>
			<ListItemButton onclick={openParticipantFilter} active={filterParticipants.length > 0}>
				<Icon name="user" size="sm" />
				<span class="flex-1">{m.media_gallery_filter_by_participant()}</span>
				{#if filterParticipants.length > 0}
					<span class="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{filterParticipants.length}</span>
				{/if}
			</ListItemButton>
			<ListItemButton onclick={openTypeFilter} active={filterTypes.length > 0}>
				<Icon name="tag" size="sm" />
				<span class="flex-1">{m.media_gallery_filter_by_type()}</span>
				{#if filterTypes.length > 0}
					<span class="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{filterTypes.length}</span>
				{/if}
			</ListItemButton>
			{#if hasActiveFilter}
				<div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
				<ListItemButton onclick={() => { galleryState.clearFilters(); showOptionsDropdown = false; }} danger>
					<Icon name="close" size="sm" />
					<span>{m.media_gallery_clear_filter()}</span>
				</ListItemButton>
			{/if}
		</DropdownList>
	</Dropdown>

	<!-- Participant Filter Modal -->
	{#if showParticipantFilter}
		<div class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
			<button
				type="button"
				class="absolute inset-0 cursor-default"
				onclick={() => (showParticipantFilter = false)}
				aria-label={m.close()}
			></button>
			<div
				class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-sm overflow-hidden"
				role="dialog"
				aria-modal="true"
				aria-labelledby="participant-filter-title"
			>
				<div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
					<h3 id="participant-filter-title" class="text-sm font-semibold text-gray-900 dark:text-gray-100">{m.media_gallery_filter_by_participant()}</h3>
					<IconButton
						theme="light"
						size="sm"
						onclick={() => (showParticipantFilter = false)}
						aria-label={m.close()}
					>
						<Icon name="close" size="md" />
					</IconButton>
				</div>
				
				<DropdownSearch
					bind:value={participantSearchQuery}
					bind:ref={participantSearchInputRef}
					placeholder={m.media_gallery_participant_search_placeholder()}
				/>
				
				<div class="max-h-80 overflow-y-auto py-2">
					{#each filteredMediaParticipants as participant (participant)}
						<ListItemButton
							onclick={() => toggleParticipant(participant)}
							active={filterParticipantsSet.has(participant)}
						>
							<span class="w-5 text-center">{filterParticipantsSet.has(participant) ? '✓' : ''}</span>
							<span class="truncate">{participant}</span>
						</ListItemButton>
					{/each}
					{#if filteredMediaParticipants.length === 0 && participantSearchQuery}
						<div class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 italic">
							{m.media_gallery_participant_no_match({ query: participantSearchQuery })}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Type Filter Modal -->
	{#if showTypeFilter}
		<div class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
			<button
				type="button"
				class="absolute inset-0 cursor-default"
				onclick={() => (showTypeFilter = false)}
				aria-label={m.close()}
			></button>
			<div
				class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-sm overflow-hidden"
				role="dialog"
				aria-modal="true"
				aria-labelledby="media-type-filter-title"
			>
				<div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
					<h3 id="media-type-filter-title" class="text-sm font-semibold text-gray-900 dark:text-gray-100">{m.media_gallery_filter_by_type()}</h3>
					<IconButton
						theme="light"
						size="sm"
						onclick={() => (showTypeFilter = false)}
						aria-label={m.close()}
					>
						<Icon name="close" size="md" />
					</IconButton>
				</div>
				<div class="py-2">
					<ListItemButton
						onclick={() => toggleType('image')}
						active={filterTypesSet.has('image')}
					>
						<span class="w-5 text-center">{filterTypesSet.has('image') ? '✓' : ''}</span>
						<span>{m.media_gallery_type_images()}</span>
					</ListItemButton>
					<ListItemButton
						onclick={() => toggleType('video')}
						active={filterTypesSet.has('video')}
					>
						<span class="w-5 text-center">{filterTypesSet.has('video') ? '✓' : ''}</span>
						<span>{m.media_gallery_type_videos()}</span>
					</ListItemButton>
					<ListItemButton
						onclick={() => toggleType('audio')}
						active={filterTypesSet.has('audio')}
					>
						<span class="w-5 text-center">{filterTypesSet.has('audio') ? '✓' : ''}</span>
						<span>{m.media_gallery_type_audio()}</span>
					</ListItemButton>
					<ListItemButton
						onclick={() => toggleType('document')}
						active={filterTypesSet.has('document')}
					>
						<span class="w-5 text-center">{filterTypesSet.has('document') ? '✓' : ''}</span>
						<span>{m.media_gallery_type_documents()}</span>
					</ListItemButton>
					<ListItemButton
						onclick={() => toggleType('other')}
						active={filterTypesSet.has('other')}
					>
						<span class="w-5 text-center">{filterTypesSet.has('other') ? '✓' : ''}</span>
						<span>{m.media_gallery_type_other()}</span>
					</ListItemButton>
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
</div>

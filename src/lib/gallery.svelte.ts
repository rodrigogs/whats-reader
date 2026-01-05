/**
 * Media gallery state management using Svelte 5 runes
 *
 * Keeps selection/lightbox UI state separate from parsing and media loading.
 *
 * Note: Full-size media loading should continue to use loadMediaFile() in
 * src/lib/parser/zip-parser.ts to reuse the existing global cache.
 */

import type { MediaFile } from './parser/zip-parser';
import { appState } from './state.svelte';

export interface GalleryItem {
	id: string; // stable ID (uses media.path)
	media: MediaFile;
	name: string;
	path: string;
	type: MediaFile['type'];
	size: number;
	messageId?: string;
	messageTimestamp?: string;
	messageSender?: string;
}

/** Date key in YYYY-MM-DD format */
export type DateKey = string;

function toGalleryItem(media: MediaFile): GalleryItem {
	return {
		id: media.path,
		media,
		name: media.name,
		path: media.path,
		type: media.type,
		size: media.size,
		messageId: media.messageId,
		messageTimestamp: media.messageTimestamp,
		messageSender: media.messageSender,
	};
}

/** Extract YYYY-MM-DD from ISO timestamp or return null */
function toDateKey(timestamp?: string): DateKey | null {
	if (!timestamp) return null;

	// Fast path: timestamp already starts with ISO date "YYYY-MM-DD"
	const isoMatch = /^(\d{4}-\d{2}-\d{2})/.exec(timestamp);
	if (isoMatch) {
		return isoMatch[1];
	}

	// Fallback: try to parse other date formats and normalize to YYYY-MM-DD
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) {
		return null;
	}

	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');

	return `${year}-${month}-${day}`;
}

/** Valid media type filter values */
export type MediaTypeFilter =
	| 'image'
	| 'video'
	| 'audio'
	| 'document'
	| 'other';

function createGalleryState() {
	let selectedMediaPaths = $state<Set<string>>(new Set());
	let lightboxMediaPath = $state<string | null>(null);
	let lastChatTitle = $state<string | null>(null);
	let scrollToDateKey = $state<DateKey | null>(null);

	// Filter state
	let filterParticipants = $state<string[]>([]);
	let filterTypes = $state<MediaTypeFilter[]>([]);

	/** All items (unfiltered) */
	const allItems = $derived.by(() => {
		const chat = appState.selectedChat;
		if (!chat) return [] as GalleryItem[];
		return chat.mediaFiles.map(toGalleryItem);
	});

	/** Unique participants who sent media */
	const mediaParticipants = $derived.by(() => {
		const participants = new Set<string>();
		for (const item of allItems) {
			if (item.messageSender) {
				participants.add(item.messageSender);
			}
		}
		return [...participants].sort((a, b) =>
			a.localeCompare(b, undefined, { sensitivity: 'base' }),
		);
	});

	/** Filtered items based on participant and type filters */
	const items = $derived.by(() => {
		let result = allItems;

		// Filter by participants
		if (filterParticipants.length > 0) {
			result = result.filter((item) =>
				item.messageSender
					? filterParticipants.includes(item.messageSender)
					: false,
			);
		}

		// Filter by types
		if (filterTypes.length > 0) {
			result = result.filter((item) => filterTypes.includes(item.type));
		}

		return result;
	});

	/** Whether any filter is active */
	const hasActiveFilter = $derived(
		filterParticipants.length > 0 || filterTypes.length > 0,
	);

	/** Items grouped by date (YYYY-MM-DD), sorted newest first */
	const itemsByDate = $derived.by(() => {
		const map = new Map<DateKey, GalleryItem[]>();
		const unknownKey = 'unknown';

		for (const item of items) {
			const key = toDateKey(item.messageTimestamp) ?? unknownKey;
			let arr = map.get(key);
			if (!arr) {
				arr = [];
				map.set(key, arr);
			}
			arr.push(item);
		}

		// Sort keys descending (newest first), but keep 'unknown' at end
		const sortedKeys = [...map.keys()].sort((a, b) => {
			if (a === unknownKey) return 1;
			if (b === unknownKey) return -1;
			return b.localeCompare(a);
		});

		return { map, sortedKeys };
	});

	/** Set of date keys that have media */
	const datesWithMedia = $derived.by(() => {
		const set = new Set<DateKey>();
		for (const key of itemsByDate.sortedKeys) {
			if (key !== 'unknown') {
				set.add(key);
			}
		}
		return set;
	});

	/** Date boundaries (oldest and newest dates with media) */
	const dateBoundaries = $derived.by(() => {
		const keys = itemsByDate.sortedKeys.filter((k) => k !== 'unknown');
		if (keys.length === 0) return { minDate: null, maxDate: null };
		// keys are sorted descending (newest first)
		return {
			minDate: keys[keys.length - 1], // oldest
			maxDate: keys[0], // newest
		};
	});

	const selectedCount = $derived(selectedMediaPaths.size);

	const selectedItems = $derived.by(() => {
		if (selectedMediaPaths.size === 0) return [] as GalleryItem[];
		const selected = selectedMediaPaths;
		return items.filter((it) => selected.has(it.path));
	});

	function syncToChatTitle(currentTitle: string | null): void {
		if (currentTitle === lastChatTitle) return;
		selectedMediaPaths = new Set();
		lightboxMediaPath = null;
		lastChatTitle = currentTitle;
		// Reset filters when changing chats
		filterParticipants = [];
		filterTypes = [];
	}

	function toggleParticipantFilter(participant: string): void {
		const set = new Set(filterParticipants);
		if (set.has(participant)) {
			set.delete(participant);
		} else {
			set.add(participant);
		}
		filterParticipants = Array.from(set);
	}

	function toggleTypeFilter(type: MediaTypeFilter): void {
		const set = new Set(filterTypes);
		if (set.has(type)) {
			set.delete(type);
		} else {
			set.add(type);
		}
		filterTypes = Array.from(set);
	}

	function clearFilters(): void {
		filterParticipants = [];
		filterTypes = [];
	}

	function isSelected(path: string): boolean {
		return selectedMediaPaths.has(path);
	}

	function clearSelection(): void {
		if (selectedMediaPaths.size === 0) return;
		selectedMediaPaths = new Set();
	}

	function toggleSelected(path: string): void {
		const next = new Set(selectedMediaPaths);
		if (next.has(path)) {
			next.delete(path);
		} else {
			next.add(path);
		}
		selectedMediaPaths = next;
	}

	function selectOnly(path: string): void {
		selectedMediaPaths = new Set([path]);
	}

	function selectMany(paths: string[]): void {
		if (paths.length === 0) return;
		const next = new Set(selectedMediaPaths);
		for (const path of paths) {
			next.add(path);
		}
		selectedMediaPaths = next;
	}

	function setLightbox(path: string | null): void {
		lightboxMediaPath = path;
	}

	function goToDate(dateKey: DateKey): void {
		scrollToDateKey = dateKey;
	}

	function clearScrollToDate(): void {
		scrollToDateKey = null;
	}

	function getItemCountForDate(dateKey: DateKey): number {
		return itemsByDate.map.get(dateKey)?.length ?? 0;
	}

	/** Get media type breakdown for a specific date */
	function getMediaTypesForDate(dateKey: DateKey): {
		images: number;
		videos: number;
		audio: number;
	} {
		const dateItems = itemsByDate.map.get(dateKey) ?? [];
		let images = 0;
		let videos = 0;
		let audio = 0;
		for (const item of dateItems) {
			if (item.type === 'image') images++;
			else if (item.type === 'video') videos++;
			else if (item.type === 'audio') audio++;
		}
		return { images, videos, audio };
	}

	return {
		get items() {
			return items;
		},
		get allItems() {
			return allItems;
		},
		get itemsByDate() {
			return itemsByDate;
		},
		get datesWithMedia() {
			return datesWithMedia;
		},
		get dateBoundaries() {
			return dateBoundaries;
		},
		get selectedCount() {
			return selectedCount;
		},
		get selectedItems() {
			return selectedItems;
		},
		get lightboxMediaPath() {
			return lightboxMediaPath;
		},
		get lastChatTitle() {
			return lastChatTitle;
		},
		get scrollToDateKey() {
			return scrollToDateKey;
		},
		get filterParticipants() {
			return filterParticipants;
		},
		get filterTypes() {
			return filterTypes;
		},
		get hasActiveFilter() {
			return hasActiveFilter;
		},
		get mediaParticipants() {
			return mediaParticipants;
		},

		syncToChatTitle,
		isSelected,
		clearSelection,
		toggleSelected,
		selectOnly,
		selectMany,
		setLightbox,
		goToDate,
		clearScrollToDate,
		getItemCountForDate,
		getMediaTypesForDate,
		toggleParticipantFilter,
		toggleTypeFilter,
		clearFilters,
	};
}

export const galleryState = createGalleryState();

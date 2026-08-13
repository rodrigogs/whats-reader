/**
 * Bookmarks state management using Svelte 5 runes
 * Allows users to bookmark messages with optional comments
 *
 * NOTE: Bookmarks are NOT persisted automatically.
 * Users must export/import bookmarks manually each session.
 *
 * Namespacing: bookmarks are keyed by `archiveId` + `messageId`. Two distinct
 * archives can share the same chat title, so the archive identity — not the
 * title — is the canonical namespace. The legacy v1 export shape (no
 * archiveId) is backfilled only by validated restore; manual v1 import fails
 * closed because a display title cannot identify one archive safely.
 */

import type { ArchiveId } from './global-search/archive-identity';

export interface Bookmark {
	id: string;
	archiveId: ArchiveId; // Canonical archive identity (namespace)
	messageId: string;
	chatTitle: string; // Display title (non-unique; for grouping/preview only)
	comment: string;
	createdAt: string; // ISO string
	messagePreview: string; // First ~100 chars of message content
	sender: string;
	messageTimestamp: string; // ISO string of original message timestamp
}

export interface BookmarkExport {
	version: 2;
	exportedAt: string;
	bookmarks: Bookmark[];
}

// Generate unique ID
function generateId(): string {
	return `bm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Truncate text for preview
function truncateText(text: string, maxLength: number = 100): string {
	if (text.length <= maxLength) return text;
	return `${text.substring(0, maxLength).trim()}...`;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

interface NormalizedImport {
	bookmarks: Bookmark[];
	skipped: number;
}

/*
 * A v1 bookmark only carried `chatId`, which was the display title in the
 * released UI. A title cannot be promoted to archive identity: equal-titled
 * archives are the collision this migration fixes. Therefore v1 is importable
 * only after restore has validated one concrete archive and supplied its ID.
 */
function normalizeExport(
	data: BookmarkExport | LegacyBookmarkExport,
	validatedArchiveId?: ArchiveId,
): NormalizedImport {
	if (!data || !Array.isArray(data.bookmarks)) {
		throw new Error('Invalid bookmark export format');
	}

	if (data.version === 2) {
		const bookmarks: Bookmark[] = [];
		let skipped = 0;
		for (const bookmark of data.bookmarks) {
			if (
				!isNonEmptyString(bookmark.archiveId) ||
				!isNonEmptyString(bookmark.messageId)
			) {
				skipped += 1;
				continue;
			}
			bookmarks.push(bookmark);
		}
		return { bookmarks, skipped };
	}

	// JSON.parse is an untyped boundary despite this function's compile-time union.
	if (Reflect.get(data, 'version') !== 1) {
		throw new Error('Invalid bookmark export format');
	}

	if (!isNonEmptyString(validatedArchiveId)) {
		return { bookmarks: [], skipped: data.bookmarks.length };
	}

	const bookmarks: Bookmark[] = [];
	let skipped = 0;
	for (const raw of data.bookmarks) {
		if (!isNonEmptyString(raw.messageId)) {
			skipped += 1;
			continue;
		}
		bookmarks.push({
			id: isNonEmptyString(raw.id) ? raw.id : generateId(),
			archiveId: validatedArchiveId,
			messageId: raw.messageId,
			chatTitle: raw.chatTitle ?? raw.chatId ?? '',
			comment: raw.comment ?? '',
			createdAt: raw.createdAt ?? new Date().toISOString(),
			messagePreview: raw.messagePreview ?? '',
			sender: raw.sender ?? '',
			messageTimestamp: raw.messageTimestamp ?? new Date().toISOString(),
		});
	}
	return { bookmarks, skipped };
}

export interface LegacyBookmark {
	id?: string;
	messageId: string;
	chatId?: string;
	chatTitle?: string;
	comment?: string;
	createdAt?: string;
	messagePreview?: string;
	sender?: string;
	messageTimestamp?: string;
}

export type PersistedBookmark = Bookmark | LegacyBookmark;

interface LegacyBookmarkExport {
	version: 1;
	exportedAt?: string;
	bookmarks: LegacyBookmark[];
}

// Create reactive bookmarks state
export function createBookmarksState() {
	// Start with empty bookmarks - no persistence
	let bookmarks = $state<Bookmark[]>([]);

	// Derived: Map of archiveId -> (Map of messageId -> Bookmark) for fast lookup.
	// Lookups must be scoped by archive so equal-titled archives stay independent.
	const bookmarksByArchive = $derived.by(() => {
		const byArchive = new Map<string, Map<string, Bookmark>>();
		for (const bookmark of bookmarks) {
			let inner = byArchive.get(bookmark.archiveId);
			if (!inner) {
				inner = new Map();
				byArchive.set(bookmark.archiveId, inner);
			}
			inner.set(bookmark.messageId, bookmark);
		}
		return byArchive;
	});

	// Derived: Group bookmarks by archiveId (for the panel's chat grouping).
	// Entries are newest-first by createdAt.
	const bookmarksByArchiveList = $derived.by(() => {
		const grouped = new Map<string, Bookmark[]>();
		for (const bookmark of bookmarks) {
			const existing = grouped.get(bookmark.archiveId);
			if (existing) {
				existing.push(bookmark);
			} else {
				grouped.set(bookmark.archiveId, [bookmark]);
			}
		}
		return grouped;
	});

	return {
		// Getters
		get bookmarks() {
			return bookmarks;
		},
		/** Map of archiveId -> (Map of messageId -> Bookmark). Use for O(1) scoped lookups. */
		get bookmarksByArchive() {
			return bookmarksByArchive;
		},
		/** Map of archiveId -> Bookmark[] grouped for panel display. */
		get bookmarksByArchiveList() {
			return bookmarksByArchiveList;
		},
		get count() {
			return bookmarks.length;
		},

		/** Map of messageId -> Bookmark for the currently selected archive. */
		bookmarksByMessageIdForArchive(archiveId: string): Map<string, Bookmark> {
			return bookmarksByArchive.get(archiveId) ?? new Map();
		},

		// Check if a message is bookmarked within an archive
		isBookmarked(archiveId: string, messageId: string): boolean {
			return bookmarksByArchive.get(archiveId)?.has(messageId) ?? false;
		},

		// Get bookmark for a message within an archive
		getBookmark(archiveId: string, messageId: string): Bookmark | undefined {
			return bookmarksByArchive.get(archiveId)?.get(messageId);
		},

		// Get bookmarks for a specific archive
		getBookmarksForArchive(archiveId: string): Bookmark[] {
			return bookmarks.filter((b) => b.archiveId === archiveId);
		},

		// Add a new bookmark
		addBookmark(params: {
			archiveId: string;
			messageId: string;
			chatTitle: string;
			comment?: string;
			messageContent: string;
			sender: string;
			messageTimestamp: Date;
		}): Bookmark {
			const newBookmark: Bookmark = {
				id: generateId(),
				archiveId: params.archiveId,
				messageId: params.messageId,
				chatTitle: params.chatTitle,
				comment: params.comment || '',
				createdAt: new Date().toISOString(),
				messagePreview: truncateText(params.messageContent),
				sender: params.sender,
				messageTimestamp: params.messageTimestamp.toISOString(),
			};

			bookmarks = [...bookmarks, newBookmark];
			return newBookmark;
		},

		// Update bookmark comment
		updateBookmarkComment(
			archiveId: string,
			messageId: string,
			comment: string,
		): void {
			bookmarks = bookmarks.map((b) =>
				b.archiveId === archiveId && b.messageId === messageId
					? { ...b, comment }
					: b,
			);
		},

		// Remove a bookmark
		removeBookmark(archiveId: string, messageId: string): boolean {
			const initialLength = bookmarks.length;
			const filtered = bookmarks.filter(
				(b) => !(b.archiveId === archiveId && b.messageId === messageId),
			);

			if (filtered.length === initialLength) {
				return false;
			}

			bookmarks = filtered;
			return true;
		},

		// Toggle bookmark (add if not exists, remove if exists)
		toggleBookmark(params: {
			archiveId: string;
			messageId: string;
			chatTitle: string;
			messageContent: string;
			sender: string;
			messageTimestamp: Date;
		}): { added: boolean; bookmark?: Bookmark } {
			const existing = this.getBookmark(params.archiveId, params.messageId);

			if (existing) {
				this.removeBookmark(params.archiveId, params.messageId);
				return { added: false };
			}
			const bookmark = this.addBookmark(params);
			return { added: true, bookmark };
		},

		// Export bookmarks to JSON
		exportBookmarks(): BookmarkExport {
			return {
				version: 2,
				exportedAt: new Date().toISOString(),
				bookmarks: [...bookmarks],
			};
		},

		// Export to downloadable file
		downloadExport(): void {
			const data = this.exportBookmarks();
			const json = JSON.stringify(data, null, 2);
			const blob = new Blob([json], { type: 'application/json' });
			const url = URL.createObjectURL(blob);

			const a = document.createElement('a');
			a.href = url;
			a.download = `whatsapp-bookmarks-${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		},

		/**
		 * Import bookmarks from JSON (merges with existing bookmarks).
		 *
		 * Manual v2 exports carry canonical identity. Legacy v1 entries fail
		 * closed unless a validated restore supplies one concrete archive ID.
		 */
		importBookmarks(
			data: BookmarkExport | LegacyBookmarkExport,
			validatedArchiveId?: ArchiveId,
		): {
			imported: number;
			skipped: number;
		} {
			const incoming = normalizeExport(data, validatedArchiveId);

			// Merge: add new bookmarks, skip malformed and duplicate identities.
			// Keep identity structural: delimiters can appear in either value.
			const messageIdsByArchive = new Map<string, Set<string>>();
			for (const bookmark of bookmarks) {
				let messageIds = messageIdsByArchive.get(bookmark.archiveId);
				if (!messageIds) {
					messageIds = new Set();
					messageIdsByArchive.set(bookmark.archiveId, messageIds);
				}
				messageIds.add(bookmark.messageId);
			}
			const newBookmarks: Bookmark[] = [];
			let skipped = incoming.skipped;
			for (const bookmark of incoming.bookmarks) {
				let messageIds = messageIdsByArchive.get(bookmark.archiveId);
				if (!messageIds) {
					messageIds = new Set();
					messageIdsByArchive.set(bookmark.archiveId, messageIds);
				}
				if (messageIds.has(bookmark.messageId)) {
					skipped += 1;
					continue;
				}
				messageIds.add(bookmark.messageId);
				newBookmarks.push(bookmark);
			}

			if (newBookmarks.length > 0) {
				bookmarks = [...bookmarks, ...newBookmarks];
			}

			return { imported: newBookmarks.length, skipped };
		},

		// Import from a user-selected file. Legacy v1 fails closed here.
		async importFromFile(
			file: File,
		): Promise<{ imported: number; skipped: number }> {
			const text = await file.text();
			const data = JSON.parse(text) as BookmarkExport | LegacyBookmarkExport;
			return this.importBookmarks(data);
		},

		/** Import mixed old/new metadata after restore validates its archive. */
		importValidatedPersistedBookmarks(
			persistedBookmarks: PersistedBookmark[],
			validatedArchiveId: ArchiveId,
			exportedAt: string,
		): { imported: number; skipped: number } {
			const current: Bookmark[] = [];
			const legacy: LegacyBookmark[] = [];
			let skipped = 0;

			for (const bookmark of persistedBookmarks) {
				if ('archiveId' in bookmark) {
					if (bookmark.archiveId !== validatedArchiveId) {
						skipped += 1;
						continue;
					}
					current.push(bookmark);
				} else {
					legacy.push(bookmark);
				}
			}

			const currentResult = this.importBookmarks({
				version: 2,
				exportedAt,
				bookmarks: current,
			});
			const legacyResult = this.importBookmarks(
				{ version: 1, exportedAt, bookmarks: legacy },
				validatedArchiveId,
			);

			return {
				imported: currentResult.imported + legacyResult.imported,
				skipped: skipped + currentResult.skipped + legacyResult.skipped,
			};
		},

		// Clear all bookmarks
		clearAll(): void {
			bookmarks = [];
		},
	};
}

// Global bookmarks state instance
export const bookmarksState = createBookmarksState();

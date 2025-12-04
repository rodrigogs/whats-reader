/**
 * Bookmarks state management using Svelte 5 runes
 * Allows users to bookmark messages with optional comments
 */

const STORAGE_KEY = 'whats-reader-bookmarks';

export interface Bookmark {
	id: string;
	messageId: string;
	chatId: string; // Chat title/filename to identify which chat
	comment: string;
	createdAt: string; // ISO string
	messagePreview: string; // First ~100 chars of message content
	sender: string;
	messageTimestamp: string; // ISO string of original message timestamp
}

export interface BookmarkExport {
	version: 1;
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
	return text.substring(0, maxLength).trim() + '...';
}

// Load bookmarks from localStorage
function loadFromStorage(): Bookmark[] {
	if (typeof window === 'undefined') return [];
	
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return [];
		
		const data = JSON.parse(stored);
		// Validate that it's an array
		if (!Array.isArray(data)) return [];
		
		return data;
	} catch (e) {
		console.error('Failed to load bookmarks from storage:', e);
		return [];
	}
}

// Save bookmarks to localStorage
function saveToStorage(bookmarks: Bookmark[]): void {
	if (typeof window === 'undefined') return;
	
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
	} catch (e) {
		console.error('Failed to save bookmarks to storage:', e);
	}
}

// Create reactive bookmarks state
function createBookmarksState() {
	let bookmarks = $state<Bookmark[]>(loadFromStorage());

	// Derived: Map of messageId -> Bookmark for fast lookup
	const bookmarksByMessageId = $derived(
		new Map(bookmarks.map(b => [b.messageId, b]))
	);

	// Derived: Group bookmarks by chatId
	const bookmarksByChatId = $derived(() => {
		const grouped = new Map<string, Bookmark[]>();
		for (const bookmark of bookmarks) {
			const existing = grouped.get(bookmark.chatId) || [];
			existing.push(bookmark);
			grouped.set(bookmark.chatId, existing);
		}
		return grouped;
	});

	// Save to storage whenever bookmarks change
	$effect(() => {
		saveToStorage(bookmarks);
	});

	return {
		// Getters
		get bookmarks() { return bookmarks; },
		get bookmarksByMessageId() { return bookmarksByMessageId; },
		get bookmarksByChatId() { return bookmarksByChatId(); },
		get count() { return bookmarks.length; },

		// Check if a message is bookmarked
		isBookmarked(messageId: string): boolean {
			return bookmarksByMessageId.has(messageId);
		},

		// Get bookmark for a message
		getBookmark(messageId: string): Bookmark | undefined {
			return bookmarksByMessageId.get(messageId);
		},

		// Get bookmarks for a specific chat
		getBookmarksForChat(chatId: string): Bookmark[] {
			return bookmarks.filter(b => b.chatId === chatId);
		},

		// Add a new bookmark
		addBookmark(params: {
			messageId: string;
			chatId: string;
			comment?: string;
			messageContent: string;
			sender: string;
			messageTimestamp: Date;
		}): Bookmark {
			const newBookmark: Bookmark = {
				id: generateId(),
				messageId: params.messageId,
				chatId: params.chatId,
				comment: params.comment || '',
				createdAt: new Date().toISOString(),
				messagePreview: truncateText(params.messageContent),
				sender: params.sender,
				messageTimestamp: params.messageTimestamp.toISOString()
			};

			bookmarks = [...bookmarks, newBookmark];
			return newBookmark;
		},

		// Update bookmark comment
		updateBookmark(messageId: string, comment: string): void {
			bookmarks = bookmarks.map(b =>
				b.messageId === messageId
					? { ...b, comment }
					: b
			);
		},

		// Remove a bookmark
		removeBookmark(messageId: string): void {
			bookmarks = bookmarks.filter(b => b.messageId !== messageId);
		},

		// Toggle bookmark (add if not exists, remove if exists)
		toggleBookmark(params: {
			messageId: string;
			chatId: string;
			messageContent: string;
			sender: string;
			messageTimestamp: Date;
		}): { added: boolean; bookmark?: Bookmark } {
			const existing = bookmarksByMessageId.get(params.messageId);
			
			if (existing) {
				this.removeBookmark(params.messageId);
				return { added: false };
			} else {
				const bookmark = this.addBookmark(params);
				return { added: true, bookmark };
			}
		},

		// Export bookmarks to JSON
		exportBookmarks(): BookmarkExport {
			return {
				version: 1,
				exportedAt: new Date().toISOString(),
				bookmarks: [...bookmarks]
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

		// Import bookmarks from JSON
		importBookmarks(data: BookmarkExport, mode: 'merge' | 'replace' = 'merge'): { imported: number; skipped: number } {
			if (!data || data.version !== 1 || !Array.isArray(data.bookmarks)) {
				throw new Error('Invalid bookmark export format');
			}

			let imported = 0;
			let skipped = 0;

			if (mode === 'replace') {
				bookmarks = data.bookmarks;
				imported = data.bookmarks.length;
			} else {
				// Merge: add only bookmarks that don't exist (by messageId)
				const existingIds = new Set(bookmarks.map(b => b.messageId));
				const newBookmarks: Bookmark[] = [];
				
				for (const bookmark of data.bookmarks) {
					if (!existingIds.has(bookmark.messageId)) {
						newBookmarks.push(bookmark);
						imported++;
					} else {
						skipped++;
					}
				}

				if (newBookmarks.length > 0) {
					bookmarks = [...bookmarks, ...newBookmarks];
				}
			}

			return { imported, skipped };
		},

		// Import from file
		async importFromFile(file: File): Promise<{ imported: number; skipped: number }> {
			const text = await file.text();
			const data = JSON.parse(text) as BookmarkExport;
			return this.importBookmarks(data, 'merge');
		},

		// Clear all bookmarks
		clearAll(): void {
			bookmarks = [];
		}
	};
}

// Global bookmarks state instance
export const bookmarksState = createBookmarksState();

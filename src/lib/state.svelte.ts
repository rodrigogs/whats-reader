/**
 * Application state management using Svelte 5 runes
 */

import type {
	ParsedZipChat,
	SerializedSearchMessage,
} from './parser/zip-parser';
import { getAllTranscriptions } from './transcription.svelte';

// ChatData is now always a ParsedZipChat since we only support ZIP files
export type ChatData = ParsedZipChat;

export interface AppState {
	chats: ChatData[];
	selectedChatIndex: number | null;
	searchQuery: string;
	isLoading: boolean;
	error: string | null;
}

// Debounce delay for search input (ms)
const SEARCH_DEBOUNCE_MS = 150;

// Create reactive state
export function createAppState() {
	let chats = $state<ChatData[]>([]);
	let selectedChatIndex = $state<number | null>(null);
	// inputSearchQuery: what user types (for SearchBar display)
	// activeSearchQuery: query used for highlighting (only updates when results arrive)
	let inputSearchQuery = $state('');
	let activeSearchQuery = $state('');
	let isLoading = $state(false);
	let loadingProgress = $state(0); // 0-100 for file processing
	let error = $state<string | null>(null);

	// Track which chats have been indexed for bookmark navigation
	let indexedChatTitles = $state<Set<string>>(new Set());

	// Search state - VS Code style (navigate through results, don't filter)
	let isSearching = $state(false);
	let searchProgress = $state(0); // 0-100
	let searchResultIds = $state<string[]>([]); // Ordered list of matching message IDs (first N for navigation)
	let totalSearchMatches = $state(0); // Total number of matches (may be > searchResultIds.length)
	let currentSearchIndex = $state(0); // Current position in search results

	// Bitmap-based match lookup for O(1) performance
	// This avoids creating a Set from thousands of IDs on every search
	let searchMatchBitmap: Uint8Array | null = null;
	let searchMessageIdToIndex: Map<string, number> | null = null;

	let searchWorker: Worker | null = null;
	let searchWorkerReady = false;
	let searchWorkerChatTitle: string | null = null; // Track which chat the worker is loaded for
	let currentSearchId = 0; // For tracking/cancelling searches
	let searchDebounceId: ReturnType<typeof setTimeout> | null = null;
	let dataLoadTimeoutId: ReturnType<typeof setTimeout> | null = null;

	// Derived values
	const selectedChat = $derived(
		selectedChatIndex !== null ? chats[selectedChatIndex] : null,
	);

	// All messages (no filtering - we highlight and navigate instead)
	const displayMessages = $derived(selectedChat ? selectedChat.messages : []);

	// Current highlighted message ID
	const currentSearchResultId = $derived(
		searchResultIds.length > 0 ? searchResultIds[currentSearchIndex] : null,
	);

	// O(1) lookup function for checking if a message matches search
	// Uses bitmap from worker - much faster than Set for large result sets
	function isSearchMatch(messageId: string): boolean {
		if (!searchMatchBitmap || !searchMessageIdToIndex) return false;
		const idx = searchMessageIdToIndex.get(messageId);
		if (idx === undefined) return false;
		return searchMatchBitmap[idx] === 1;
	}

	const hasChats = $derived(chats.length > 0);

	// Cleanup search debounce
	function cleanupSearchDebounce() {
		if (searchDebounceId) {
			clearTimeout(searchDebounceId);
			searchDebounceId = null;
		}
	}

	// Terminate and cleanup worker
	function terminateSearchWorker() {
		cleanupSearchDebounce();
		if (dataLoadTimeoutId) {
			clearTimeout(dataLoadTimeoutId);
			dataLoadTimeoutId = null;
		}
		if (searchWorker) {
			searchWorker.terminate();
			searchWorker = null;
			searchWorkerReady = false;
			searchWorkerChatTitle = null;
		}
	}

	// Initialize or reuse search worker for a chat
	function ensureSearchWorker(chat: ChatData): Promise<void> {
		return new Promise((resolve, reject) => {
			// If worker is already loaded for this chat, reuse it
			if (
				searchWorker &&
				searchWorkerReady &&
				searchWorkerChatTitle === chat.title
			) {
				resolve();
				return;
			}

			// Terminate existing worker if it's for a different chat
			if (searchWorker) {
				searchWorker.terminate();
			}

			searchWorkerReady = false;
			searchWorkerChatTitle = chat.title;

			// Set timeout to reject if worker doesn't respond within 5 seconds
			const workerTimeoutId = setTimeout(() => {
				reject(
					new Error('Search worker failed to initialize within 5 seconds'),
				);
				searchWorkerReady = false;
			}, 5000);

			searchWorker = new Worker(
				new URL('./workers/search-worker.ts', import.meta.url),
				{ type: 'module' },
			);

			searchWorker.onmessage = (
				event: MessageEvent<{
					type: 'progress' | 'complete' | 'ready' | 'cancelled';
					searchId?: number;
					matchingIds?: string[];
					matchBitmap?: ArrayBuffer;
					totalMatches?: number;
					query?: string;
					progress?: number;
				}>,
			) => {
				const data = event.data;

				if (data.type === 'ready') {
					clearTimeout(workerTimeoutId);
					searchWorkerReady = true;
					resolve();
					return;
				}

				// Ignore results from old/cancelled searches
				if (data.searchId !== undefined && data.searchId !== currentSearchId) {
					return;
				}

				if (data.type === 'cancelled') {
					// Search was cancelled, do nothing
					return;
				}

				if (data.type === 'progress') {
					searchProgress = data.progress ?? 0;
				} else if (data.type === 'complete') {
					// Use the transferred bitmap for O(1) match lookup
					// This is MUCH faster than creating a Set from thousands of strings
					if (data.matchBitmap) {
						searchMatchBitmap = new Uint8Array(data.matchBitmap);
					} else {
						searchMatchBitmap = null;
					}

					searchResultIds = data.matchingIds ?? [];
					totalSearchMatches = data.totalMatches ?? searchResultIds.length;
					// Only update activeSearchQuery when results are ready
					// This prevents UI thrashing during typing
					activeSearchQuery = data.query ?? '';
					currentSearchIndex = 0;
					isSearching = false;
					searchProgress = 100;
				}
			};

			searchWorker.onerror = (err) => {
				console.error('Search worker error:', err);
				clearTimeout(workerTimeoutId);
				isSearching = false;
				searchProgress = 0;
				searchWorkerReady = false;
				reject(err);
			};

			// Send simplified message data to worker
			// Only send id, content, sender - minimal data for search
			// This is much smaller than serializing the full MiniSearch index!
			dataLoadTimeoutId = setTimeout(() => {
				// Use pre-computed serializedMessages if available (faster, avoids reactive proxy)
				// Otherwise fall back to messages array
				const messageData = chat.serializedMessages
					? chat.serializedMessages.map((m) => ({
							id: m.id,
							content: m.content,
							sender: m.sender,
						}))
					: chat.messages.map((m) => ({
							id: m.id,
							content: m.content,
							sender: m.sender,
						}));

				// Build the ID-to-index map for bitmap lookup on main thread
				searchMessageIdToIndex = new Map();
				for (let i = 0; i < messageData.length; i++) {
					searchMessageIdToIndex.set(messageData[i].id, i);
				}

				searchWorker?.postMessage({
					type: 'load-data',
					messages: messageData,
				});
				dataLoadTimeoutId = null;
			}, 0);
		});
	}

	// Perform search using Web Worker
	async function performSearch(query: string, chat: ChatData) {
		if (!query.trim()) {
			searchResultIds = [];
			currentSearchIndex = 0;
			isSearching = false;
			searchProgress = 0;
			return;
		}

		isSearching = true;
		searchProgress = 0;

		// Ensure worker is ready
		await ensureSearchWorker(chat);

		// Increment search ID to invalidate any previous search
		currentSearchId++;

		// Include transcriptions for audio message search
		const transcriptions = getAllTranscriptions();

		// Send lightweight search request (just query and transcriptions)
		searchWorker?.postMessage({
			type: 'search',
			searchId: currentSearchId,
			query,
			transcriptions,
		});
	}

	return {
		// State getters
		get chats() {
			return chats;
		},
		get selectedChatIndex() {
			return selectedChatIndex;
		},
		// inputSearchQuery: for SearchBar display (updates immediately)
		get searchQuery() {
			return inputSearchQuery;
		},
		// activeSearchQuery: for ChatView highlighting (only updates with results)
		get activeSearchQuery() {
			return activeSearchQuery;
		},
		get isLoading() {
			return isLoading;
		},
		get loadingProgress() {
			return loadingProgress;
		},
		get error() {
			return error;
		},
		get isSearching() {
			return isSearching;
		},
		get searchProgress() {
			return searchProgress;
		},
		get searchResultIds() {
			return searchResultIds;
		},
		get totalSearchMatches() {
			return totalSearchMatches;
		},
		get currentSearchIndex() {
			return currentSearchIndex;
		},
		get currentSearchResultId() {
			return currentSearchResultId;
		},
		// O(1) match lookup function - replaces searchResultSet
		// This is much faster than creating/updating a Set with thousands of IDs
		isSearchMatch,
		get indexedChatTitles() {
			return indexedChatTitles;
		},

		// Derived getters
		get selectedChat() {
			return selectedChat;
		},
		get displayMessages() {
			return displayMessages;
		},
		get hasChats() {
			return hasChats;
		},

		// Actions
		addChat(chat: ChatData) {
			chats = [...chats, chat];
			// Auto-select the newly added chat
			selectedChatIndex = chats.length - 1;
		},

		removeChat(index: number) {
			const removedChat = chats[index];
			chats = chats.filter((_, i) => i !== index);
			if (selectedChatIndex === index) {
				selectedChatIndex = chats.length > 0 ? 0 : null;
			} else if (selectedChatIndex !== null && selectedChatIndex > index) {
				selectedChatIndex--;
			}
			// Remove from indexed set if present
			if (removedChat) {
				const newSet = new Set(indexedChatTitles);
				newSet.delete(removedChat.title);
				indexedChatTitles = newSet;
			}
		},

		/**
		 * Update a chat's message index after worker completes indexing
		 */
		updateChatMessageIndex(
			chatTitle: string,
			messageIndex: Map<string, number>,
		) {
			const chatIndex = chats.findIndex((c) => c.title === chatTitle);
			if (chatIndex !== -1) {
				// Create a new chat object with the messageIndex to trigger reactivity
				const updatedChat = { ...chats[chatIndex], messageIndex };
				chats = chats.map((c, i) => (i === chatIndex ? updatedChat : c));
				// Mark as indexed
				indexedChatTitles = new Set([...indexedChatTitles, chatTitle]);
			}
		},

		/**
		 * Update a chat's flat items after worker completes processing
		 * Also builds messagesById map for O(1) lookups
		 */
		updateChatFlatItems(
			chatTitle: string,
			flatItems: import('./parser/zip-parser').FlatItem[],
		) {
			const chatIndex = chats.findIndex((c) => c.title === chatTitle);
			if (chatIndex !== -1) {
				const chat = chats[chatIndex];
				// Build messagesById map from messages array
				const messagesById = new Map<
					string,
					import('./parser/chat-parser').ChatMessage
				>();
				for (const msg of chat.messages) {
					messagesById.set(msg.id, msg);
				}
				// Create a new chat object with flatItems and messagesById to trigger reactivity
				const updatedChat = { ...chat, flatItems, messagesById };
				chats = chats.map((c, i) => (i === chatIndex ? updatedChat : c));
			}
		},

		/**
		 * Update a chat's serialized messages after worker completes processing
		 * These are used by the search worker to avoid re-serializing on every search
		 */
		updateChatSerializedMessages(
			chatTitle: string,
			serializedMessages: SerializedSearchMessage[],
		) {
			const chatIndex = chats.findIndex((c) => c.title === chatTitle);
			if (chatIndex !== -1) {
				const chat = chats[chatIndex];
				// Create a new chat object with serialized messages to trigger reactivity
				const updatedChat = {
					...chat,
					serializedMessages,
				};
				chats = chats.map((c, i) => (i === chatIndex ? updatedChat : c));
			}
		},

		selectChat(index: number | null) {
			// Reset search when changing chats
			terminateSearchWorker();
			inputSearchQuery = '';
			activeSearchQuery = '';
			searchResultIds = [];
			searchMatchBitmap = null;
			searchMessageIdToIndex = null;
			totalSearchMatches = 0;
			currentSearchIndex = 0;
			isSearching = false;
			searchProgress = 0;
			selectedChatIndex = index;
		},

		setSearchQuery(query: string) {
			// Update input immediately for SearchBar display
			inputSearchQuery = query;

			// Clear any pending debounced search
			cleanupSearchDebounce();

			// Cancel any in-progress search
			if (searchWorker && searchWorkerReady) {
				currentSearchId++;
				searchWorker.postMessage({ type: 'cancel' });
			}

			if (!query.trim()) {
				// Clear results and active query immediately for empty query
				activeSearchQuery = '';
				searchResultIds = [];
				searchMatchBitmap = null; // Clear bitmap
				totalSearchMatches = 0;
				currentSearchIndex = 0;
				isSearching = false;
				searchProgress = 0;
				return;
			}

			// Debounce the search to avoid firing on every keystroke
			searchDebounceId = setTimeout(() => {
				searchDebounceId = null;
				if (selectedChat) {
					performSearch(query, selectedChat);
				}
			}, SEARCH_DEBOUNCE_MS);
		},

		// Navigate to next search result
		nextSearchResult() {
			if (searchResultIds.length > 0) {
				currentSearchIndex = (currentSearchIndex + 1) % searchResultIds.length;
			}
		},

		// Navigate to previous search result
		prevSearchResult() {
			if (searchResultIds.length > 0) {
				currentSearchIndex =
					(currentSearchIndex - 1 + searchResultIds.length) %
					searchResultIds.length;
			}
		},

		setLoading(loading: boolean) {
			isLoading = loading;
			if (loading) {
				loadingProgress = 0;
			}
		},

		setLoadingProgress(progress: number) {
			loadingProgress = Math.min(100, Math.max(0, progress));
		},

		setError(err: string | null) {
			error = err;
		},

		clearError() {
			error = null;
		},

		reset() {
			terminateSearchWorker();
			chats = [];
			selectedChatIndex = null;
			inputSearchQuery = '';
			activeSearchQuery = '';
			isLoading = false;
			error = null;
			searchResultIds = [];
			searchMatchBitmap = null;
			searchMessageIdToIndex = null;
			totalSearchMatches = 0;
			currentSearchIndex = 0;
			isSearching = false;
			searchProgress = 0;
			indexedChatTitles = new Set();
		},
	};
}

// Global app state instance
export const appState = createAppState();

/**
 * Application state management using Svelte 5 runes
 */

import type { ChatMessage } from "./parser/chat-parser";
import type { ParsedZipChat } from "./parser/zip-parser";
import { getAllTranscriptions } from "./transcription.svelte";

// ChatData is now always a ParsedZipChat since we only support ZIP files
export type ChatData = ParsedZipChat;

export interface AppState {
  chats: ChatData[];
  selectedChatIndex: number | null;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
}

// Create reactive state
export function createAppState() {
  let chats = $state<ChatData[]>([]);
  let selectedChatIndex = $state<number | null>(null);
  let searchQuery = $state("");
  let isLoading = $state(false);
  let loadingProgress = $state(0); // 0-100 for file processing
  let error = $state<string | null>(null);

  // Search state - VS Code style (navigate through results, don't filter)
  let isSearching = $state(false);
  let searchProgress = $state(0); // 0-100
  let searchResultIds = $state<string[]>([]); // Ordered list of matching message IDs
  let currentSearchIndex = $state(0); // Current position in search results
  let searchWorker: Worker | null = null;
  let searchTimeoutId: ReturnType<typeof setTimeout> | null = null;

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

  // Search results as a Set for fast lookup
  const searchResultSet = $derived(new Set(searchResultIds));

  const hasChats = $derived(chats.length > 0);

  // Cleanup worker and pending timeouts
  function cleanupSearchWorker() {
    if (searchTimeoutId) {
      clearTimeout(searchTimeoutId);
      searchTimeoutId = null;
    }
    if (searchWorker) {
      searchWorker.terminate();
      searchWorker = null;
    }
  }

  // Perform search using Web Worker
  function performSearch(query: string, messages: ChatMessage[]) {
    cleanupSearchWorker();

    if (!query.trim()) {
      searchResultIds = [];
      currentSearchIndex = 0;
      isSearching = false;
      searchProgress = 0;
      return;
    }

    isSearching = true;
    searchProgress = 0;

    const searchStartTime = Date.now();
    const MIN_SEARCH_DISPLAY_TIME = 300; // Minimum time to show progress (ms)

    searchWorker = new Worker(
      new URL("./workers/search-worker.ts", import.meta.url),
      { type: "module" },
    );

    searchWorker.onmessage = (
      event: MessageEvent<{
        type: "progress" | "complete";
        matchingIds?: string[];
        query: string;
        progress?: number;
      }>,
    ) => {
      const data = event.data;

      // Only process if this result matches current query
      if (data.query !== searchQuery) return;

      if (data.type === "progress") {
        searchProgress = data.progress ?? 0;
      } else if (data.type === "complete") {
        const elapsed = Date.now() - searchStartTime;
        const remainingTime = Math.max(0, MIN_SEARCH_DISPLAY_TIME - elapsed);

        // Ensure progress indicator is visible for at least MIN_SEARCH_DISPLAY_TIME
        searchTimeoutId = setTimeout(() => {
          searchResultIds = data.matchingIds ?? [];
          currentSearchIndex = 0;
          isSearching = false;
          searchProgress = 100;
          searchWorker?.terminate();
          searchWorker = null;
          searchTimeoutId = null;
        }, remainingTime);
      }
    };

    searchWorker.onerror = (err) => {
      console.error("Search worker error:", err);
      isSearching = false;
      searchProgress = 0;
      searchWorker?.terminate();
      searchWorker = null;
    };

    // Serialize messages for the worker
    const serializedMessages = messages.map((m) => ({
      id: m.id,
      timestamp: m.timestamp.toISOString(),
      sender: m.sender,
      content: m.content,
      isSystemMessage: m.isSystemMessage,
      isMediaMessage: m.isMediaMessage,
      mediaType: m.mediaType,
      rawLine: m.rawLine,
    }));

    // Include transcriptions for audio message search
    const transcriptions = getAllTranscriptions();

    searchWorker.postMessage({
      messages: serializedMessages,
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
    get searchQuery() {
      return searchQuery;
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
    get currentSearchIndex() {
      return currentSearchIndex;
    },
    get currentSearchResultId() {
      return currentSearchResultId;
    },
    get searchResultSet() {
      return searchResultSet;
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
      chats = chats.filter((_, i) => i !== index);
      if (selectedChatIndex === index) {
        selectedChatIndex = chats.length > 0 ? 0 : null;
      } else if (selectedChatIndex !== null && selectedChatIndex > index) {
        selectedChatIndex--;
      }
    },

    selectChat(index: number | null) {
      // Reset search when changing chats
      cleanupSearchWorker();
      searchQuery = "";
      searchResultIds = [];
      currentSearchIndex = 0;
      isSearching = false;
      searchProgress = 0;
      selectedChatIndex = index;
    },

    setSearchQuery(query: string) {
      searchQuery = query;
      if (selectedChat) {
        performSearch(query, selectedChat.messages);
      }
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
      cleanupSearchWorker();
      chats = [];
      selectedChatIndex = null;
      searchQuery = "";
      isLoading = false;
      error = null;
      searchResultIds = [];
      currentSearchIndex = 0;
      isSearching = false;
      searchProgress = 0;
    },
  };
}

// Global app state instance
export const appState = createAppState();

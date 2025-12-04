/**
 * Application state management using Svelte 5 runes
 */

import type { MediaFile, ParsedZipChat } from './parser/zip-parser';

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
	let searchQuery = $state('');
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	// Derived values
	const selectedChat = $derived(
		selectedChatIndex !== null ? chats[selectedChatIndex] : null
	);

	const filteredMessages = $derived.by(() => {
		if (!selectedChat) return [];
		if (!searchQuery.trim()) return selectedChat.messages;

		const query = searchQuery.toLowerCase();
		return selectedChat.messages.filter(
			(m) =>
				m.content.toLowerCase().includes(query) ||
				m.sender.toLowerCase().includes(query)
		);
	});

	const hasChats = $derived(chats.length > 0);

	return {
		// State getters
		get chats() { return chats; },
		get selectedChatIndex() { return selectedChatIndex; },
		get searchQuery() { return searchQuery; },
		get isLoading() { return isLoading; },
		get error() { return error; },
		
		// Derived getters
		get selectedChat() { return selectedChat; },
		get filteredMessages() { return filteredMessages; },
		get hasChats() { return hasChats; },

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
			selectedChatIndex = index;
		},

		setSearchQuery(query: string) {
			searchQuery = query;
		},

		setLoading(loading: boolean) {
			isLoading = loading;
		},

		setError(err: string | null) {
			error = err;
		},

		clearError() {
			error = null;
		},

		reset() {
			chats = [];
			selectedChatIndex = null;
			searchQuery = '';
			isLoading = false;
			error = null;
		}
	};
}

// Global app state instance
export const appState = createAppState();

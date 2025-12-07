<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import { bookmarksState } from '$lib/bookmarks.svelte';
import type { ChatMessage } from '$lib/parser';
import { groupMessagesByDate } from '$lib/parser';
import MessageBubble from './MessageBubble.svelte';
import * as m from '$lib/paraglide/messages';

interface Props {
	messages: ChatMessage[];
	chatId: string;
	currentUser?: string;
	searchQuery?: string;
	searchResultSet?: Set<string>;
	currentSearchResultId?: string | null;
	scrollToMessageId?: string | null;
	autoLoadMedia?: boolean;
}

let {
	messages,
	chatId,
	currentUser,
	searchQuery = '',
	searchResultSet = new Set(),
	currentSearchResultId = null,
	scrollToMessageId = null,
	autoLoadMedia = false,
}: Props = $props();

// Performance optimization: chunk messages for progressive rendering
const CHUNK_SIZE = 100; // Render 100 messages at a time
const INITIAL_CHUNKS = 2; // Start with 2 chunks (200 messages from bottom)

// Flatten messages with date separators for virtualization
type RenderItem =
	| { type: 'date'; date: string }
	| { type: 'message'; message: ChatMessage };

const flatItems = $derived.by(() => {
	const grouped = groupMessagesByDate(messages);
	const items: RenderItem[] = [];
	for (const [date, dayMessages] of grouped.entries()) {
		items.push({ type: 'date', date });
		for (const message of dayMessages) {
			items.push({ type: 'message', message });
		}
	}
	return items;
});

// Track loaded chunks (from bottom since we start at bottom)
let loadedChunksFromEnd = $state(INITIAL_CHUNKS);

// Calculate which items to render (from end of list)
const renderedItems = $derived.by(() => {
	const totalItems = flatItems.length;
	const itemsToRender = Math.min(totalItems, loadedChunksFromEnd * CHUNK_SIZE);
	const startIdx = Math.max(0, totalItems - itemsToRender);
	return {
		items: flatItems.slice(startIdx),
		startIndex: startIdx,
		hasMore: startIdx > 0,
	};
});

// Use the Map from bookmarksState directly - it's already reactive and stable
const bookmarkedMessageIds = $derived(bookmarksState.bookmarksByMessageId);

// Reference to message elements for scrolling
let messageRefs = new Map<string, HTMLElement>();
let chatContainer: HTMLElement;
let hasScrolledToBottom = $state(false);
let isLoadingMore = $state(false);

// Action to register message refs
function registerMessageRef(node: HTMLElement, messageId: string) {
	messageRefs.set(messageId, node);
	return {
		destroy() {
			messageRefs.delete(messageId);
		},
	};
}

// Track if we should trigger the highlight animation (after scroll completes)
let highlightReady = $state(false);
let highlightedId = $state<string | null>(null);
let pendingHighlightId = $state<string | null>(null);

// Persistent highlight - stays until user scrolls or navigates elsewhere
let persistentHighlightId = $state<string | null>(null);

// Load more messages when scrolling to top
let topSentinel: HTMLElement;
let observer: IntersectionObserver | null = null;

function setupIntersectionObserver() {
	if (typeof IntersectionObserver === 'undefined' || !chatContainer) return;

	observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting && renderedItems.hasMore && !isLoadingMore) {
					loadMoreMessages();
				}
			}
		},
		{
			root: chatContainer,
			rootMargin: '500px 0px 0px 0px', // Trigger 500px before reaching top
			threshold: 0,
		},
	);

	if (topSentinel) {
		observer.observe(topSentinel);
	}
}

function loadMoreMessages() {
	if (isLoadingMore || !renderedItems.hasMore) return;

	isLoadingMore = true;

	// Save current scroll position relative to bottom
	const scrollBottom = chatContainer.scrollHeight - chatContainer.scrollTop;

	// Load more chunks
	loadedChunksFromEnd = Math.min(
		loadedChunksFromEnd + 2, // Load 2 more chunks
		Math.ceil(flatItems.length / CHUNK_SIZE),
	);

	// After DOM updates, restore scroll position
	requestAnimationFrame(() => {
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight - scrollBottom;
		}
		isLoadingMore = false;
	});
}

// Track previous chatId to detect actual changes
let previousChatId = $state<string | null>(null);

// Reset chunks when chat changes
$effect(() => {
	if (previousChatId !== null && previousChatId !== chatId) {
		loadedChunksFromEnd = INITIAL_CHUNKS;
		hasScrolledToBottom = false;
		messageRefs.clear();
	}
	previousChatId = chatId;
});

// Scroll to bottom when messages first load
$effect(() => {
	if (messages.length > 0 && chatContainer && !hasScrolledToBottom) {
		requestAnimationFrame(() => {
			chatContainer.scrollTop = chatContainer.scrollHeight;
			hasScrolledToBottom = true;
		});
	}
});

// Setup intersection observer after mount
onMount(() => {
	setupIntersectionObserver();
});

// Cleanup on destroy
onDestroy(() => {
	observer?.disconnect();
	if (scrollTimeout) {
		clearTimeout(scrollTimeout);
	}
});

// Ensure message is loaded when navigating to search result
$effect(() => {
	if (currentSearchResultId) {
		ensureMessageLoaded(currentSearchResultId);
	}
});

// Scroll to current search result when it changes
$effect(() => {
	if (currentSearchResultId && messageRefs.has(currentSearchResultId)) {
		const element = messageRefs.get(currentSearchResultId);

		highlightReady = false;
		highlightedId = null;
		pendingHighlightId = currentSearchResultId;
		isNavigationScroll = true;

		element?.scrollIntoView({ behavior: 'smooth', block: 'center' });

		setTimeout(() => {
			isNavigationScroll = false;
		}, 500);
	}
});

// Scroll to specific message (from bookmark navigation)
$effect(() => {
	const targetId = scrollToMessageId;
	if (!targetId) return;

	// First ensure the message chunk is loaded
	ensureMessageLoaded(targetId);

	const scrollToMessage = () => {
		if (messageRefs.has(targetId)) {
			const element = messageRefs.get(targetId);

			highlightReady = false;
			highlightedId = null;
			pendingHighlightId = targetId;
			isNavigationScroll = true;

			element?.scrollIntoView({ behavior: 'smooth', block: 'center' });

			setTimeout(() => {
				isNavigationScroll = false;
			}, 500);

			return true;
		}
		return false;
	};

	// Try immediately
	if (scrollToMessage()) return;

	// If not found, wait for DOM to update with loaded chunks
	// Use multiple attempts with increasing delays
	const attempts = [0, 50, 150, 300];
	let attemptIndex = 0;

	const tryScroll = () => {
		if (scrollToMessage()) return;
		attemptIndex++;
		if (attemptIndex < attempts.length) {
			setTimeout(tryScroll, attempts[attemptIndex]);
		}
	};

	requestAnimationFrame(tryScroll);
});

// Ensure a specific message ID is loaded (expand chunks if needed)
function ensureMessageLoaded(messageId: string) {
	// Find the message index in flatItems
	const messageIndex = flatItems.findIndex(
		(item) => item.type === 'message' && item.message.id === messageId,
	);

	if (messageIndex === -1) return;

	// Calculate how many chunks we need from the end
	const itemsFromEnd = flatItems.length - messageIndex;
	const chunksNeeded = Math.ceil(itemsFromEnd / CHUNK_SIZE);

	if (chunksNeeded > loadedChunksFromEnd) {
		loadedChunksFromEnd = chunksNeeded + 1; // Add buffer
	}
}

// Handle scroll end to trigger highlight
function handleScrollEnd() {
	if (scrollTimeout) {
		clearTimeout(scrollTimeout);
		scrollTimeout = null;
	}
	if (pendingHighlightId) {
		highlightReady = true;
		highlightedId = pendingHighlightId;
		persistentHighlightId = pendingHighlightId;
		pendingHighlightId = null;
	}
}

let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
let isNavigationScroll = $state(false);

function handleScroll() {
	if (!isNavigationScroll && persistentHighlightId && !pendingHighlightId) {
		persistentHighlightId = null;
	}

	if (typeof window !== 'undefined' && 'onscrollend' in window) return;

	if (scrollTimeout) {
		clearTimeout(scrollTimeout);
	}
	scrollTimeout = setTimeout(() => {
		handleScrollEnd();
	}, 150);
}
</script>

<div
	bind:this={chatContainer}
	class="flex-1 overflow-y-auto p-4 chat-bg"
	onscrollend={handleScrollEnd}
	onscroll={handleScroll}
>
	<!-- Top sentinel for loading more messages -->
	<div bind:this={topSentinel} class="h-1" aria-hidden="true"></div>
	
	<!-- Loading indicator -->
	{#if renderedItems.hasMore}
		<div class="flex justify-center py-4">
			<div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
				{#if isLoadingMore}
					<div class="w-4 h-4 border-2 border-gray-300 border-t-[var(--color-whatsapp-teal)] rounded-full animate-spin"></div>
				{m.messages_loading_older()}
			{:else}
				<span class="opacity-60">{m.messages_scroll_older()}</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Render items -->
	{#each renderedItems.items as item, idx (item.type === 'date' ? `date-${item.date}-${idx}` : item.message.id)}
		{#if item.type === 'date'}
			<!-- Date separator -->
			<div class="flex justify-center my-4">
				<div
					class="bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 text-xs px-3 py-1 rounded-lg shadow-sm"
				>
					{item.date}
				</div>
			</div>
		{:else}
			<!-- Message -->
			{@const message = item.message}
			<div
				use:registerMessageRef={message.id}
			>
				<MessageBubble
					{message}
					{chatId}
					{bookmarkedMessageIds}
					isOwn={currentUser !== undefined && message.sender === currentUser}
					showSender={true}
					{searchQuery}
					isSearchMatch={searchResultSet.has(message.id)}
					isCurrentSearchResult={message.id === currentSearchResultId}
					triggerHighlight={highlightReady && message.id === highlightedId}
					isHighlighted={message.id === persistentHighlightId}
					{autoLoadMedia}
				/>
			</div>
		{/if}
	{/each}

	{#if messages.length === 0}
		<div class="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
			<p>{m.messages_no_display()}</p>
		</div>
	{/if}
</div>

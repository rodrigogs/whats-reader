<script lang="ts">
import { onDestroy, onMount, tick } from 'svelte';
import { bookmarksState } from '$lib/bookmarks.svelte';
import * as m from '$lib/paraglide/messages';
import type { ChatMessage } from '$lib/parser';
import { groupMessagesByDate } from '$lib/parser';
import type { FlatItem } from '$lib/parser/zip-parser';
import MessageBubble from './MessageBubble.svelte';

interface Props {
	messages: ChatMessage[];
	chatId: string;
	currentUser?: string;
	searchQuery?: string;
	// O(1) lookup function to check if a message matches search
	isSearchMatch?: (messageId: string) => boolean;
	currentSearchResultId?: string | null;
	scrollToMessageId?: string | null;
	autoLoadMedia?: boolean;
	precomputedMessageIndex?: Map<string, number>;
	precomputedFlatItems?: FlatItem[];
	precomputedMessagesById?: Map<string, ChatMessage>;
}

// Default no-op function for isSearchMatch
const defaultIsSearchMatch = () => false;

let {
	messages,
	chatId,
	currentUser,
	searchQuery = '',
	isSearchMatch = defaultIsSearchMatch,
	currentSearchResultId = null,
	scrollToMessageId = null,
	autoLoadMedia = false,
	precomputedMessageIndex,
	precomputedFlatItems,
	precomputedMessagesById,
}: Props = $props();

// Performance optimization: chunk messages for progressive rendering
const CHUNK_SIZE = 100; // Render 100 messages at a time
const INITIAL_CHUNKS = 2; // Start with 2 chunks (200 messages from bottom)

// Flatten messages with date separators for virtualization
type RenderItem =
	| { type: 'date'; date: string }
	| { type: 'message'; message: ChatMessage };

// Check if precomputed data is available
const hasPrecomputedData = $derived(
	!!precomputedFlatItems && precomputedFlatItems.length > 0,
);

// Build a message lookup map - use precomputed if available, otherwise build lazily
let cachedMessagesById: Map<string, ChatMessage> | null = null;
let cachedMessagesChatId: string | null = null;
let cacheBuiltFully = false;

function getMessageById(id: string): ChatMessage | undefined {
	// Use precomputed map if available (fast path - no iteration needed)
	if (precomputedMessagesById) {
		return precomputedMessagesById.get(id);
	}

	// Invalidate cache if chat changed
	if (cachedMessagesChatId !== chatId) {
		cachedMessagesById = new Map();
		cachedMessagesChatId = chatId;
		cacheBuiltFully = false;
	}

	// If we have it cached, return it
	if (cachedMessagesById?.has(id)) {
		return cachedMessagesById.get(id);
	}

	// If cache is fully built and we don't have it, it doesn't exist
	if (cacheBuiltFully) {
		return undefined;
	}

	// Build full cache on first miss - this only happens once per chat
	// and only when precomputedMessagesById is not available
	if (!cacheBuiltFully) {
		for (const msg of messages) {
			cachedMessagesById!.set(msg.id, msg);
		}
		cacheBuiltFully = true;
	}

	return cachedMessagesById!.get(id);
}

// Get the total number of items (for chunking calculations)
const totalFlatItemsCount = $derived.by(() => {
	if (precomputedFlatItems && precomputedFlatItems.length > 0) {
		return precomputedFlatItems.length;
	}
	// Fallback: estimate based on messages (each message + ~1 date separator per day)
	// This is an approximation but close enough for chunk calculations
	return messages.length + Math.ceil(messages.length / 50); // rough estimate
});

// Get the message index map
const messageIndexMap = $derived(
	precomputedMessageIndex ?? new Map<string, number>(),
);

// Fallback: compute full flat items only when precomputed data is NOT available
const fallbackFlatItems = $derived.by(() => {
	// Only compute if we don't have precomputed data
	if (precomputedFlatItems && precomputedFlatItems.length > 0) {
		return null;
	}

	const grouped = groupMessagesByDate(messages);
	const items: RenderItem[] = [];
	const indexMap = new Map<string, number>();

	for (const [date, dayMessages] of grouped.entries()) {
		items.push({ type: 'date', date });
		for (const message of dayMessages) {
			indexMap.set(message.id, items.length);
			items.push({ type: 'message', message });
		}
	}

	// Update the cached index map if we computed it
	if (!precomputedMessageIndex) {
		// We can't mutate messageIndexMap derived, but the fallback case is rare
		// The index will be available via precomputed in most cases
	}

	return items;
});

// Track loaded chunks (from bottom since we start at bottom)
let loadedChunksFromEnd = $state(INITIAL_CHUNKS);

// Calculate which items to render (from end of list)
// This only resolves the items we actually need to display
const renderedItems = $derived.by(() => {
	const totalItems = totalFlatItemsCount;
	const itemsToRender = Math.min(totalItems, loadedChunksFromEnd * CHUNK_SIZE);
	const startIdx = Math.max(0, totalItems - itemsToRender);

	// If we have precomputed data, only resolve the slice we need
	if (precomputedFlatItems && precomputedFlatItems.length > 0) {
		const slice = precomputedFlatItems.slice(startIdx);
		const items: RenderItem[] = [];
		let skippedCount = 0;
		const skippedIds: string[] = [];

		for (const item of slice) {
			if (item.type === 'date') {
				items.push({ type: 'date', date: item.date });
			} else {
				const message = getMessageById(item.messageId);
				if (message) {
					items.push({ type: 'message', message });
				} else {
					skippedCount++;
					if (skippedIds.length < 5) {
						skippedIds.push(item.messageId);
					}
				}
			}
		}

		// Only log if messages were skipped
		if (skippedCount > 0) {
			console.warn(
				'[renderedItems] Skipped',
				skippedCount,
				'messages because getMessageById returned undefined',
			);
			console.warn('[renderedItems] First few skipped IDs:', skippedIds);
		}

		return {
			items,
			startIndex: startIdx,
			hasMore: startIdx > 0,
		};
	}

	// Fallback: use computed flat items
	const fallback = fallbackFlatItems ?? [];
	return {
		items: fallback.slice(startIdx),
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
		Math.ceil(totalFlatItemsCount / CHUNK_SIZE),
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
		// DON'T clear messageRefs here - let the destroy() callbacks handle cleanup
		// and the new elements will register themselves
		lastProcessedScrollId = null; // Reset so bookmarks work after chat switch
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
		// Capture current values to ensure deriveds are evaluated
		const currentIndexMap = messageIndexMap;
		const currentFlatItemsLength = totalFlatItemsCount;
		const messageIndex = currentIndexMap.get(currentSearchResultId);

		if (messageIndex !== undefined) {
			const itemsFromEnd = currentFlatItemsLength - messageIndex;
			const chunksNeeded = Math.ceil(itemsFromEnd / CHUNK_SIZE);

			if (chunksNeeded > loadedChunksFromEnd) {
				loadedChunksFromEnd = chunksNeeded + 1;
			}
		}
	}
});

// Scroll to current search result when it changes
$effect(() => {
	const targetId = currentSearchResultId;
	if (!targetId) return;

	// Capture current values to ensure deriveds are evaluated
	const currentIndexMap = messageIndexMap;
	const currentFlatItemsLength = totalFlatItemsCount;

	// Run async navigation with retry mechanism
	(async () => {
		const maxRetries = 20; // 20 * 50ms = 1 second max
		const retryDelay = 50;

		// Capture targetId at the start to detect if it changes during retries
		const capturedTargetId = targetId;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			// Check if currentSearchResultId changed during retry loop (race condition)
			if (currentSearchResultId !== capturedTargetId) {
				return; // Exit early, a newer navigation is in progress
			}

			// Check if we need to expand chunks
			const messageIndex = currentIndexMap.get(capturedTargetId);

			if (messageIndex !== undefined) {
				const itemsFromEnd = currentFlatItemsLength - messageIndex;
				const chunksNeeded = Math.ceil(itemsFromEnd / CHUNK_SIZE);

				if (chunksNeeded > loadedChunksFromEnd) {
					loadedChunksFromEnd = chunksNeeded + 1;
					await tick(); // Wait for DOM update after chunk expansion
				}
			}

			// Check if message ref exists in DOM
			if (messageRefs.has(capturedTargetId)) {
				const element = messageRefs.get(capturedTargetId);

				if (element) {
					highlightReady = false;
					highlightedId = null;
					pendingHighlightId = capturedTargetId;
					isNavigationScroll = true;

					element.scrollIntoView({ behavior: 'smooth', block: 'center' });

					setTimeout(() => {
						isNavigationScroll = false;
					}, 500);

					return; // Success, exit retry loop
				}
			}

			// Ref not ready yet, wait and retry
			await new Promise((resolve) => setTimeout(resolve, retryDelay));
		}
	})();
});

// Track last processed scroll to avoid duplicate processing
let lastProcessedScrollId: string | null = null;

// Reset tracking when scrollToMessageId is cleared (allows re-navigation to same message)
$effect(() => {
	if (scrollToMessageId === null) {
		lastProcessedScrollId = null;
	}
});

// Robust scroll-to-message function with retry mechanism
// This handles timing issues where DOM refs might not be available immediately
async function scrollToMessageWithRetry(targetId: string): Promise<boolean> {
	const maxRetries = 30; // 30 * 50ms = 1.5 seconds max
	const retryDelay = 50;

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		// 1. Check if target exists in current chat's index
		const messageIndex = messageIndexMap.get(targetId);

		if (messageIndex === undefined) {
			// Message not in this chat - nothing we can do
			console.log('[scrollToMessage] Message not in index, attempt:', attempt);
			// Give it a few attempts in case chat is still switching
			if (attempt < 5) {
				await new Promise((resolve) => setTimeout(resolve, retryDelay));
				continue;
			}
			return false;
		}

		// 2. Ensure enough chunks are loaded to include the target message
		const itemsFromEnd = totalFlatItemsCount - messageIndex;
		const chunksNeeded = Math.ceil(itemsFromEnd / CHUNK_SIZE);

		if (chunksNeeded > loadedChunksFromEnd) {
			loadedChunksFromEnd = chunksNeeded + 1;
			await tick(); // Wait for DOM update after chunk expansion
		}

		// 3. Check if message ref exists in DOM
		if (messageRefs.has(targetId)) {
			const element = messageRefs.get(targetId);

			if (element && chatContainer) {
				// Success! Perform scroll and highlight
				highlightReady = false;
				highlightedId = null;
				pendingHighlightId = targetId;
				isNavigationScroll = true;

				const elementRect = element.getBoundingClientRect();
				const containerRect = chatContainer.getBoundingClientRect();
				const elementOffsetTop =
					elementRect.top - containerRect.top + chatContainer.scrollTop;
				const scrollToPosition =
					elementOffsetTop - containerRect.height / 2 + elementRect.height / 2;

				chatContainer.scrollTo({
					top: scrollToPosition,
					behavior: 'smooth',
				});

				setTimeout(() => {
					isNavigationScroll = false;
				}, 500);

				console.log('[scrollToMessage] Success on attempt:', attempt);
				return true;
			}
		}

		// 4. Ref not ready yet, wait and retry
		console.log(
			'[scrollToMessage] Ref not ready, attempt:',
			attempt,
			'refsSize:',
			messageRefs.size,
		);
		await new Promise((resolve) => setTimeout(resolve, retryDelay));
	}

	console.log(
		'[scrollToMessage] Failed after',
		maxRetries,
		'attempts for:',
		targetId,
	);
	return false;
}

// Simple effect that triggers the retry-based scroll
$effect(() => {
	const targetId = scrollToMessageId;

	if (!targetId || targetId === lastProcessedScrollId) return;

	// Mark as processed immediately to prevent duplicate attempts
	lastProcessedScrollId = targetId;

	console.log('[Scroll Effect] Starting scroll to:', targetId);

	// Fire and forget - the retry mechanism handles all timing
	scrollToMessageWithRetry(targetId);
});

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
			{@const matchResult = isSearchMatch(message.id)}
			<div
				use:registerMessageRef={message.id}
			>
				<MessageBubble
					{message}
					{chatId}
					{bookmarkedMessageIds}
					isOwn={currentUser !== undefined && message.sender === currentUser}
					showSender={true}
					searchQuery={matchResult ? searchQuery : ''}
					isSearchMatch={matchResult}
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

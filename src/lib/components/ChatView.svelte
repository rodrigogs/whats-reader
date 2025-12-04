<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { ChatMessage } from '$lib/parser';
	import { groupMessagesByDate } from '$lib/parser';
	import MessageBubble from './MessageBubble.svelte';

	interface Props {
		messages: ChatMessage[];
		currentUser?: string;
		searchQuery?: string;
		searchResultSet?: Set<string>;
		currentSearchResultId?: string | null;
	}

	let { messages, currentUser, searchQuery = '', searchResultSet = new Set(), currentSearchResultId = null }: Props = $props();

	const groupedMessages = $derived(groupMessagesByDate(messages));

	// Reference to message elements for scrolling
	let messageRefs = $state<Map<string, HTMLElement>>(new Map());
	let chatContainer: HTMLElement;
	let hasScrolledToBottom = $state(false);
	
	// Track if we should trigger the highlight animation (after scroll completes)
	let highlightReady = $state(false);
	let highlightedId = $state<string | null>(null);
	let pendingHighlightId = $state<string | null>(null);

	// Scroll to bottom when messages first load
	$effect(() => {
		if (messages.length > 0 && chatContainer && !hasScrolledToBottom) {
			// Use tick to ensure DOM is updated
			requestAnimationFrame(() => {
				chatContainer.scrollTop = chatContainer.scrollHeight;
				hasScrolledToBottom = true;
			});
		}
	});

	// Reset scroll flag when messages change (new chat loaded)
	$effect(() => {
		// Track messages array reference to detect new chat
		const _ = messages;
		hasScrolledToBottom = false;
	});

	// Scroll to current search result when it changes
	$effect(() => {
		if (currentSearchResultId && messageRefs.has(currentSearchResultId)) {
			const element = messageRefs.get(currentSearchResultId);
			
			// Reset highlight state before scrolling
			highlightReady = false;
			highlightedId = null;
			pendingHighlightId = currentSearchResultId;
			
			// Scroll to the element
			element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	});

	// Handle scroll end to trigger highlight
	function handleScrollEnd() {
		// Clear any pending debounced scroll handler since scrollend fired
		if (scrollTimeout) {
			clearTimeout(scrollTimeout);
			scrollTimeout = null;
		}
		if (pendingHighlightId) {
			highlightReady = true;
			highlightedId = pendingHighlightId;
			pendingHighlightId = null;
		}
	}

	// Debounced scroll handler as fallback for browsers without scrollend
	let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
	// Track if browser supports scrollend
	let supportsScrollEnd = typeof window !== 'undefined' && 'onscrollend' in window;
	
	function handleScroll() {
		// Only use debounced fallback if scrollend is not supported
		if (supportsScrollEnd) return;
		
		if (scrollTimeout) {
			clearTimeout(scrollTimeout);
		}
		scrollTimeout = setTimeout(() => {
			handleScrollEnd();
		}, 150);
	}

	// Cleanup timeout on component destroy
	onDestroy(() => {
		if (scrollTimeout) {
			clearTimeout(scrollTimeout);
		}
	});
</script>

<div
	bind:this={chatContainer}
	class="flex-1 overflow-y-auto bg-[var(--color-chat-bg)] p-4 bg-[url('/chat-bg.svg')] bg-repeat"
	onscrollend={handleScrollEnd}
	onscroll={handleScroll}
>
	{#each [...groupedMessages.entries()] as [date, dayMessages]}
		<!-- Date separator -->
		<div class="flex justify-center my-4">
			<div
				class="bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 text-xs px-3 py-1 rounded-lg shadow-sm"
			>
				{date}
			</div>
		</div>

		<!-- Messages for this date -->
		{#each dayMessages as message (message.id)}
			<div
				bind:this={
					() => messageRefs.get(message.id) ?? null,
					(el: HTMLElement | null) => {
						if (el) {
							messageRefs.set(message.id, el);
						} else {
							messageRefs.delete(message.id);
						}
					}
				}
			>
				<MessageBubble
					{message}
					isOwn={currentUser !== undefined && message.sender === currentUser}
					showSender={true}
					{searchQuery}
					isSearchMatch={searchResultSet.has(message.id)}
					isCurrentSearchResult={message.id === currentSearchResultId}
					triggerHighlight={highlightReady && message.id === highlightedId}
				/>
			</div>
		{/each}
	{/each}

	{#if messages.length === 0}
		<div class="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
			<p>No messages to display</p>
		</div>
	{/if}
</div>

<script lang="ts">
	import { bookmarksState } from '$lib/bookmarks.svelte';

	interface Props {
		messageId: string;
		chatId: string;
		messageContent: string;
		sender: string;
		messageTimestamp: Date;
		onBookmarkChange?: (isBookmarked: boolean) => void;
	}

	let { messageId, chatId, messageContent, sender, messageTimestamp, onBookmarkChange }: Props = $props();

	const isBookmarked = $derived(bookmarksState.isBookmarked(messageId));

	function handleClick(e: MouseEvent) {
		e.stopPropagation();
		const result = bookmarksState.toggleBookmark({
			messageId,
			chatId,
			messageContent,
			sender,
			messageTimestamp
		});
		onBookmarkChange?.(result.added);
	}
</script>

<button
	type="button"
	class="bookmark-btn p-1 rounded transition-all duration-200 hover:bg-black/10 dark:hover:bg-white/10"
	class:bookmarked={isBookmarked}
	onclick={handleClick}
	title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
	aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
>
	{#if isBookmarked}
		<!-- Filled bookmark icon -->
		<svg class="w-4 h-4 text-[var(--color-whatsapp-teal)]" fill="currentColor" viewBox="0 0 24 24">
			<path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
		</svg>
	{:else}
		<!-- Outline bookmark icon -->
		<svg class="w-4 h-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
		</svg>
	{/if}
</button>

<style>
	.bookmark-btn {
		opacity: 0;
		transform: scale(0.8);
	}

	:global(.message-container:hover) .bookmark-btn,
	.bookmark-btn.bookmarked {
		opacity: 1;
		transform: scale(1);
	}

	.bookmark-btn.bookmarked {
		opacity: 1;
	}
</style>

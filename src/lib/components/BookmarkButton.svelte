<script lang="ts">
import * as m from '$lib/paraglide/messages';
import Icon from './Icon.svelte';

interface Props {
	messageId: string;
	chatId: string;
	messageContent: string;
	sender: string;
	messageTimestamp: Date;
	isBookmarked?: boolean;
	onBookmarkClick?: (isBookmarked: boolean) => void;
}

let {
	messageId,
	chatId,
	messageContent,
	sender,
	messageTimestamp,
	isBookmarked = false,
	onBookmarkClick,
}: Props = $props();

function handleClick(e: MouseEvent) {
	e.stopPropagation();
	// Just notify parent - don't save the bookmark here
	// The modal will handle saving when user clicks Save
	onBookmarkClick?.(isBookmarked);
}
</script>

<button
	type="button"
	class="bookmark-btn p-1 rounded transition-all duration-200 cursor-pointer hover:bg-black/10 dark:hover:bg-white/10"
	class:bookmarked={isBookmarked}
	onclick={handleClick}
	title={isBookmarked ? m.bookmarks_edit() : m.bookmarks_add()}
	aria-label={isBookmarked ? m.bookmarks_edit() : m.bookmarks_add()}
>
	{#if isBookmarked}
		<!-- Filled bookmark icon -->
		<Icon 
			name="bookmark" 
			filled 
			size="sm" 
			class="text-[var(--color-whatsapp-teal)] hover:text-[var(--color-whatsapp-dark)] transition-colors" 
		/>
	{:else}
		<!-- Outline bookmark icon -->
		<Icon 
			name="bookmark-outline" 
			size="sm" 
			class="text-gray-400 hover:text-[var(--color-whatsapp-teal)] dark:text-gray-500 dark:hover:text-[var(--color-whatsapp-teal)] transition-colors" 
		/>
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

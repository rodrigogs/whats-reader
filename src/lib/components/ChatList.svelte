<script lang="ts">
	import type { ChatData } from '$lib/state.svelte';

	interface Props {
		chats: ChatData[];
		selectedIndex: number | null;
		onSelect: (index: number) => void;
		onRemove: (index: number) => void;
	}

	let { chats, selectedIndex, onSelect, onRemove }: Props = $props();

	function formatDate(date: Date | null): string {
		if (!date) return '';
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days === 0) {
			return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
		} else if (days === 1) {
			return 'Yesterday';
		} else if (days < 7) {
			return date.toLocaleDateString('en-US', { weekday: 'short' });
		} else {
			return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		}
	}

	function getLastMessage(chat: ChatData): string {
		if (chat.messages.length === 0) return 'No messages';
		const last = chat.messages[chat.messages.length - 1];
		if (last.isMediaMessage) return '📎 Media';
		if (last.isSystemMessage) return last.content;
		return `${last.sender}: ${last.content}`;
	}
</script>

<div class="flex flex-col h-full bg-white dark:bg-gray-900">
	<!-- Header -->
	<div class="p-4 border-b border-gray-200 dark:border-gray-700">
		<h2 class="text-lg font-semibold text-gray-800 dark:text-white">Chats</h2>
		<p class="text-sm text-gray-500 dark:text-gray-400">{chats.length} conversations</p>
	</div>

	<!-- Chat list -->
	<div class="flex-1 overflow-y-auto">
		{#if chats.length === 0}
			<div class="p-4 text-center text-gray-500 dark:text-gray-400">
				<p>No chats loaded</p>
				<p class="text-sm mt-1">Import a WhatsApp export to get started</p>
			</div>
		{:else}
			{#each chats as chat, index}
				<div
					class="w-full p-4 flex items-start gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 cursor-pointer {selectedIndex === index ? 'bg-gray-100 dark:bg-gray-800' : ''}"
					onclick={() => onSelect(index)}
					onkeydown={(e) => e.key === 'Enter' && onSelect(index)}
					role="button"
					tabindex="0"
				>
					<!-- Avatar -->
					<div
						class="w-12 h-12 rounded-full bg-[var(--color-whatsapp-teal)] flex items-center justify-center text-white font-semibold flex-shrink-0"
					>
						{chat.title.charAt(0).toUpperCase()}
					</div>

					<!-- Chat info -->
					<div class="flex-1 min-w-0 text-left">
						<div class="flex items-center justify-between">
							<h3 class="font-semibold text-gray-800 dark:text-white truncate">
								{chat.title}
							</h3>
							<span class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
								{formatDate(chat.endDate)}
							</span>
						</div>
						<p class="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
							{getLastMessage(chat)}
						</p>
						<div class="flex items-center gap-2 mt-1">
							<span class="text-xs text-gray-400 dark:text-gray-500">
								{chat.messageCount} messages
							</span>
							{#if chat.mediaCount > 0}
								<span class="text-xs text-gray-400 dark:text-gray-500">
									• {chat.mediaCount} media
								</span>
							{/if}
						</div>
					</div>

					<!-- Remove button -->
					<button
						class="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
						onclick={(e) => {
							e.stopPropagation();
							onRemove(index);
						}}
						title="Remove chat"
						aria-label="Remove chat"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			{/each}
		{/if}
	</div>
</div>

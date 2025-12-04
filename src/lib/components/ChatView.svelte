<script lang="ts">
	import type { ChatMessage } from '$lib/parser';
	import { groupMessagesByDate } from '$lib/parser';
	import MessageBubble from './MessageBubble.svelte';

	interface Props {
		messages: ChatMessage[];
		currentUser?: string;
	}

	let { messages, currentUser }: Props = $props();

	const groupedMessages = $derived(groupMessagesByDate(messages));

	// Auto-scroll to bottom when messages change
	let chatContainer: HTMLElement;

	$effect(() => {
		if (chatContainer && messages.length > 0) {
			// Scroll to bottom on new messages
			setTimeout(() => {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}, 100);
		}
	});
</script>

<div
	bind:this={chatContainer}
	class="flex-1 overflow-y-auto bg-[var(--color-chat-bg)] p-4 bg-[url('/chat-bg.svg')] bg-repeat"
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
			<MessageBubble
				{message}
				isOwn={currentUser !== undefined && message.sender === currentUser}
				showSender={true}
			/>
		{/each}
	{/each}

	{#if messages.length === 0}
		<div class="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
			<p>No messages to display</p>
		</div>
	{/if}
</div>

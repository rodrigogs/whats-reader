<script lang="ts">
	import type { ChatMessage } from '$lib/parser';
	import type { MediaFile } from '$lib/parser/zip-parser';
	import { formatTime, loadMediaFile } from '$lib/parser';

	interface MessageWithMedia extends ChatMessage {
		mediaFile?: MediaFile;
	}

	interface Props {
		message: MessageWithMedia;
		isOwn?: boolean;
		showSender?: boolean;
	}

	let { message, isOwn = false, showSender = true }: Props = $props();

	let mediaUrl = $state<string | null>(null);
	let mediaLoading = $state(false);
	let mediaError = $state<string | null>(null);

	const bubbleClass = $derived(
		isOwn
			? 'bg-[var(--color-message-out)] ml-auto'
			: 'bg-[var(--color-message-in)] mr-auto'
	);

	// Check if this message has an actual media file attached
	const hasMediaFile = $derived(message.mediaFile && message.mediaFile._zipEntry);

	async function loadMedia() {
		if (!message.mediaFile || mediaLoading || mediaUrl) return;
		
		mediaLoading = true;
		mediaError = null;
		
		try {
			mediaUrl = await loadMediaFile(message.mediaFile);
		} catch (e) {
			mediaError = e instanceof Error ? e.message : 'Failed to load media';
		} finally {
			mediaLoading = false;
		}
	}
</script>

{#if message.isSystemMessage}
	<!-- System message -->
	<div class="flex justify-center my-2">
		<div
			class="bg-white/80 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 text-xs px-3 py-1 rounded-lg shadow-sm max-w-[80%] text-center"
		>
			{message.content}
		</div>
	</div>
{:else}
	<!-- Regular message -->
	<div class="flex {isOwn ? 'justify-end' : 'justify-start'} mb-1">
		<div
			class="max-w-[75%] rounded-lg px-3 py-2 shadow-sm {bubbleClass} relative"
		>
			{#if showSender && !isOwn}
				<div class="text-xs font-semibold text-[var(--color-whatsapp-teal)] mb-1">
					{message.sender}
				</div>
			{/if}

			{#if message.isMediaMessage}
				<!-- Media message -->
				{#if hasMediaFile}
					<!-- We have the actual media file -->
					{#if mediaUrl}
						<!-- Media loaded -->
						{#if message.mediaType === 'image' || message.mediaType === 'sticker'}
							<img 
								src={mediaUrl} 
								alt="{message.mediaFile?.name || 'Media attachment'}" 
								class="max-w-full rounded-lg mb-1 cursor-pointer"
								style="max-height: 300px;"
								loading="lazy"
							/>
						{:else if message.mediaType === 'video'}
							<video 
								src={mediaUrl} 
								controls 
								class="max-w-full rounded-lg mb-1"
								style="max-height: 300px;"
								preload="metadata"
							>
								<track kind="captions" />
							</video>
						{:else if message.mediaType === 'audio'}
							<audio src={mediaUrl} controls class="w-full mb-1" preload="metadata">
								<track kind="captions" />
							</audio>
						{:else}
							<!-- Document or other - show download link -->
							<a 
								href={mediaUrl} 
								download={message.mediaFile?.name}
								class="flex items-center gap-2 text-[var(--color-whatsapp-teal)] hover:underline"
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								<span class="text-sm">{message.mediaFile?.name || 'Download'}</span>
							</a>
						{/if}
					{:else if mediaLoading}
						<!-- Loading state -->
						<div class="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-2">
							<div class="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-[var(--color-whatsapp-teal)]"></div>
							<span class="text-sm">Loading...</span>
						</div>
					{:else if mediaError}
						<!-- Error state -->
						<div class="flex items-center gap-2 text-red-500 py-2">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span class="text-sm">Failed to load</span>
						</div>
					{:else}
						<!-- Click to load -->
						<button 
							class="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-[var(--color-whatsapp-teal)] transition-colors py-2"
							onclick={loadMedia}
						>
							{#if message.mediaType === 'image'}
								<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
								<span class="text-sm">Click to load image</span>
							{:else if message.mediaType === 'video'}
								<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span class="text-sm">Click to load video</span>
							{:else if message.mediaType === 'audio'}
								<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
								</svg>
								<span class="text-sm">Click to load audio</span>
							{:else if message.mediaType === 'sticker'}
								<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span class="text-sm">Click to load sticker</span>
							{:else}
								<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								<span class="text-sm">Click to load file</span>
							{/if}
						</button>
					{/if}
				{:else}
					<!-- Media file not available (omitted or missing) -->
					<div class="flex items-center gap-2 text-gray-400 dark:text-gray-500 py-1">
						{#if message.mediaType === 'image'}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
							</svg>
							<span class="text-sm italic">Photo</span>
						{:else if message.mediaType === 'video'}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
							</svg>
							<span class="text-sm italic">Video</span>
						{:else if message.mediaType === 'audio'}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
							</svg>
							<span class="text-sm italic">Voice Message</span>
						{:else if message.mediaType === 'document'}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							<span class="text-sm italic">Document</span>
						{:else if message.mediaType === 'sticker'}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span class="text-sm italic">Sticker</span>
						{:else if message.mediaType === 'contact'}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
							</svg>
							<span class="text-sm italic">Contact</span>
						{:else}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
							</svg>
							<span class="text-sm italic">Attachment</span>
						{/if}
					</div>
				{/if}
			{:else}
				<!-- Text content -->
				<p class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
					{message.content}
				</p>
			{/if}

			<!-- Timestamp -->
			<div
				class="text-[10px] text-gray-500 dark:text-gray-400 text-right mt-1 -mb-1"
			>
				{formatTime(message.timestamp)}
			</div>

			<!-- Bubble tail -->
			{#if isOwn}
				<div
					class="absolute -right-2 top-0 w-0 h-0 border-t-8 border-t-[var(--color-message-out)] border-r-8 border-r-transparent"
				></div>
			{:else}
				<div
					class="absolute -left-2 top-0 w-0 h-0 border-t-8 border-t-[var(--color-message-in)] border-l-8 border-l-transparent"
				></div>
			{/if}
		</div>
	</div>
{/if}

<script lang="ts">
import type { Bookmark } from '$lib/bookmarks.svelte';
import { bookmarksState } from '$lib/bookmarks.svelte';
import * as m from '$lib/paraglide/messages';
import type { ChatMessage } from '$lib/parser';
import { formatTime, loadMediaFile } from '$lib/parser';
import type { MediaFile } from '$lib/parser/zip-parser';
import {
	getCachedTranscription,
	getTranscriptionState,
	isTranscriptionSupported,
	transcribeAudio,
} from '$lib/transcription.svelte';
import BookmarkModal from './BookmarkModal.svelte';

interface MessageWithMedia extends ChatMessage {
	mediaFile?: MediaFile;
}

interface Props {
	message: MessageWithMedia;
	chatId: string;
	bookmarkedMessageIds?: Map<string, Bookmark>;
	isOwn?: boolean;
	showSender?: boolean;
	searchQuery?: string;
	isSearchMatch?: boolean;
	isCurrentSearchResult?: boolean;
	triggerHighlight?: boolean;
	isHighlighted?: boolean;
	autoLoadMedia?: boolean;
}

let {
	message,
	chatId,
	bookmarkedMessageIds = new Map(),
	isOwn = false,
	showSender = true,
	searchQuery = '',
	isSearchMatch = false,
	isCurrentSearchResult = false,
	triggerHighlight = false,
	isHighlighted = false,
	autoLoadMedia = false,
}: Props = $props();

let containerRef = $state<HTMLDivElement | null>(null);
let mediaUrl = $state<string | null>(null);
let mediaLoading = $state(false);
let mediaError = $state<string | null>(null);
let shouldAnimate = $state(false);
let showBookmarkModal = $state(false);

// Transcription state
let transcription = $state<string | null>(null);
let transcriptionLoading = $state(false);
let transcriptionError = $state<string | null>(null);
let showTranscription = $state(false);
const transcriptionState = getTranscriptionState();

// Auto-load media when visible and autoLoadMedia is enabled
$effect(() => {
	if (
		!autoLoadMedia ||
		!containerRef ||
		!message.mediaFile ||
		mediaUrl ||
		mediaLoading
	)
		return;

	const observer = new IntersectionObserver(
		(entries) => {
			if (entries[0]?.isIntersecting) {
				loadMedia();
				observer.disconnect();
			}
		},
		{ rootMargin: '200px' }, // Start loading slightly before visible
	);

	observer.observe(containerRef);

	return () => observer.disconnect();
});

const bubbleClass = $derived(
	isOwn
		? 'bg-[var(--color-message-out)] ml-auto'
		: 'bg-[var(--color-message-in)] mr-auto',
);

// Use wider bubble for audio messages to fit the audio player
const bubbleWidthClass = $derived(
	message.isMediaMessage &&
		message.mediaType === 'audio' &&
		message.mediaFile?._zipEntry
		? 'min-w-[280px] max-w-[90%] sm:max-w-[400px]'
		: 'max-w-[75%]',
);

// Highlight class for search results and persistent selection
const highlightClass = $derived.by(() => {
	// Persistent highlight (from search navigation or bookmark navigation)
	if (isHighlighted) {
		return 'ring-2 ring-[var(--color-whatsapp-teal)] shadow-lg shadow-[var(--color-whatsapp-teal)]/20';
	}
	if (isCurrentSearchResult) {
		return 'ring-2 ring-[var(--color-whatsapp-teal)] ring-offset-2 shadow-lg shadow-[var(--color-whatsapp-teal)]/30';
	}
	if (isSearchMatch) {
		return 'ring-1 ring-yellow-400/60';
	}
	if (bookmarkedMessageIds.has(message.id)) {
		return 'ring-1 ring-[var(--color-whatsapp-teal)]/40';
	}
	return '';
});

// Background highlight overlay for persistent selection (WhatsApp-style)
const highlightBgClass = $derived(
	isHighlighted ? 'bg-[var(--color-whatsapp-teal)]/10' : '',
);

function handleBookmarkClick(e: MouseEvent) {
	e.stopPropagation();
	// Open modal - the modal handles both create and edit modes
	showBookmarkModal = true;
}

// Trigger animation when triggerHighlight becomes true
$effect(() => {
	if (triggerHighlight) {
		// Reset and trigger animation
		shouldAnimate = false;
		requestAnimationFrame(() => {
			shouldAnimate = true;
			setTimeout(() => {
				shouldAnimate = false;
			}, 600);
		});
	}
});

// Check if this message has an actual media file that can be loaded
const hasMediaFile = $derived(message.mediaFile?._zipEntry);

// Check for cached transcription on mount
$effect(() => {
	if (message.isMediaMessage && message.mediaType === 'audio' && message.id) {
		const cached = getCachedTranscription(message.id);
		if (cached) {
			transcription = cached;
			showTranscription = true;
		}
	}
});

// Check if transcription matches current search query
const transcriptionMatchesSearch = $derived.by(() => {
	if (!searchQuery.trim() || !transcription) return false;
	return transcription.toLowerCase().includes(searchQuery.toLowerCase());
});

// Auto-expand transcription when it matches search
$effect(() => {
	if (transcriptionMatchesSearch && transcription && !showTranscription) {
		showTranscription = true;
	}
});

// Highlight search terms in text (safe from XSS)
function highlightText(text: string, query: string): string {
	if (!query.trim()) return escapeHtml(text);

	// Search on original text, then escape parts between matches
	const regex = new RegExp(escapeRegex(query), 'gi');
	let lastIndex = 0;
	let result = '';
	let match;
	while ((match = regex.exec(text)) !== null) {
		// Prevent infinite loop if regex matches empty string
		if (match[0].length === 0) {
			regex.lastIndex++;
			continue;
		}
		// Add text before the match, escaped
		result += escapeHtml(text.slice(lastIndex, match.index));
		// Add the matched text, escaped and wrapped in <mark>
		result += `<mark class="bg-yellow-300 dark:bg-yellow-600 rounded px-0.5">${escapeHtml(match[0])}</mark>`;
		lastIndex = match.index + match[0].length;
	}
	// Add the rest of the text, escaped
	result += escapeHtml(text.slice(lastIndex));
	return result;
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

async function transcribeVoiceMessage() {
	if (!mediaUrl || transcriptionLoading) return;

	transcriptionLoading = true;
	transcriptionError = null;

	try {
		const text = await transcribeAudio(mediaUrl, message.id);
		transcription = text || '(No speech detected)';
		showTranscription = true;
	} catch (e) {
		transcriptionError =
			e instanceof Error ? e.message : 'Transcription failed';
	} finally {
		transcriptionLoading = false;
	}
}
</script>

{#if message.isSystemMessage}
	<!-- System message -->
	{@const isBookmarked = bookmarkedMessageIds.has(message.id)}
	<div class="relative {highlightBgClass} -mx-4 px-4 transition-colors duration-300">
		<div class="flex justify-center my-2 group">
			<div class="bg-white/80 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 text-xs px-3 py-1 rounded-lg shadow-sm max-w-[80%] text-center transition-all {highlightClass} {shouldAnimate ? 'animate-search-highlight' : ''}">
				{#if searchQuery}
					{@html highlightText(message.content, searchQuery)}
				{:else}
					{message.content}
				{/if}
			</div>
			<!-- Bookmark button for system messages -->
			<div class="flex items-center ml-1 self-center">
				<button
					type="button"
					class="bookmark-btn p-1 rounded cursor-pointer hover:bg-black/10 dark:hover:bg-white/10"
					class:bookmarked={isBookmarked}
					onclick={handleBookmarkClick}
					title={isBookmarked ? 'Edit bookmark' : 'Add bookmark'}
				>
					{#if isBookmarked}
						<svg class="w-4 h-4 text-[var(--color-whatsapp-teal)]" fill="currentColor" viewBox="0 0 24 24">
							<path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
						</svg>
					{:else}
						<svg class="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
						</svg>
					{/if}
				</button>
			</div>
		</div>
	</div>
{:else}
	<!-- Regular message -->
	{@const isBookmarked = bookmarkedMessageIds.has(message.id)}
	<div bind:this={containerRef} class="relative {highlightBgClass} -mx-4 px-4 transition-colors duration-300">
		<div class="message-container flex {isOwn ? 'justify-end' : 'justify-start'} mb-1 group">
		<!-- Bookmark button (left side for own messages) -->
		{#if isOwn}
			<div class="flex items-center mr-1 self-center">
				<button
					type="button"
					class="bookmark-btn p-1 rounded cursor-pointer hover:bg-black/10 dark:hover:bg-white/10"
					class:bookmarked={isBookmarked}
					onclick={handleBookmarkClick}
					title={isBookmarked ? 'Edit bookmark' : 'Add bookmark'}
				>
					{#if isBookmarked}
						<svg class="w-4 h-4 text-[var(--color-whatsapp-teal)]" fill="currentColor" viewBox="0 0 24 24">
							<path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
						</svg>
					{:else}
						<svg class="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
						</svg>
					{/if}
				</button>
			</div>
		{/if}

		<div
			class="{bubbleWidthClass} rounded-lg px-3 py-2 shadow-sm transition-all {bubbleClass} {highlightClass} {shouldAnimate ? 'animate-search-highlight' : ''}"
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
							<div class="audio-message-container">
								<audio src={mediaUrl} controls class="w-full mb-1" preload="metadata">
									<track kind="captions" />
								</audio>
								
								<!-- Transcription UI -->
								{#if isTranscriptionSupported()}
									<div class="transcription-section mt-2 border-t border-gray-200 dark:border-gray-700 pt-2">
										{#if transcription && showTranscription}
											<!-- Show transcription -->
											<div class="transcription-result">
												<div class="flex items-center justify-between mb-1">
													<span class="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
														<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
														</svg>
														Transcription
														{#if transcriptionMatchesSearch}
															<span class="text-[var(--color-whatsapp-teal)] text-[10px]">(match)</span>
														{/if}
													</span>
													<button
														type="button"
														class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
														onclick={() => showTranscription = false}
													title={m.transcription_hide_title()}
													>
														<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
														</svg>
													</button>
												</div>
												<p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap italic">
													"{#if searchQuery}{@html highlightText(transcription, searchQuery)}{:else}{transcription}{/if}"
												</p>
											</div>
										{:else if transcriptionLoading}
											<!-- Loading state -->
											<div class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
												<div class="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-[var(--color-whatsapp-teal)]"></div>
												<span class="text-xs">
													{#if transcriptionState.isModelLoading}
													{m.transcription_loading_model({ progress: transcriptionState.modelLoadProgress })}
												{:else}
													{m.transcription_transcribing()}
													{/if}
												</span>
											</div>
										{:else if transcriptionError}
											<!-- Error state -->
											<div class="flex items-center justify-between">
												<span class="text-xs text-red-500 flex items-center gap-1">
													<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
													</svg>
													{transcriptionError}
												</span>
												<button
													type="button"
													class="text-xs text-[var(--color-whatsapp-teal)] hover:underline cursor-pointer"
													onclick={transcribeVoiceMessage}
												>
												{m.transcription_retry()}
												</button>
											</div>
										{:else if transcription}
											<!-- Has cached transcription but hidden -->
											<button
												type="button"
												class="flex items-center gap-1 text-xs text-[var(--color-whatsapp-teal)] hover:underline cursor-pointer"
												onclick={() => showTranscription = true}
											>
												<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
												</svg>
											{m.transcription_show()}
											</button>
										{:else}
											<!-- Transcribe button -->
											<button
												type="button"
												class="flex items-center gap-1 text-xs text-[var(--color-whatsapp-teal)] hover:underline cursor-pointer"
												onclick={transcribeVoiceMessage}
											title={m.transcription_transcribe_title()}
										>
											<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
											</svg>
											{m.transcription_transcribe()}
											</button>
										{/if}
									</div>
								{/if}
							</div>
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
							<span class="text-sm">{m.media_failed()}</span>
						</div>
					{:else}
						<!-- Click to load -->
						<button 
							class="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-[var(--color-whatsapp-teal)] transition-colors py-2 cursor-pointer"
							onclick={loadMedia}
						>
							{#if message.mediaType === 'image'}
								<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
								<span class="text-sm">{m.media_load_image()}</span>
							{:else if message.mediaType === 'video'}
								<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span class="text-sm">{m.media_load_video()}</span>
							{:else if message.mediaType === 'audio'}
								<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
								</svg>
								<span class="text-sm">{m.media_load_audio()}</span>
							{:else if message.mediaType === 'sticker'}
								<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span class="text-sm">{m.media_load_sticker()}</span>
							{:else}
								<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								<span class="text-sm">{m.media_load_file()}</span>
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
							<span class="text-sm italic">{m.media_photo()}</span>
						{:else if message.mediaType === 'video'}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
							</svg>
							<span class="text-sm italic">{m.media_video()}</span>
						{:else if message.mediaType === 'audio'}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
							</svg>
							<span class="text-sm italic">{m.media_audio()}</span>
						{:else if message.mediaType === 'document'}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							<span class="text-sm italic">{m.media_document()}</span>
						{:else if message.mediaType === 'sticker'}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span class="text-sm italic">{m.media_sticker()}</span>
						{:else if message.mediaType === 'contact'}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
							</svg>
							<span class="text-sm italic">{m.media_contact()}</span>
						{:else}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
							</svg>
							<span class="text-sm italic">{m.media_attachment()}</span>
						{/if}
					</div>
				{/if}
			{:else}
				<!-- Text content -->
				<p class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
					{#if searchQuery}
						{@html highlightText(message.content, searchQuery)}
					{:else}
						{message.content}
					{/if}
				</p>
			{/if}

			<!-- Timestamp -->
			<div
				class="text-[10px] text-gray-500 dark:text-gray-400 text-right mt-1 -mb-1"
			>
				{formatTime(message.timestamp)}
			</div>
		</div>

		<!-- Bookmark button (right side for other's messages) -->
		{#if !isOwn}
			<div class="flex items-center ml-1 self-center">
				<button
					type="button"
					class="bookmark-btn p-1 rounded cursor-pointer hover:bg-black/10 dark:hover:bg-white/10"
					class:bookmarked={isBookmarked}
					onclick={handleBookmarkClick}
					title={isBookmarked ? 'Edit bookmark' : 'Add bookmark'}
				>
					{#if isBookmarked}
						<svg class="w-4 h-4 text-[var(--color-whatsapp-teal)]" fill="currentColor" viewBox="0 0 24 24">
							<path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
						</svg>
					{:else}
						<svg class="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
						</svg>
					{/if}
				</button>
			</div>
		{/if}
		</div>
	</div>
{/if}

<!-- Bookmark edit modal -->
{#if showBookmarkModal}
	{@const currentBookmark = bookmarkedMessageIds.get(message.id)}
	<BookmarkModal
		bookmark={currentBookmark}
		newBookmarkData={currentBookmark ? undefined : {
			messageId: message.id,
			chatId,
			messageContent: message.content,
			sender: message.sender,
			messageTimestamp: message.timestamp
		}}
		onClose={() => showBookmarkModal = false}
	/>
{/if}

<style>
	.bookmark-btn {
		opacity: 0;
		transform: scale(0.8);
		transition: opacity 0.15s, transform 0.15s;
	}

	:global(.message-container:hover) .bookmark-btn,
	:global(.group:hover) .bookmark-btn,
	.bookmark-btn.bookmarked {
		opacity: 1;
		transform: scale(1);
	}
</style>

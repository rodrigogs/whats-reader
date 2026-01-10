<script lang="ts">
import type { Bookmark } from '$lib/bookmarks.svelte';
import { bookmarksState } from '$lib/bookmarks.svelte';
import {
	isMobileViewport,
	MOBILE_MEDIA_LOAD_DELAY,
} from '$lib/helpers/responsive';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
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
import Icon from './Icon.svelte';

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

// Auto-load media when highlighted on mobile (e.g., navigating from gallery)
$effect(() => {
	// Only auto-load on mobile devices when message is highlighted
	if (!isMobileViewport()) return;

	if (
		!isHighlighted ||
		!containerRef ||
		!message.mediaFile ||
		mediaUrl ||
		mediaLoading
	)
		return;

	// Small delay to ensure highlight animation is visible first
	const timeoutId = setTimeout(() => {
		loadMedia();
	}, MOBILE_MEDIA_LOAD_DELAY);

	return () => clearTimeout(timeoutId);
});

const bubbleClass = $derived(
	isOwn ? 'bg-[var(--color-message-out)]' : 'bg-[var(--color-message-in)]',
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
	if (!query.trim()) return linkifyText(text);

	// First, detect URLs and mark their positions
	const urlRegex = /(https?:\/\/[^\s]+)/g;
	const urls: { start: number; end: number; url: string }[] = [];
	let match;
	while ((match = urlRegex.exec(text)) !== null) {
		urls.push({
			start: match.index,
			end: match.index + match[0].length,
			url: match[0],
		});
	}

	// Search for query matches
	const searchRegex = new RegExp(escapeRegex(query), 'gi');
	const searchMatches: { start: number; end: number; text: string }[] = [];
	while ((match = searchRegex.exec(text)) !== null) {
		if (match[0].length === 0) {
			searchRegex.lastIndex++;
			continue;
		}
		searchMatches.push({
			start: match.index,
			end: match.index + match[0].length,
			text: match[0],
		});
	}

	// Build result by processing text in order
	let result = '';
	let lastIndex = 0;

	// Combine and sort all markers
	const markers: Array<
		| {
				type: 'url';
				pos: number;
				data: { start: number; end: number; url: string };
		  }
		| {
				type: 'search';
				pos: number;
				data: { start: number; end: number; text: string };
		  }
	> = [];

	urls.forEach((url) => {
		markers.push({ type: 'url', pos: url.start, data: url });
	});

	searchMatches.forEach((search) => {
		markers.push({ type: 'search', pos: search.start, data: search });
	});

	markers.sort((a, b) => a.pos - b.pos);

	markers.forEach((marker) => {
		if (marker.type === 'url') {
			// Add text before URL
			if (marker.data.start > lastIndex) {
				result += escapeHtml(text.slice(lastIndex, marker.data.start));
			}
			// Add URL as link
			const url = marker.data.url;
			result += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-[#00897B] dark:text-[#4FC3F7] underline break-all hover:text-[#00695C] dark:hover:text-[#29B6F6]">${escapeHtml(url)}</a>`;
			lastIndex = marker.data.end;
		} else if (marker.type === 'search') {
			// Skip if inside a URL
			const insideUrl = urls.some(
				(url) => marker.data.start >= url.start && marker.data.end <= url.end,
			);
			if (insideUrl) return;

			// Add text before match
			if (marker.data.start > lastIndex) {
				result += escapeHtml(text.slice(lastIndex, marker.data.start));
			}
			// Add highlighted match
			result += `<mark class="bg-yellow-300 dark:bg-yellow-600 rounded px-0.5">${escapeHtml(marker.data.text)}</mark>`;
			lastIndex = marker.data.end;
		}
	});

	// Add remaining text
	if (lastIndex < text.length) {
		result += escapeHtml(text.slice(lastIndex));
	}

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

// Convert URLs in text to clickable links
function linkifyText(text: string): string {
	const urlRegex = /(https?:\/\/[^\s]+)/g;
	let lastIndex = 0;
	let result = '';
	let match;

	while ((match = urlRegex.exec(text)) !== null) {
		// Add text before the URL, escaped
		result += escapeHtml(text.slice(lastIndex, match.index));
		// Add the URL as a clickable link, escaped
		const url = match[0];
		result += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-[#00897B] dark:text-[#4FC3F7] underline break-all hover:text-[#00695C] dark:hover:text-[#29B6F6]">${escapeHtml(url)}</a>`;
		lastIndex = match.index + url.length;
	}

	// Add the rest of the text, escaped
	result += escapeHtml(text.slice(lastIndex));
	return result;
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

{#snippet bookmarkButton(isBookmarked: boolean, className: string)}
	<button
		type="button"
		class="bookmark-btn p-1 rounded cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 {className}"
		class:bookmarked={isBookmarked}
		onclick={handleBookmarkClick}
		title={isBookmarked ? 'Edit bookmark' : 'Add bookmark'}
	>
		{#if isBookmarked}
		<Icon name="bookmark" size="sm" class="text-[var(--color-whatsapp-teal)]" filled />
		{:else}
		<Icon name="bookmark-outline" size="sm" class="text-gray-400 dark:text-gray-500" />
		{/if}
	</button>
{/snippet}

{#if message.isSystemMessage}
	<!-- System message -->
	{@const isBookmarked = bookmarkedMessageIds.has(message.id)}
	<div class="relative {highlightBgClass} -mx-4 px-4 transition-colors duration-300">
		<div class="flex justify-center my-2 group">
			<div class="bg-white/80 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 text-xs px-3 py-1 rounded-lg shadow-sm max-w-[80%] text-center transition-all {highlightClass} {shouldAnimate ? 'animate-search-highlight' : ''}">
				{#if searchQuery && isSearchMatch}
					{@html highlightText(message.content, searchQuery)}
				{:else}
					{message.content}
				{/if}
			</div>
			<!-- Bookmark button for system messages -->
			<div class="flex items-center ml-1 self-center">
				{@render bookmarkButton(isBookmarked, '')}
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
			{@render bookmarkButton(isBookmarked, 'mr-1 self-center')}
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
													<Icon name="document" size="xs" />
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
														<Icon name="close" size="sm" />
													</button>
												</div>
												<p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap italic">
													"{#if transcriptionMatchesSearch}{@html highlightText(transcription, searchQuery)}{:else}{transcription}{/if}"
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
													<Icon name="alert" size="xs" />
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
													<Icon name="document" size="xs" />
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
												<Icon name="microphone" size="xs" />
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
								<Icon name="download" size="md" />
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
							<Icon name="alert" size="md" />
							<span class="text-sm">{m.media_failed()}</span>
						</div>
					{:else}
						<!-- Click to load -->
						<button 
							class="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-[var(--color-whatsapp-teal)] transition-colors py-2 cursor-pointer"
							onclick={loadMedia}
						>
							{#if message.mediaType === 'image'}
								<Icon name="image" size="xl" />
								<span class="text-sm">{m.media_load_image()}</span>
							{:else if message.mediaType === 'video'}
								<Icon name="play" size="xl" />
								<span class="text-sm">{m.media_load_video()}</span>
							{:else if message.mediaType === 'audio'}
								<Icon name="audio" size="xl" />
								<span class="text-sm">{m.media_load_audio()}</span>
							{:else if message.mediaType === 'sticker'}
								<Icon name="image" size="xl" />
								<span class="text-sm">{m.media_load_sticker()}</span>
							{:else}
								<Icon name="document" size="xl" />
								<span class="text-sm">{m.media_load_file()}</span>
							{/if}
						</button>
					{/if}
				{:else}
					<!-- Media file not available (omitted or missing) -->
					<div class="flex items-center gap-2 text-gray-400 dark:text-gray-500 py-1">
						{#if message.mediaType === 'image'}
							<Icon name="image" size="md" />
							<span class="text-sm italic">{m.media_photo()}</span>
						{:else if message.mediaType === 'video'}
							<Icon name="video" size="md" />
							<span class="text-sm italic">{m.media_video()}</span>
						{:else if message.mediaType === 'audio'}
							<Icon name="audio" size="md" />
							<span class="text-sm italic">{m.media_audio()}</span>
						{:else if message.mediaType === 'document'}
							<Icon name="document" size="md" />
							<span class="text-sm italic">{m.media_document()}</span>
						{:else if message.mediaType === 'sticker'}
							<Icon name="image" size="md" />
							<span class="text-sm italic">{m.media_sticker()}</span>
						{:else if message.mediaType === 'contact'}
							<Icon name="user" size="md" />
							<span class="text-sm italic">{m.media_contact()}</span>
						{:else}
							<Icon name="file" size="md" />
							<span class="text-sm italic">{m.media_attachment()}</span>
						{/if}
					</div>
				{/if}
			{:else}
				<!-- Text content -->
				<p class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
					{#if searchQuery && isSearchMatch}
						{@html highlightText(message.content, searchQuery)}
					{:else}
						{@html linkifyText(message.content)}
					{/if}
				</p>
			{/if}

			<!-- Timestamp -->
			<div
				class="text-[10px] text-gray-500 dark:text-gray-400 text-right mt-1 -mb-1"
			>
				{formatTime(message.timestamp, getLocale())}
			</div>
		</div>

		<!-- Bookmark button (right side for other's messages) -->
		{#if !isOwn}
			{@render bookmarkButton(isBookmarked, 'ml-1 self-center')}
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

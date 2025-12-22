<script lang="ts">
import { untrack } from 'svelte';
import { type Bookmark, bookmarksState } from '$lib/bookmarks.svelte';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';

// Data needed to create a new bookmark
interface NewBookmarkData {
	messageId: string;
	chatId: string;
	messageContent: string;
	sender: string;
	messageTimestamp: Date;
}

interface Props {
	// Either an existing bookmark (edit mode) or data to create new (create mode)
	bookmark?: Bookmark;
	newBookmarkData?: NewBookmarkData;
	onClose: () => void;
	onSave?: () => void;
}

let { bookmark, newBookmarkData, onClose, onSave }: Props = $props();

// Determine if we're in create mode or edit mode
const isCreateMode = $derived(!bookmark && !!newBookmarkData);

// Initialize with current bookmark comment, using untrack to avoid warning
// The $effect below ensures this stays in sync if bookmark changes
let comment = $state(untrack(() => bookmark?.comment ?? ''));
let textarea: HTMLTextAreaElement;

// Sync comment when bookmark prop changes
$effect(() => {
	comment = bookmark?.comment ?? '';
});

function handleSave() {
	if (isCreateMode && newBookmarkData) {
		// Create mode: add the bookmark now
		bookmarksState.addBookmark({
			...newBookmarkData,
			comment,
		});
	} else if (bookmark) {
		// Edit mode: update the comment
		bookmarksState.updateBookmarkComment(bookmark.messageId, comment);
	}
	onSave?.();
	onClose();
}

function handleDelete() {
	if (bookmark) {
		bookmarksState.removeBookmark(bookmark.messageId);
	}
	onClose();
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape') {
		onClose();
	} else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
		handleSave();
	}
}

function handleBackdropClick(e: MouseEvent) {
	if (e.target === e.currentTarget) {
		onClose();
	}
}

// Focus textarea on mount
$effect(() => {
	if (textarea) {
		textarea.focus();
		textarea.setSelectionRange(comment.length, comment.length);
	}
});

// Format date for display
function formatDate(dateOrIsoString: Date | string): string {
	const date =
		typeof dateOrIsoString === 'string'
			? new Date(dateOrIsoString)
			: dateOrIsoString;
	return date.toLocaleDateString(getLocale(), {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

// Get display data from either bookmark or newBookmarkData
const displaySender = $derived(
	bookmark?.sender ?? newBookmarkData?.sender ?? '',
);
const displayTimestamp = $derived(
	bookmark?.messageTimestamp ?? newBookmarkData?.messageTimestamp ?? new Date(),
);
const displayPreview = $derived(
	bookmark?.messagePreview ?? newBookmarkData?.messageContent ?? '',
);
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
	onclick={handleBackdropClick}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
	role="presentation"
>
	<div
		class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<!-- Header -->
		<div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
			<div class="flex items-center justify-between">
				<h2 id="modal-title" class="text-lg font-semibold text-gray-900 dark:text-gray-100">
					{isCreateMode ? m.bookmarks_add_title() : m.bookmarks_edit_title()}
				</h2>
				<button
					type="button"
					class="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors cursor-pointer"
					onclick={onClose}
					aria-label={m.bookmarks_close_modal()}
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Content -->
		<div class="px-5 py-4 space-y-4">
			<!-- Message preview -->
			<div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
				<div class="flex items-center gap-2 mb-1">
					<span class="text-xs font-medium text-[var(--color-whatsapp-teal)]">{displaySender}</span>
					<span class="text-xs text-gray-400">•</span>
					<span class="text-xs text-gray-400">{formatDate(displayTimestamp)}</span>
				</div>
				<p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
					{displayPreview}
				</p>
			</div>

			<!-- Comment textarea -->
			<div>
				<label for="comment" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					{m.bookmarks_your_note()}
				</label>
				<textarea
					bind:this={textarea}
					bind:value={comment}
					id="comment"
					rows="4"
					class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-whatsapp-teal)] focus:border-transparent resize-none"
					placeholder={m.bookmarks_note_placeholder()}
				></textarea>
				<p class="mt-1 text-xs text-gray-400">
					{m.bookmarks_keyboard_hint()}
				</p>
			</div>
		</div>

		<!-- Footer -->
		<div class="px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex items-center justify-between">
			{#if !isCreateMode}
				<button
					type="button"
					class="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
					onclick={handleDelete}
				>
					Delete bookmark
				</button>
			{:else}
				<div></div>
			{/if}
			<div class="flex gap-2">
				<button
					type="button"
					class="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
					onclick={onClose}
				>
					Cancel
				</button>
				<button
					type="button"
					class="px-4 py-1.5 text-sm bg-[var(--color-whatsapp-teal)] hover:brightness-110 hover:shadow-md text-white rounded-lg transition-all cursor-pointer"
					onclick={handleSave}
				>
					Save
				</button>
			</div>
		</div>
	</div>
</div>

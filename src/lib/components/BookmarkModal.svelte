<script lang="ts">
	import { bookmarksState, type Bookmark } from '$lib/bookmarks.svelte';

	interface Props {
		bookmark: Bookmark;
		onClose: () => void;
		onSave?: () => void;
	}

	let { bookmark, onClose, onSave }: Props = $props();

	let comment = $state(bookmark.comment);
	let textarea: HTMLTextAreaElement;

	function handleSave() {
		bookmarksState.updateBookmark(bookmark.messageId, comment);
		onSave?.();
		onClose();
	}

	function handleDelete() {
		bookmarksState.removeBookmark(bookmark.messageId);
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
	function formatDate(isoString: string): string {
		const date = new Date(isoString);
		return date.toLocaleDateString(undefined, {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
	onclick={handleBackdropClick}
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
					Edit Bookmark
				</h2>
				<button
					type="button"
					class="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
					onclick={onClose}
					aria-label="Close"
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
					<span class="text-xs font-medium text-[var(--color-whatsapp-teal)]">{bookmark.sender}</span>
					<span class="text-xs text-gray-400">•</span>
					<span class="text-xs text-gray-400">{formatDate(bookmark.messageTimestamp)}</span>
				</div>
				<p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
					{bookmark.messagePreview}
				</p>
			</div>

			<!-- Comment textarea -->
			<div>
				<label for="comment" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Your note
				</label>
				<textarea
					bind:this={textarea}
					bind:value={comment}
					id="comment"
					rows="4"
					class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-whatsapp-teal)] focus:border-transparent resize-none"
					placeholder="Add a note to this bookmark..."
				></textarea>
				<p class="mt-1 text-xs text-gray-400">
					Press <kbd class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">⌘</kbd>+<kbd class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Enter</kbd> to save
				</p>
			</div>
		</div>

		<!-- Footer -->
		<div class="px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex items-center justify-between">
			<button
				type="button"
				class="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
				onclick={handleDelete}
			>
				Delete bookmark
			</button>
			<div class="flex gap-2">
				<button
					type="button"
					class="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
					onclick={onClose}
				>
					Cancel
				</button>
				<button
					type="button"
					class="px-4 py-1.5 text-sm bg-[var(--color-whatsapp-teal)] hover:bg-[var(--color-whatsapp-dark)] text-white rounded-lg transition-colors"
					onclick={handleSave}
				>
					Save
				</button>
			</div>
		</div>
	</div>
</div>

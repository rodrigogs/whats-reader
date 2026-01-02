<script lang="ts">
import { type Bookmark, bookmarksState } from '$lib/bookmarks.svelte';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import BookmarkModal from './BookmarkModal.svelte';
import Button from './Button.svelte';
import Icon from './Icon.svelte';
import IconButton from './IconButton.svelte';

interface Props {
	currentChatId?: string;
	onNavigateToMessage: (messageId: string, chatId: string) => void;
	onClose: () => void;
	indexedChatTitles?: Set<string>;
}

let {
	currentChatId,
	onNavigateToMessage,
	onClose,
	indexedChatTitles = new Set(),
}: Props = $props();

let filterMode = $state<'all' | 'current'>('all');
let editingBookmark = $state<Bookmark | null>(null);
let expandedBookmarkId = $state<string | null>(null);
let importInput: HTMLInputElement;
let importError = $state<string | null>(null);
let importSuccess = $state<string | null>(null);

// Filtered and sorted bookmarks - single derived, no function wrapper
const displayedBookmarks = $derived.by(() => {
	const all = bookmarksState.bookmarks;
	const filtered =
		filterMode === 'current' && currentChatId
			? all.filter((b) => b.chatId === currentChatId)
			: all;
	// Sort by creation date, newest first
	return filtered.toSorted(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);
});

// Group bookmarks by chat for display - computed from displayedBookmarks
const groupedBookmarks = $derived.by(() => {
	const groups = new Map<string, Bookmark[]>();
	for (const bookmark of displayedBookmarks) {
		const existing = groups.get(bookmark.chatId);
		if (existing) {
			existing.push(bookmark);
		} else {
			groups.set(bookmark.chatId, [bookmark]);
		}
	}
	return groups;
});

function formatDate(isoString: string): string {
	const date = new Date(isoString);
	return date.toLocaleDateString(getLocale(), {
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function handleBookmarkClick(bookmark: Bookmark) {
	// Toggle expand/collapse
	if (expandedBookmarkId === bookmark.id) {
		expandedBookmarkId = null;
	} else {
		expandedBookmarkId = bookmark.id;
	}
}

function handleNavigateClick(e: MouseEvent, bookmark: Bookmark) {
	e.stopPropagation();
	e.preventDefault();
	onNavigateToMessage(bookmark.messageId, bookmark.chatId);
}

function handleEditClick(e: MouseEvent, bookmark: Bookmark) {
	e.stopPropagation();
	e.preventDefault();
	editingBookmark = bookmark;
}

function handleDeleteClick(e: MouseEvent, bookmark: Bookmark) {
	e.stopPropagation();
	e.preventDefault();
	bookmarksState.removeBookmark(bookmark.messageId);
	expandedBookmarkId = null;
}

function handleExport() {
	bookmarksState.downloadExport();
}

async function handleImport(e: Event) {
	const input = e.target as HTMLInputElement;
	const file = input.files?.[0];

	if (!file) return;

	importError = null;
	importSuccess = null;

	try {
		const result = await bookmarksState.importFromFile(file);
		// Build success message
		const plural = result.imported !== 1 ? 's' : '';
		const baseMessage = m.bookmarks_imported_message({
			imported: result.imported,
			plural,
		});
		if (result.skipped > 0) {
			const skippedMessage = m.bookmarks_skipped_message({
				skipped: result.skipped,
			});
			importSuccess = `${baseMessage} ${skippedMessage}`;
		} else {
			importSuccess = baseMessage;
		}

		// Clear success message after 3 seconds
		setTimeout(() => {
			importSuccess = null;
		}, 3000);
	} catch (err) {
		importError =
			err instanceof Error ? err.message : m.bookmarks_import_error();
	}

	// Reset input
	input.value = '';
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape' && !editingBookmark) {
		onClose();
	}
}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex flex-col h-full bg-white dark:bg-gray-800">
	<!-- Header - matches Import Chat bar height (p-3 + h-10 inner) -->
	<div class="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
		<div class="flex items-center justify-between h-10">
			<div class="flex items-center gap-2">
			<Icon name="bookmark" filled class="text-[var(--color-whatsapp-teal)]" />
				<h2 class="font-semibold text-gray-900 dark:text-gray-100">{m.bookmarks_header_title()}</h2>
				<span class="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
					{displayedBookmarks.length}
				</span>
			</div>
			<IconButton
				theme="light"
				size="sm"
				onclick={onClose}
				aria-label={m.bookmarks_close()}
			>
				<Icon name="close" />
			</IconButton>
		</div>
	</div>

	<!-- Filter tabs -->
	{#if currentChatId}
		<div class="flex px-4 py-2 gap-1 border-b border-gray-200 dark:border-gray-700">
			<button
				type="button"
				class="px-3 py-1 text-sm rounded-lg transition-colors cursor-pointer"
				class:bg-[var(--color-whatsapp-teal)]={filterMode === 'all'}
				class:text-white={filterMode === 'all'}
				class:text-gray-600={filterMode !== 'all'}
				class:dark:text-gray-400={filterMode !== 'all'}
				class:hover:bg-gray-100={filterMode !== 'all'}
				class:dark:hover:bg-gray-700={filterMode !== 'all'}
				onclick={() => filterMode = 'all'}
			>
				{m.bookmarks_filter_all()}
			</button>
			<button
				type="button"
				class="px-3 py-1 text-sm rounded-lg transition-colors cursor-pointer"
				class:bg-[var(--color-whatsapp-teal)]={filterMode === 'current'}
				class:text-white={filterMode === 'current'}
				class:text-gray-600={filterMode !== 'current'}
				class:dark:text-gray-400={filterMode !== 'current'}
				class:hover:bg-gray-100={filterMode !== 'current'}
				class:dark:hover:bg-gray-700={filterMode !== 'current'}
				onclick={() => filterMode = 'current'}
			>
				{m.bookmarks_filter_current()}
			</button>
		</div>
	{/if}

	<!-- Bookmarks list -->
	<div class="flex-1 overflow-y-auto">
		{#if displayedBookmarks.length === 0}
			<div class="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
			<Icon name="bookmark-outline" size="2xl" class="text-gray-300 dark:text-gray-600 mb-3" />
				<p class="text-gray-500 dark:text-gray-400 text-sm">
					{filterMode === 'current' ? m.bookmarks_empty_current_chat() : m.bookmarks_empty()}
				</p>
				<p class="text-gray-400 dark:text-gray-500 text-xs mt-1">
					{m.bookmarks_empty_hint()}
				</p>
			</div>
		{:else}
			<div class="divide-y divide-gray-100 dark:divide-gray-700/50">
				{#each groupedBookmarks as [chatId, chatBookmarks]}
					<div class="py-2">
						<!-- Chat header -->
						<div class="px-4 py-1">
							<span class="text-xs font-medium text-gray-400 uppercase tracking-wider">
								{chatId}
							</span>
						</div>
						
						<!-- Bookmarks in this chat -->
						{#each chatBookmarks as bookmark (bookmark.id)}
							{@const isExpanded = expandedBookmarkId === bookmark.id}
							<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
							<div
								class="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group cursor-pointer {isExpanded ? 'bg-gray-50 dark:bg-gray-700/50' : ''}"
								onclick={() => handleBookmarkClick(bookmark)}
								role="button"
								tabindex="0"
							>
								<div class="flex items-start gap-3">
									<div class="flex-shrink-0 mt-0.5">
									<Icon name="bookmark" size="sm" class="text-[var(--color-whatsapp-teal)]" filled />
									</div>
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2 mb-0.5">
											<span class="text-xs font-medium text-[var(--color-whatsapp-teal)]">{bookmark.sender}</span>
											<span class="text-xs text-gray-400">{formatDate(bookmark.messageTimestamp)}</span>
										</div>
										<p class="text-sm text-gray-700 dark:text-gray-300" class:line-clamp-2={!isExpanded}>
											{bookmark.messagePreview}
										</p>
										{#if bookmark.comment}
											<p class="text-xs text-gray-500 dark:text-gray-400 mt-1 italic" class:line-clamp-1={!isExpanded}>
												📝 {bookmark.comment}
											</p>
										{/if}
										
										<!-- Expanded actions -->
										{#if isExpanded}
											{@const isIndexed = indexedChatTitles.has(bookmark.chatId)}
											<div class="flex items-center gap-2 mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
												<Button
													variant="primary"
													size="sm"
													onclick={(e) => handleNavigateClick(e, bookmark)}
													disabled={!isIndexed}
													title={isIndexed ? undefined : m.bookmarks_indexing()}
													class={!isIndexed ? 'opacity-50 cursor-not-allowed' : ''}
												>
													{#if !isIndexed}
												<Icon name="loading" size="xs" class="animate-spin" />
													{:else}
												<Icon name="arrow-circle-right" size="xs" />
													{/if}
													{isIndexed ? m.bookmarks_goto_button() : m.bookmarks_indexing()}
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onclick={(e) => handleEditClick(e, bookmark)}
												>
													<Icon name="edit" size="xs" />
													{m.bookmarks_edit_button()}
												</Button>
												<Button
													variant="danger"
													size="sm"
													onclick={(e) => handleDeleteClick(e, bookmark)}
												>
													<Icon name="trash" size="xs" />
													{m.bookmarks_delete_action()}
												</Button>
											</div>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Import/Export footer -->
	<div class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
		{#if importError}
			<div class="mb-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-lg">
				{importError}
			</div>
		{/if}
		{#if importSuccess}
			<div class="mb-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs rounded-lg">
				{importSuccess}
			</div>
		{/if}
		<div class="flex gap-2">
			<Button
				variant="secondary"
				size="sm"
				class="flex-1 justify-center"
				onclick={() => importInput.click()}
			>
				<Icon name="upload" size="sm" />
				{m.bookmarks_import_button()}
			</Button>
			<Button
				variant="secondary"
				size="sm"
				class="flex-1 justify-center {bookmarksState.count === 0 ? 'opacity-50 pointer-events-none' : ''}"
				onclick={handleExport}
				disabled={bookmarksState.count === 0}
			>
				<Icon name="download" size="sm" />
				{m.bookmarks_export_button()}
			</Button>
		</div>
		<input
			bind:this={importInput}
			type="file"
			accept=".json"
			class="hidden"
			onchange={handleImport}
		/>
	</div>
</div>

<!-- Edit modal -->
{#if editingBookmark}
	<BookmarkModal
		bookmark={editingBookmark}
		onClose={() => editingBookmark = null}
	/>
{/if}

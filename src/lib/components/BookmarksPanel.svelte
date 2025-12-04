<script lang="ts">
	import { bookmarksState, type Bookmark } from '$lib/bookmarks.svelte';
	import BookmarkModal from './BookmarkModal.svelte';

	interface Props {
		currentChatId?: string;
		onNavigateToMessage: (messageId: string, chatId: string) => void;
		onClose: () => void;
	}

	let { currentChatId, onNavigateToMessage, onClose }: Props = $props();

	let filterMode = $state<'all' | 'current'>('all');
	let editingBookmark = $state<Bookmark | null>(null);
	let importInput: HTMLInputElement;
	let importError = $state<string | null>(null);
	let importSuccess = $state<string | null>(null);

	// Filtered bookmarks based on mode
	const displayedBookmarks = $derived(() => {
		const all = bookmarksState.bookmarks;
		if (filterMode === 'current' && currentChatId) {
			return all.filter(b => b.chatId === currentChatId);
		}
		// Sort by creation date, newest first
		return [...all].sort((a, b) => 
			new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
	});

	// Group bookmarks by chat for display
	const groupedBookmarks = $derived(() => {
		const bookmarks = displayedBookmarks();
		const groups = new Map<string, Bookmark[]>();
		
		for (const bookmark of bookmarks) {
			const existing = groups.get(bookmark.chatId) || [];
			existing.push(bookmark);
			groups.set(bookmark.chatId, existing);
		}
		
		return groups;
	});

	function formatDate(isoString: string): string {
		const date = new Date(isoString);
		return date.toLocaleDateString(undefined, {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function handleBookmarkClick(bookmark: Bookmark) {
		onNavigateToMessage(bookmark.messageId, bookmark.chatId);
	}

	function handleEditClick(e: MouseEvent, bookmark: Bookmark) {
		e.stopPropagation();
		editingBookmark = bookmark;
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
			importSuccess = `Imported ${result.imported} bookmark${result.imported !== 1 ? 's' : ''}${result.skipped > 0 ? ` (${result.skipped} skipped as duplicates)` : ''}`;
			
			// Clear success message after 3 seconds
			setTimeout(() => {
				importSuccess = null;
			}, 3000);
		} catch (err) {
			importError = err instanceof Error ? err.message : 'Failed to import bookmarks';
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
	<!-- Header -->
	<div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
		<div class="flex items-center gap-2">
			<svg class="w-5 h-5 text-[var(--color-whatsapp-teal)]" fill="currentColor" viewBox="0 0 24 24">
				<path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
			</svg>
			<h2 class="font-semibold text-gray-900 dark:text-gray-100">Bookmarks</h2>
			<span class="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
				{displayedBookmarks().length}
			</span>
		</div>
		<button
			type="button"
			class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
			onclick={onClose}
			aria-label="Close bookmarks panel"
		>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>

	<!-- Filter tabs -->
	{#if currentChatId}
		<div class="flex px-4 py-2 gap-1 border-b border-gray-200 dark:border-gray-700">
			<button
				type="button"
				class="px-3 py-1 text-sm rounded-lg transition-colors"
				class:bg-[var(--color-whatsapp-teal)]={filterMode === 'all'}
				class:text-white={filterMode === 'all'}
				class:text-gray-600={filterMode !== 'all'}
				class:dark:text-gray-400={filterMode !== 'all'}
				class:hover:bg-gray-100={filterMode !== 'all'}
				class:dark:hover:bg-gray-700={filterMode !== 'all'}
				onclick={() => filterMode = 'all'}
			>
				All chats
			</button>
			<button
				type="button"
				class="px-3 py-1 text-sm rounded-lg transition-colors"
				class:bg-[var(--color-whatsapp-teal)]={filterMode === 'current'}
				class:text-white={filterMode === 'current'}
				class:text-gray-600={filterMode !== 'current'}
				class:dark:text-gray-400={filterMode !== 'current'}
				class:hover:bg-gray-100={filterMode !== 'current'}
				class:dark:hover:bg-gray-700={filterMode !== 'current'}
				onclick={() => filterMode = 'current'}
			>
				This chat
			</button>
		</div>
	{/if}

	<!-- Bookmarks list -->
	<div class="flex-1 overflow-y-auto">
		{#if displayedBookmarks().length === 0}
			<div class="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
				<svg class="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
				</svg>
				<p class="text-gray-500 dark:text-gray-400 text-sm">
					{filterMode === 'current' ? 'No bookmarks in this chat' : 'No bookmarks yet'}
				</p>
				<p class="text-gray-400 dark:text-gray-500 text-xs mt-1">
					Click the bookmark icon on any message to save it
				</p>
			</div>
		{:else}
			<div class="divide-y divide-gray-100 dark:divide-gray-700/50">
				{#each [...groupedBookmarks().entries()] as [chatId, chatBookmarks]}
					<div class="py-2">
						<!-- Chat header -->
						<div class="px-4 py-1">
							<span class="text-xs font-medium text-gray-400 uppercase tracking-wider">
								{chatId}
							</span>
						</div>
						
						<!-- Bookmarks in this chat -->
						{#each chatBookmarks as bookmark (bookmark.id)}
							<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
							<div
								class="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group cursor-pointer"
								onclick={() => handleBookmarkClick(bookmark)}
								role="button"
								tabindex="0"
							>
								<div class="flex items-start gap-3">
									<div class="flex-shrink-0 mt-0.5">
										<svg class="w-4 h-4 text-[var(--color-whatsapp-teal)]" fill="currentColor" viewBox="0 0 24 24">
											<path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
										</svg>
									</div>
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2 mb-0.5">
											<span class="text-xs font-medium text-[var(--color-whatsapp-teal)]">{bookmark.sender}</span>
											<span class="text-xs text-gray-400">{formatDate(bookmark.messageTimestamp)}</span>
										</div>
										<p class="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
											{bookmark.messagePreview}
										</p>
										{#if bookmark.comment}
											<p class="text-xs text-gray-500 dark:text-gray-400 mt-1 italic line-clamp-1">
												📝 {bookmark.comment}
											</p>
										{/if}
									</div>
									<button
										type="button"
										class="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
										onclick={(e) => handleEditClick(e, bookmark)}
										aria-label="Edit bookmark"
									>
										<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
										</svg>
									</button>
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
			<button
				type="button"
				class="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
				onclick={() => importInput.click()}
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
				</svg>
				Import
			</button>
			<button
				type="button"
				class="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
				class:opacity-50={bookmarksState.count === 0}
				class:pointer-events-none={bookmarksState.count === 0}
				onclick={handleExport}
				disabled={bookmarksState.count === 0}
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
				</svg>
				Export
			</button>
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

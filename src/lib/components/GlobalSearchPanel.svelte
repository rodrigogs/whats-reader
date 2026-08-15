<script lang="ts">
import { onDestroy } from 'svelte';
import { buildHighlightSnippet } from '$lib/global-search/documents';
import type { GlobalSearchState } from '$lib/global-search/global-search-state.svelte';
import type {
	GlobalSearchDateRange,
	GlobalSearchFilters,
	GlobalSearchResult,
} from '$lib/global-search/query-worker';
import * as m from '$lib/paraglide/messages';
import Icon from './Icon.svelte';
import IconButton from './IconButton.svelte';

interface Props {
	searchState: GlobalSearchState;
	/** Unique senders across loaded chats, for the sender filter. */
	senders: readonly string[];
	/** Invoked when a result resolves to a loaded archive and can be opened. */
	onNavigate: (result: GlobalSearchResult) => void;
	/** Invoked when a result's source file must be re-selected first. */
	onReselectSource: (archiveId: string) => void;
	onClose: () => void;
}

let { searchState, senders, onNavigate, onReselectSource, onClose }: Props =
	$props();

let inputValue = $state('');
let inputRef = $state<HTMLInputElement | null>(null);
let resultsRef = $state<HTMLElement | null>(null);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// Filter selections (applied immediately; see applyFilters).
let selectedArchiveIds = $state<string[]>([]);
let selectedSenders = $state<string[]>([]);
let dateFrom = $state('');
let dateTo = $state('');
let showFilters = $state(false);

// Confirmation state for destructive actions.
let confirmingRemoveArchiveId = $state<string | null>(null);
let confirmingDeleteAll = $state(false);
// §5: a failed remove-from-library readback must be visible, not swallowed.
let removalError = $state(false);

const statusAnnouncement = $derived.by(() => {
	switch (searchState.status) {
		case 'disabled':
			return m.global_search_status_disabled();
		case 'searching':
			return m.global_search_status_searching();
		case 'cancelled':
			return m.global_search_status_cancelled();
		case 'over-limit':
			return m.global_search_status_over_limit();
		case 'error':
			return m.global_search_status_error();
		case 'complete':
			return m.global_search_results_count({ total: searchState.totalMatches });
		default:
			return '';
	}
});

const isQueryEmpty = $derived(searchState.query.trim().length === 0);

const archiveOptions = $derived.by(() =>
	searchState.coverage.map((entry) => ({
		archiveId: entry.archiveId,
		chatTitle: entry.chatTitle,
		status: entry.status,
	})),
);

const senderOptions = $derived.by(() => [...senders].sort());

// Focus management: the rune state decides where focus should land after a
// search completes or is cancelled. This effect is the observable behaviour
// the spec §10 requires.
$effect(() => {
	const target = searchState.focusTarget;
	if (target === 'input') inputRef?.focus();
	else if (target === 'results') resultsRef?.focus();
});

function submit(raw: string): void {
	void searchState.submitQuery(raw);
}

function handleInput(e: Event): void {
	const input = e.target as HTMLInputElement;
	inputValue = input.value;
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => submit(inputValue), 300);
}

function handleKeyDown(e: KeyboardEvent): void {
	if (e.key === 'Enter') {
		e.preventDefault();
		if (debounceTimer) clearTimeout(debounceTimer);
		submit(inputValue);
	} else if (e.key === 'Escape') {
		e.preventDefault();
		onClose();
	}
}

function clearInput(): void {
	inputValue = '';
	if (debounceTimer) clearTimeout(debounceTimer);
	submit('');
}

function buildFilters(): GlobalSearchFilters {
	const filters: GlobalSearchFilters = {};
	if (selectedArchiveIds.length > 0) {
		filters.archiveIds = [...selectedArchiveIds];
	}
	if (selectedSenders.length > 0) {
		filters.senders = [...selectedSenders];
	}
	let range: GlobalSearchDateRange | undefined;
	if (dateFrom) range = { from: new Date(`${dateFrom}T00:00:00`).getTime() };
	if (dateTo) {
		range = {
			...range,
			to: new Date(`${dateTo}T23:59:59.999`).getTime(),
		};
	}
	if (range) filters.dateRanges = [range];
	return filters;
}

function applyFilters(): void {
	searchState.setFilters(buildFilters());
	if (!isQueryEmpty) submit(searchState.query);
}

function clearFilters(): void {
	selectedArchiveIds = [];
	selectedSenders = [];
	dateFrom = '';
	dateTo = '';
	applyFilters();
}

function toggleArchive(archiveId: string): void {
	selectedArchiveIds = selectedArchiveIds.includes(archiveId)
		? selectedArchiveIds.filter((id) => id !== archiveId)
		: [...selectedArchiveIds, archiveId];
	applyFilters();
}

function toggleSender(sender: string): void {
	selectedSenders = selectedSenders.includes(sender)
		? selectedSenders.filter((s) => s !== sender)
		: [...selectedSenders, sender];
	applyFilters();
}

function handleOpenResult(result: GlobalSearchResult): void {
	const outcome = searchState.openResult(result);
	if (outcome.kind === 'navigate') {
		onNavigate(result);
	} else if (outcome.kind === 'requires-source') {
		onReselectSource(outcome.archiveId);
	}
	// 'unavailable' needs no action: the panel already reflects the searchState.
}

function consentChoice(
	archiveId: string,
	choice: 'keep-locally' | 'session-only',
): void {
	void searchState.setConsentChoice(archiveId, choice);
}

async function removeFromLibrary(archiveId: string): Promise<void> {
	confirmingRemoveArchiveId = null;
	// §5: await the cascade and never discard a `complete:false` readback —
	// a survivor is a real failure and must be surfaced visibly.
	const report = await searchState.removeFromLibrary(archiveId);
	removalError = !report.complete;
}

function deleteAllIndices(): void {
	void searchState.deleteAllLocalIndices();
	confirmingDeleteAll = false;
}

function fmtTimestamp(timestamp: number | null): string {
	if (timestamp === null) return '';
	return new Date(timestamp).toLocaleString();
}

onDestroy(() => {
	if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<div
	class="global-search-panel w-96 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col"
>
	<!-- Header -->
	<div class="h-16 px-4 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
		<Icon name="search" class="text-gray-400" />
		<h2 class="font-semibold text-gray-800 dark:text-white flex-1 truncate">
			{m.global_search_title()}
		</h2>
		<IconButton
			theme="light"
			size="md"
			onclick={onClose}
			title={m.global_search_close()}
			aria-label={m.global_search_close()}
		>
			<Icon name="close" />
		</IconButton>
	</div>

	<!-- Search input -->
	<div class="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
		<div class="relative">
			<div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
				<Icon name="search" class="text-gray-400" />
			</div>
			<input
				bind:this={inputRef}
				type="text"
				value={inputValue}
				placeholder={m.global_search_placeholder()}
				aria-label={m.global_search_placeholder()}
				class="w-full pl-10 pr-10 py-2 bg-gray-100 dark:bg-gray-800 border-0 rounded-lg text-gray-800 dark:text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-[var(--color-whatsapp-teal)] focus:outline-none transition-all"
				oninput={handleInput}
				onkeydown={handleKeyDown}
			/>
			{#if inputValue}
				<button
					class="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors"
					onclick={clearInput}
					aria-label={m.search_clear()}
				>
					<Icon name="close" />
				</button>
			{/if}
		</div>

		<!-- Filters toggle + clear -->
		<div class="mt-2 flex items-center gap-2">
			<button
				type="button"
				class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer flex items-center gap-1"
				onclick={() => (showFilters = !showFilters)}
			>
				<Icon name="tag" size="xs" />
				{m.global_search_filters_title()}
			</button>
			{#if selectedArchiveIds.length > 0 || selectedSenders.length > 0 || dateFrom || dateTo}
				<button
					type="button"
					class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
					onclick={clearFilters}
				>
					{m.global_search_filter_clear()}
				</button>
			{/if}
		</div>

		{#if showFilters}
			<div class="mt-2 space-y-3 text-sm">
				<!-- Archive filter (OR within the group) -->
				{#if archiveOptions.length > 0}
					<fieldset>
						<legend class="text-xs text-gray-500 dark:text-gray-400 mb-1">
							{m.global_search_filter_archives()}
						</legend>
						<div class="max-h-32 overflow-y-auto space-y-1">
							{#each archiveOptions as option (option.archiveId)}
								<label class="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-200">
									<input
										type="checkbox"
										checked={selectedArchiveIds.includes(option.archiveId)}
										onchange={() => toggleArchive(option.archiveId)}
									/>
									<span class="truncate">{option.chatTitle || option.archiveId}</span>
								</label>
							{/each}
						</div>
					</fieldset>
				{/if}

				<!-- Sender filter (OR within the group) -->
				{#if senderOptions.length > 0}
					<fieldset>
						<legend class="text-xs text-gray-500 dark:text-gray-400 mb-1">
							{m.global_search_filter_senders()}
						</legend>
						<div class="max-h-32 overflow-y-auto space-y-1">
							{#each senderOptions as sender (sender)}
								<label class="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-200">
									<input
										type="checkbox"
										checked={selectedSenders.includes(sender)}
										onchange={() => toggleSender(sender)}
									/>
									<span class="truncate">{sender}</span>
								</label>
							{/each}
						</div>
					</fieldset>
				{/if}

				<!-- Date period -->
				<div class="flex items-end gap-2">
					<label class="flex flex-col text-xs text-gray-500 dark:text-gray-400 gap-1">
						{m.global_search_filter_date_from()}
						<input
							type="date"
							bind:value={dateFrom}
							onchange={applyFilters}
							class="bg-gray-100 dark:bg-gray-800 border-0 rounded px-2 py-1 text-gray-800 dark:text-gray-200"
						/>
					</label>
					<label class="flex flex-col text-xs text-gray-500 dark:text-gray-400 gap-1">
						{m.global_search_filter_date_to()}
						<input
							type="date"
							bind:value={dateTo}
							onchange={applyFilters}
							class="bg-gray-100 dark:bg-gray-800 border-0 rounded px-2 py-1 text-gray-800 dark:text-gray-200"
						/>
					</label>
				</div>
			</div>
		{/if}
	</div>

	<!-- Live status (aria-live) -->
	<div role="status" aria-live="polite" class="sr-only">
		{statusAnnouncement}
	</div>

	<!-- Body: coverage (empty query) or results -->
	<div class="flex-1 overflow-y-auto">
		{#if !searchState.enabled}
			<div class="p-4 text-sm text-gray-500 dark:text-gray-400">
				{m.global_search_status_disabled()}
			</div>
		{:else if isQueryEmpty}
			<!-- Coverage view -->
			<div class="p-4">
				<p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
					{m.global_search_empty_prompt()}
				</p>
				<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
					{m.global_search_coverage_title()}
				</h3>
				{#if archiveOptions.length === 0}
					<p class="text-sm text-gray-500 dark:text-gray-400 italic">
						{m.chats_no_loaded()}
					</p>
				{:else}
					<ul class="space-y-2">
						{#each archiveOptions as entry (entry.archiveId)}
							<li
								class="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
							>
								<div class="flex items-center gap-2">
									<span class="font-medium text-gray-800 dark:text-white truncate flex-1">
										{entry.chatTitle || entry.archiveId}
									</span>
									<span class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
										{#if entry.status === 'ready'}
											{m.global_search_coverage_ready()}
										{:else if entry.status === 'indexing'}
											{m.global_search_coverage_indexing()}
										{:else if entry.status === 'session-only'}
											{m.global_search_coverage_session_only()}
										{:else if entry.status === 'requires-file'}
											{m.global_search_coverage_requires_file()}
										{:else if entry.status === 'stale'}
											{m.global_search_coverage_stale()}
										{:else if entry.status === 'failed'}
											{m.global_search_coverage_failed()}
										{/if}
									</span>
								</div>

								<div class="mt-2 flex items-center gap-2">
									<button
										type="button"
										class="text-xs px-2 py-1 rounded cursor-pointer transition-colors {searchState.isKeepingLocally(entry.archiveId)
											? 'bg-[var(--color-whatsapp-teal)] text-white'
											: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}"
										onclick={() => consentChoice(entry.archiveId, 'keep-locally')}
									>
										{m.global_search_consent_keep_locally()}
									</button>
									<button
										type="button"
										class="text-xs px-2 py-1 rounded cursor-pointer transition-colors {!searchState.isKeepingLocally(entry.archiveId)
											? 'bg-[var(--color-whatsapp-teal)] text-white'
											: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}"
										onclick={() => consentChoice(entry.archiveId, 'session-only')}
									>
										{m.global_search_consent_session_only()}
									</button>

									<IconButton
										theme="subtle"
										size="sm"
										dangerHover
										onclick={() => (confirmingRemoveArchiveId = entry.archiveId)}
										title={m.global_search_remove_from_library()}
										aria-label={m.global_search_remove_from_library()}
									>
										<Icon name="trash" size="sm" />
									</IconButton>
								</div>
							</li>
						{/each}
					</ul>
				{/if}

				<!-- Consent copy (shown once) -->
				<p class="text-xs text-gray-500 dark:text-gray-400 mt-4">
					{m.global_search_consent_copy()}
				</p>
			</div>
		{:else}
			<!-- Results view -->
			<div class="p-3">
				{#if searchState.status === 'searching'}
					<div class="flex items-center justify-between gap-2 text-sm text-gray-500 dark:text-gray-400 py-2">
						<div class="flex items-center gap-2">
							<Icon name="loading" size="sm" class="animate-spin-slow" />
							{m.global_search_status_searching()}
						</div>
						<button
							type="button"
							class="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer flex-shrink-0"
							onclick={() => searchState.cancel()}
							title={m.global_search_cancel_search()}
							aria-label={m.global_search_cancel_search()}
						>
							{m.global_search_cancel_search()}
						</button>
					</div>
					{#if searchState.progress && searchState.progress.scannedDocuments > 0}
						<p class="text-xs text-gray-500 dark:text-gray-400 py-1">
							{m.global_search_progress({
								count: searchState.progress.scannedDocuments,
							})}
						</p>
					{/if}
				{:else if searchState.status === 'over-limit'}
					<p class="text-sm text-gray-500 dark:text-gray-400 py-4">
						{m.global_search_status_over_limit()}
					</p>
				{:else if searchState.status === 'error'}
					<p class="text-sm text-red-500 py-4">
						{m.global_search_status_error()}
					</p>
				{:else if searchState.results.length === 0}
					<p class="text-sm text-gray-500 dark:text-gray-400 py-4">
						{m.global_search_no_results()}
					</p>
				{:else}
					<div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
						<span>
							{m.global_search_results_count({ total: searchState.totalMatches })}
						</span>
						{#if searchState.truncated}
							<span>
								{m.global_search_results_truncated({
									cap: searchState.results.length,
									total: searchState.totalMatches,
								})}
							</span>
						{/if}
					</div>

					<!-- Source-missing notice -->
					{#if searchState.sourceMissingArchiveId}
						<div
							class="mb-2 p-2 bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded text-sm text-amber-800 dark:text-amber-200"
						>
							<p>{m.global_search_source_missing()}</p>
							<button
								type="button"
								class="mt-1 text-xs underline cursor-pointer"
								onclick={() => onReselectSource(searchState.sourceMissingArchiveId!)}
							>
								{m.global_search_source_reselect()}
							</button>
						</div>
					{/if}

					<ul tabindex="-1" bind:this={resultsRef} class="space-y-2">
						{#each searchState.pagedResults as result (result.archiveId + ':' + result.ordinal + ':' + result.messageId)}
							{@const snippet = buildHighlightSnippet(result.content, searchState.query)}
							<li>
								<button
									type="button"
									class="w-full text-left border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
									onclick={() => handleOpenResult(result)}
								>
									<div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
										<span class="font-medium text-gray-700 dark:text-gray-300 truncate flex-1">
											{result.chatTitle || result.archiveId}
										</span>
										{#if result.timestamp !== null}
											<span class="flex-shrink-0">{fmtTimestamp(result.timestamp)}</span>
										{/if}
									</div>
									<div class="text-xs text-[var(--color-whatsapp-teal)] font-medium mt-0.5">
										{result.sender}
									</div>
									<p class="text-sm text-gray-700 dark:text-gray-200 mt-1 break-words">
										{#if snippet.ellipsisStart}…{/if}
										{#each snippet.ranges as range, i (i)}
											{#if i === 0 && range.start > 0}
												{snippet.text.slice(0, range.start)}
											{/if}
											{#if i > 0}
												{snippet.text.slice(
													snippet.ranges[i - 1].end,
													range.start,
												)}
											{/if}
											<mark class="bg-yellow-200 dark:bg-yellow-700/60 rounded-sm">
												{snippet.text.slice(range.start, range.end)}
											</mark>
										{/each}
										{#if snippet.ranges.length > 0}
											{snippet.text.slice(
												snippet.ranges[snippet.ranges.length - 1].end,
											)}
										{/if}
										{#if snippet.ranges.length === 0}
											{snippet.text}
										{/if}
										{#if snippet.ellipsisEnd}…{/if}
									</p>
								</button>
							</li>
						{/each}
					</ul>

					<!-- Paging -->
					{#if searchState.totalPages > 1}
						<div class="mt-3 flex items-center justify-between">
							<IconButton
								theme="subtle"
								size="sm"
								onclick={() => searchState.prevPage()}
								disabled={!searchState.canGoPrev}
								title={m.global_search_prev_page()}
								aria-label={m.global_search_prev_page()}
							>
								<Icon name="chevron-up" size="sm" />
							</IconButton>
							<span class="text-xs text-gray-500 dark:text-gray-400">
								{m.global_search_page_info({
									page: searchState.page + 1,
									pages: searchState.totalPages,
								})}
							</span>
							<IconButton
								theme="subtle"
								size="sm"
								onclick={() => searchState.nextPage()}
								disabled={!searchState.canGoNext}
								title={m.global_search_next_page()}
								aria-label={m.global_search_next_page()}
							>
								<Icon name="chevron-down" size="sm" />
							</IconButton>
						</div>
					{/if}
				{/if}
			</div>
		{/if}
	</div>

	<!-- Footer: destructive actions -->
	<div class="p-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
		<button
			type="button"
			class="w-full text-xs text-red-500 hover:text-red-600 dark:text-red-400 cursor-pointer flex items-center justify-center gap-1 py-1"
			onclick={() => (confirmingDeleteAll = true)}
		>
			<Icon name="trash" size="xs" />
			{m.global_search_delete_all_title()}
		</button>
		{#if searchState.deleteAllAcknowledged}
			<p role="status" class="text-xs text-green-600 dark:text-green-400 text-center mt-1">
				{m.global_search_delete_all_acknowledged()}
			</p>
		{/if}
		{#if removalError}
			<p role="alert" class="text-xs text-red-600 dark:text-red-400 text-center mt-1">
				{m.persistence_remove_failed()}
			</p>
		{/if}
	</div>
</div>

<!-- Confirmation overlays -->
{#if confirmingRemoveArchiveId !== null}
	<div
		class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center"
		role="dialog"
		aria-modal="true"
		aria-label={m.global_search_remove_from_library()}
	>
		<div class="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-sm w-full mx-4">
			<p class="text-sm text-gray-800 dark:text-gray-200 mb-4">
				{m.remove_from_library_confirm_body()}
			</p>
			<div class="flex justify-end gap-2">
				<button
					type="button"
					class="px-3 py-1.5 text-sm rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
					onclick={() => (confirmingRemoveArchiveId = null)}
				>
					{m.global_search_cancel()}
				</button>
				<button
					type="button"
					class="px-3 py-1.5 text-sm rounded bg-red-500 text-white hover:bg-red-600 cursor-pointer"
					onclick={() => removeFromLibrary(confirmingRemoveArchiveId!)}
				>
					{m.global_search_confirm()}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if confirmingDeleteAll}
	<div
		class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center"
		role="dialog"
		aria-modal="true"
		aria-label={m.global_search_delete_all_confirm()}
	>
		<div class="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-sm w-full mx-4">
			<p class="text-sm text-gray-800 dark:text-gray-200 mb-4">
				{m.global_search_delete_all_confirm()}
			</p>
			<div class="flex justify-end gap-2">
				<button
					type="button"
					class="px-3 py-1.5 text-sm rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
					onclick={() => (confirmingDeleteAll = false)}
				>
					{m.global_search_cancel()}
				</button>
				<button
					type="button"
					class="px-3 py-1.5 text-sm rounded bg-red-500 text-white hover:bg-red-600 cursor-pointer"
					onclick={deleteAllIndices}
				>
					{m.global_search_confirm()}
				</button>
			</div>
		</div>
	</div>
{/if}

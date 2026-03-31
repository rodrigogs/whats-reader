<script lang="ts">
import { tick } from 'svelte';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import type { PersistedChatMetadata } from '$lib/persistence.svelte';
import { setDontShowRestoreModal } from '$lib/persistence.svelte';
import Icon from './Icon.svelte';
import Modal from './Modal.svelte';
import ModalContent from './ModalContent.svelte';
import ModalHeader from './ModalHeader.svelte';

interface Props {
	persistedChats: PersistedChatMetadata[];
	onRestore: (chatIds: string[]) => void;
	onStartFresh: () => void;
	onClose: () => void;
}

let { persistedChats, onRestore, onStartFresh, onClose }: Props = $props();

let selectedChatIds = $state<Set<string>>(new Set());
let dontShowAgain = $state(false);

function toggleChat(chatId: string) {
	const newSet = new Set(selectedChatIds);
	if (newSet.has(chatId)) {
		newSet.delete(chatId);
	} else {
		newSet.add(chatId);
	}
	selectedChatIds = newSet;
}

function selectAll() {
	selectedChatIds = new Set(persistedChats.map((c) => c.id));
}

function deselectAll() {
	selectedChatIds = new Set();
}

async function handleRestore() {
	if (selectedChatIds.size === 0) return;

	if (dontShowAgain) {
		await setDontShowRestoreModal(true);
	}

	onRestore(Array.from(selectedChatIds));
}

async function handleStartFresh() {
	if (dontShowAgain) {
		await setDontShowRestoreModal(true);
	}

	onStartFresh();
}

function formatDate(dateStr: string): string {
	const locale = getLocale();
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) {
		return m.time_today();
	} else if (diffDays === 1) {
		return m.time_yesterday();
	} else if (diffDays < 7) {
		return date.toLocaleDateString(locale, { weekday: 'long' });
	} else {
		return date.toLocaleDateString(locale, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}
}

function getInitials(title: string): string {
	const words = title.trim().split(/\s+/);
	if (words.length === 1) {
		return words[0].substring(0, 2).toUpperCase();
	}
	return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
</script>

<Modal open={true} onClose={onClose}>
	<ModalHeader title={m.persistence_restore_title()} onClose={onClose} />
	<ModalContent>
		<div class="flex flex-col gap-5 sm:gap-6">
			<!-- Description with icon -->
			<div class="flex gap-2 sm:gap-3 items-start p-3 sm:p-4 bg-[var(--color-whatsapp-light-green)] dark:bg-[var(--color-whatsapp-dark-green)]/20 rounded-lg sm:rounded-xl border border-[var(--color-whatsapp-teal)]/20">
				<div class="flex-shrink-0 mt-0.5">
					<Icon name="clock" size="md" class="text-[var(--color-whatsapp-teal)]" />
				</div>
				<p class="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
					{m.persistence_restore_description()}
				</p>
			</div>

			<!-- Select all / Deselect all - Improved buttons -->
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-whatsapp-teal)] hover:bg-[var(--color-whatsapp-teal)]/10 rounded-lg transition-colors"
					onclick={selectAll}
				>
					<Icon name="check-all" size="xs" />
					<span>Select All</span>
				</button>
				<button
					type="button"
					class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
					onclick={deselectAll}
				>
					<Icon name="x" size="xs" />
					<span>Deselect All</span>
				</button>
			</div>

			<!-- Chat list with improved cards -->
			<div class="flex flex-col gap-2 sm:gap-3 max-h-[40vh] sm:max-h-96 overflow-y-auto pr-1 scrollbar-thin">
				{#each persistedChats as chat (chat.id)}
					<button
						type="button"
						class="group flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all text-left
							{selectedChatIds.has(chat.id)
								? 'border-[var(--color-whatsapp-teal)] bg-[var(--color-whatsapp-light-green)] dark:bg-[var(--color-whatsapp-dark-green)]/20 shadow-md'
								: 'border-neutral-200 dark:border-neutral-700 hover:border-[var(--color-whatsapp-teal)]/40 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'}"
						onclick={() => toggleChat(chat.id)}
					>
						<!-- Avatar with initials -->
						<div class="flex-shrink-0">
							<div
								class="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-semibold text-white text-sm sm:text-base shadow-sm
									{selectedChatIds.has(chat.id)
										? 'bg-[var(--color-whatsapp-teal)]'
										: 'bg-[var(--color-whatsapp-dark-green)]'}"
							>
								{getInitials(chat.chatTitle)}
							</div>
						</div>

						<!-- Chat info -->
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2 mb-1">
								<h3 class="font-semibold text-sm sm:text-base text-neutral-900 dark:text-neutral-100 truncate">
									{chat.chatTitle}
								</h3>
								{#if selectedChatIds.has(chat.id)}
									<div class="flex-shrink-0 hidden sm:block">
										<Icon name="check-circle" size="sm" class="text-[var(--color-whatsapp-teal)]" />
									</div>
								{/if}
							</div>
							<div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs text-neutral-600 dark:text-neutral-400 mb-1">
								<div class="flex items-center gap-1">
									<Icon name="message-circle" size="xs" />
									<span>{m.persistence_message_count({ count: chat.messageCount })}</span>
								</div>
								<span class="text-neutral-400 hidden sm:inline">•</span>
								<div class="flex items-center gap-1">
									<Icon name="clock" size="xs" />
									<span>{m.persistence_last_opened({ date: formatDate(chat.updatedAt) })}</span>
								</div>
							</div>
							<div class="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-500">
								<Icon name="file" size="xs" />
								<span class="truncate">{chat.fileName}</span>
							</div>
						</div>

						<!-- Custom checkbox indicator (right side) -->
						<div class="flex-shrink-0">
							<div
								class="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center transition-all
									{selectedChatIds.has(chat.id)
										? 'border-[var(--color-whatsapp-teal)] bg-[var(--color-whatsapp-teal)] scale-110'
										: 'border-neutral-300 dark:border-neutral-600 group-hover:border-[var(--color-whatsapp-teal)]'}"
							>
								{#if selectedChatIds.has(chat.id)}
									<Icon name="check" size="xs" class="text-white" />
								{/if}
							</div>
						</div>
					</button>
				{/each}
			</div>

			<!-- Don't show again checkbox with better styling -->
			<label class="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors">
				<input
					type="checkbox"
					bind:checked={dontShowAgain}
					class="w-4 h-4 rounded border-neutral-300 dark:border-neutral-600 text-[var(--color-whatsapp-teal)] focus:ring-[var(--color-whatsapp-teal)] focus:ring-offset-0"
				/>
				<span class="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 select-none">
					{m.persistence_dont_show_again()}
				</span>
			</label>

			<!-- Actions with improved buttons -->
			<div class="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
				<button
					type="button"
					class="flex-1 px-4 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
					onclick={handleStartFresh}
				>
					{m.persistence_start_fresh()}
				</button>
				<button
					type="button"
					class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[var(--color-whatsapp-teal)] hover:bg-[var(--color-whatsapp-dark-green)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm disabled:shadow-none"
					onclick={handleRestore}
					disabled={selectedChatIds.size === 0}
				>
					<Icon name="download" size="sm" />
					<span>{m.persistence_restore_button({ count: selectedChatIds.size })}</span>
				</button>
			</div>
		</div>
	</ModalContent>
</Modal>

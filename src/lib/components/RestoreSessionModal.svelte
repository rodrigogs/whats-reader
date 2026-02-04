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
</script>

<Modal open={true} onClose={onClose}>
	<ModalHeader title={m.persistence_restore_title()} onClose={onClose} />
	<ModalContent>
		<div class="flex flex-col gap-4">
			<!-- Description -->
			<p class="text-sm text-neutral-600 dark:text-neutral-400">
				{m.persistence_restore_description()}
			</p>

			<!-- Select all / Deselect all -->
			<div class="flex gap-2 text-sm">
				<button
					type="button"
					class="text-primary-600 dark:text-primary-400 hover:underline"
					onclick={selectAll}
				>
					Select All
				</button>
				<span class="text-neutral-400">•</span>
				<button
					type="button"
					class="text-primary-600 dark:text-primary-400 hover:underline"
					onclick={deselectAll}
				>
					Deselect All
				</button>
			</div>

			<!-- Chat list -->
			<div class="flex flex-col gap-2 max-h-96 overflow-y-auto">
				{#each persistedChats as chat (chat.id)}
					<button
						type="button"
						class="flex items-start gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left"
						onclick={() => toggleChat(chat.id)}
					>
						<!-- Checkbox -->
						<div class="flex-shrink-0 mt-1">
							<div
								class="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors {selectedChatIds.has(
									chat.id,
								)
									? 'bg-primary-600 border-primary-600'
									: 'border-neutral-300 dark:border-neutral-600'}"
							>
								{#if selectedChatIds.has(chat.id)}
									<Icon name="check" size="xs" class="text-white" />
								{/if}
							</div>
						</div>

						<!-- Chat info -->
						<div class="flex-1 min-w-0">
							<div class="font-medium text-neutral-900 dark:text-neutral-100 truncate">
								{chat.chatTitle}
							</div>
							<div class="text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2 mt-1">
								<span>{m.persistence_message_count({ count: chat.messageCount })}</span>
								<span class="text-neutral-400">•</span>
								<span>{m.persistence_last_opened({ date: formatDate(chat.updatedAt) })}</span>
							</div>
							<div class="text-xs text-neutral-500 dark:text-neutral-500 mt-1 truncate">
								{chat.fileName}
							</div>
						</div>
					</button>
				{/each}
			</div>

			<!-- Don't show again checkbox -->
			<label class="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 cursor-pointer">
				<input
					type="checkbox"
					bind:checked={dontShowAgain}
					class="w-4 h-4 rounded border-neutral-300 dark:border-neutral-600"
				/>
				{m.persistence_dont_show_again()}
			</label>

			<!-- Actions -->
			<div class="flex gap-3 justify-end pt-2">
				<button
					type="button"
					class="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
					onclick={handleStartFresh}
				>
					{m.persistence_start_fresh()}
				</button>
				<button
					type="button"
					class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					onclick={handleRestore}
					disabled={selectedChatIds.size === 0}
				>
					{m.persistence_restore_button({ count: selectedChatIds.size })}
				</button>
			</div>
		</div>
	</ModalContent>
</Modal>

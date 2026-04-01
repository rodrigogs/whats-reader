<script lang="ts">
import { formatRelativeDate } from '$lib/helpers/format';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import type { PersistedChatMetadata } from '$lib/persistence.svelte';
import { setDontShowRestoreModal } from '$lib/persistence.svelte';
import Button from './Button.svelte';
import ChatAvatar from './ChatAvatar.svelte';
import Icon from './Icon.svelte';
import Modal from './Modal.svelte';
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
</script>

<Modal open={true} onClose={onClose}>
	<ModalHeader title={m.persistence_restore_title()} onClose={onClose} />

	<!-- Custom layout: only chat list scrolls, footer stays fixed -->
	<div class="flex flex-col flex-1 overflow-hidden">
		<!-- Select all / Deselect all -->
		<div class="flex flex-wrap gap-2 px-4 sm:px-6 pt-3 sm:pt-4 flex-shrink-0">
			<button
				type="button"
				class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-whatsapp-teal)] hover:bg-[var(--color-whatsapp-teal)]/10 rounded-lg transition-colors"
				onclick={selectAll}
			>
				<Icon name="check-all" size="xs" />
				<span>{m.persistence_select_all()}</span>
			</button>
			<button
				type="button"
				class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
				onclick={deselectAll}
			>
				<Icon name="x" size="xs" />
				<span>{m.persistence_deselect_all()}</span>
			</button>
		</div>

		<!-- Scrollable chat list -->
		<div class="flex-1 overflow-y-auto px-4 sm:px-6 py-3 flex flex-col gap-2 sm:gap-3">
			{#each persistedChats as chat (chat.id)}
				<button
					type="button"
					class="group flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all text-left
						{selectedChatIds.has(chat.id)
							? 'border-[var(--color-whatsapp-teal)] bg-[var(--color-whatsapp-light-green)] dark:bg-[var(--color-whatsapp-dark-green)]/20 shadow-md'
							: 'border-gray-200 dark:border-gray-700 hover:border-[var(--color-whatsapp-teal)]/40 hover:bg-gray-50 dark:hover:bg-gray-800/50'}"
					onclick={() => toggleChat(chat.id)}
				>
					<!-- Avatar -->
					<ChatAvatar
						name={chat.chatTitle}
						responsive
						variant={selectedChatIds.has(chat.id) ? 'teal' : 'dark-green'}
					/>

					<!-- Chat info -->
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 mb-1">
							<h3 class="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100 truncate">
								{chat.chatTitle}
							</h3>
							{#if selectedChatIds.has(chat.id)}
								<div class="flex-shrink-0 hidden sm:block">
									<Icon name="check-circle" size="sm" class="text-[var(--color-whatsapp-teal)]" />
								</div>
							{/if}
						</div>
						<div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
							<div class="flex items-center gap-1">
								<Icon name="message-circle" size="xs" />
								<span>{m.persistence_message_count({ count: chat.messageCount })}</span>
							</div>
							<span class="text-gray-400 hidden sm:inline">&bull;</span>
							<div class="flex items-center gap-1">
								<Icon name="clock" size="xs" />
								<span>{m.persistence_last_opened({ date: formatRelativeDate(chat.updatedAt, getLocale(), m.time_today(), m.time_yesterday(), 'label') })}</span>
							</div>
						</div>
						<div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-500">
							<Icon name="file" size="xs" />
							<span class="truncate">{chat.fileName}</span>
						</div>
					</div>

					<!-- Checkbox indicator -->
					<div class="flex-shrink-0">
						<div
							class="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center transition-all
								{selectedChatIds.has(chat.id)
									? 'border-[var(--color-whatsapp-teal)] bg-[var(--color-whatsapp-teal)] scale-110'
									: 'border-gray-300 dark:border-gray-600 group-hover:border-[var(--color-whatsapp-teal)]'}"
						>
							{#if selectedChatIds.has(chat.id)}
								<Icon name="check" size="xs" class="text-white" />
							{/if}
						</div>
					</div>
				</button>
			{/each}
		</div>

		<!-- Fixed footer -->
		<div class="flex-shrink-0 px-4 sm:px-6 pb-4 sm:pb-5 border-t border-gray-200 dark:border-gray-700">
			<!-- Don't show again -->
			<label class="flex items-center gap-3 py-3 cursor-pointer transition-colors">
				<input
					type="checkbox"
					bind:checked={dontShowAgain}
					class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-[var(--color-whatsapp-teal)] focus:ring-[var(--color-whatsapp-teal)] focus:ring-offset-0"
				/>
				<span class="text-xs sm:text-sm text-gray-700 dark:text-gray-300 select-none">
					{m.persistence_dont_show_again()}
				</span>
			</label>

			<!-- Actions -->
			<div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
				<Button variant="secondary" size="lg" class="flex-1" onclick={handleStartFresh}>
					{m.persistence_start_fresh()}
				</Button>
				<Button variant="primary" size="lg" class="flex-1" onclick={handleRestore} disabled={selectedChatIds.size === 0}>
					<Icon name="download" size="sm" />
					<span>{m.persistence_restore_button({ count: selectedChatIds.size })}</span>
				</Button>
			</div>
		</div>
	</div>
</Modal>

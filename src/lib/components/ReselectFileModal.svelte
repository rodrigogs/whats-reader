<script lang="ts">
import * as m from '$lib/paraglide/messages';
import type { PersistedChatMetadata } from '$lib/persistence.svelte';
import Icon from './Icon.svelte';
import Modal from './Modal.svelte';
import ModalContent from './ModalContent.svelte';
import ModalHeader from './ModalHeader.svelte';

interface Props {
	chatMetadata: PersistedChatMetadata;
	onFileSelected: (file: File) => void;
	onSkip: () => void;
	onClose: () => void;
}

let { chatMetadata, onFileSelected, onSkip, onClose }: Props = $props();

let isDragging = $state(false);

function handleDrop(e: DragEvent) {
	e.preventDefault();
	e.stopPropagation();
	isDragging = false;

	const files = e.dataTransfer?.files;
	if (files && files.length > 0) {
		const file = files[0];
		if (file.name.endsWith('.zip')) {
			onFileSelected(file);
		}
	}
}

function handleDragOver(e: DragEvent) {
	e.preventDefault();
	e.stopPropagation();
	isDragging = true;
}

function handleDragLeave(e: DragEvent) {
	e.preventDefault();
	e.stopPropagation();
	isDragging = false;
}

function handleFileInput(e: Event) {
	const input = e.target as HTMLInputElement;
	const files = input.files;
	if (files && files.length > 0) {
		const file = files[0];
		if (file.name.endsWith('.zip')) {
			onFileSelected(file);
		}
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
	<ModalHeader title={m.persistence_reselect_title()} onClose={onClose} />
	<ModalContent>
		<div class="flex flex-col gap-5">
			<!-- Description with icon -->
			<div class="flex gap-3 items-start p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/30">
				<div class="flex-shrink-0 mt-0.5">
					<Icon name="alert-circle" size="md" class="text-amber-600 dark:text-amber-500" />
				</div>
				<p class="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
					{m.persistence_reselect_description({ chatTitle: chatMetadata.chatTitle })}
				</p>
			</div>

			<!-- Chat info card -->
			<div class="flex items-center gap-4 p-4 bg-[var(--color-whatsapp-light-green)] dark:bg-[var(--color-whatsapp-dark-green)]/20 rounded-xl border border-[var(--color-whatsapp-teal)]/20">
				<!-- Avatar with initials -->
				<div class="flex-shrink-0">
					<div class="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-white text-base shadow-sm bg-[var(--color-whatsapp-teal)]">
						{getInitials(chatMetadata.chatTitle)}
					</div>
				</div>
				<!-- Chat details -->
				<div class="flex-1 min-w-0">
					<h3 class="font-semibold text-neutral-900 dark:text-neutral-100 truncate mb-1">
						{chatMetadata.chatTitle}
					</h3>
					<div class="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
						<Icon name="file" size="xs" />
						<span class="truncate">{chatMetadata.fileName}</span>
					</div>
				</div>
			</div>

			<!-- File drop zone with improved styling -->
			<div
				role="button"
				tabindex="0"
				class="border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer
					{isDragging
						? 'border-[var(--color-whatsapp-teal)] bg-[var(--color-whatsapp-light-green)] dark:bg-[var(--color-whatsapp-dark-green)]/20 scale-[1.02]'
						: 'border-neutral-300 dark:border-neutral-600 hover:border-[var(--color-whatsapp-teal)]/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/30'}"
				ondrop={handleDrop}
				ondragover={handleDragOver}
				ondragleave={handleDragLeave}
			>
				<div class="flex flex-col items-center gap-4">
					<!-- Icon -->
					<div class="w-16 h-16 rounded-full bg-[var(--color-whatsapp-teal)]/10 flex items-center justify-center">
						<Icon name="upload" size="2xl" class="text-[var(--color-whatsapp-teal)]" />
					</div>
					
					<!-- Text -->
					<div class="space-y-2">
						<p class="text-base font-semibold text-neutral-800 dark:text-neutral-200">
							Drop WhatsApp ZIP file here
						</p>
						<p class="text-sm text-neutral-600 dark:text-neutral-400">
							or click below to browse
						</p>
					</div>
					
					<!-- Browse button -->
					<label class="cursor-pointer">
						<input
							type="file"
							accept=".zip"
							class="hidden"
							onchange={handleFileInput}
						/>
						<span class="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-[var(--color-whatsapp-teal)] hover:bg-[var(--color-whatsapp-dark-green)] rounded-lg transition-colors shadow-sm">
							<Icon name="folder" size="sm" />
							<span>Browse Files</span>
						</span>
					</label>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-700">
				<button
					type="button"
					class="flex-1 px-4 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
					onclick={onSkip}
				>
					{m.persistence_skip()}
				</button>
			</div>
		</div>
	</ModalContent>
</Modal>

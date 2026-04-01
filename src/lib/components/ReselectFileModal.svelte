<script lang="ts">
import { openElectronFile, openZipFilePicker } from '$lib/helpers/file-picker';
import * as m from '$lib/paraglide/messages';
import type { PersistedChatMetadata } from '$lib/persistence.svelte';
import Button from './Button.svelte';
import ChatAvatar from './ChatAvatar.svelte';
import Icon from './Icon.svelte';
import Modal from './Modal.svelte';
import ModalContent from './ModalContent.svelte';
import ModalHeader from './ModalHeader.svelte';

interface Props {
	chatMetadata: PersistedChatMetadata;
	onFileSelected: (
		file: File,
		filePath?: string,
		fileHandle?: FileSystemFileHandle,
	) => void;
	onSkip: () => void;
	onClose: () => void;
}

let { chatMetadata, onFileSelected, onSkip, onClose }: Props = $props();

let dragCounter = $state(0);
let isDragging = $derived(dragCounter > 0);

async function handleDrop(e: DragEvent) {
	e.preventDefault();
	e.stopPropagation();
	dragCounter = 0;

	const files = e.dataTransfer?.files;
	if (files && files.length > 0) {
		const file = files[0];
		if (file.name.toLowerCase().endsWith('.zip')) {
			// Try to capture FileSystemFileHandle from drop
			let handle: FileSystemFileHandle | undefined;
			if (
				e.dataTransfer?.items?.[0] &&
				'getAsFileSystemHandle' in DataTransferItem.prototype
			) {
				try {
					const h = await e.dataTransfer.items[0].getAsFileSystemHandle();
					if (h?.kind === 'file') handle = h as FileSystemFileHandle;
				} catch {
					// Not supported
				}
			}
			onFileSelected(file, undefined, handle);
		}
	}
}

function handleDragOver(e: DragEvent) {
	e.preventDefault();
	e.stopPropagation();
}

function handleDragEnter(e: DragEvent) {
	e.preventDefault();
	e.stopPropagation();
	dragCounter++;
}

function handleDragLeave(e: DragEvent) {
	e.preventDefault();
	e.stopPropagation();
	dragCounter = Math.max(0, dragCounter - 1);
}

let fileInputRef: HTMLInputElement | undefined = $state();

function handleFileInput(e: Event) {
	const input = e.target as HTMLInputElement;
	const files = input.files;
	if (files && files.length > 0) {
		const file = files[0];
		if (file.name.toLowerCase().endsWith('.zip')) {
			onFileSelected(file);
		}
	}
}

async function openBrowse() {
	// In Electron, use the native dialog to capture the absolute file path
	if (window.electronAPI) {
		const result = await openElectronFile();
		if (result?.file.name.toLowerCase().endsWith('.zip')) {
			onFileSelected(result.file, result.path);
		}
		return;
	}
	// In Chrome/Edge, use showOpenFilePicker to capture a FileSystemFileHandle
	// so the entry can be upgraded from 'reselect-required' to 'file-handle'
	const result = await openZipFilePicker(false);
	if (result?.handles?.[0]) {
		const file = await result.handles[0].getFile();
		onFileSelected(file, undefined, result.handles[0]);
		return;
	}
	if (!('showOpenFilePicker' in window)) {
		fileInputRef?.click();
	}
}

function handleDropZoneKeydown(e: KeyboardEvent) {
	if (e.key === 'Enter' || e.key === ' ') {
		e.preventDefault();
		openBrowse();
	}
}

function handleDropZoneClick() {
	openBrowse();
}
</script>

<Modal open={true} onClose={onClose}>
	<ModalHeader title={m.persistence_reselect_title()} onClose={onClose} />
	<ModalContent>
		<div class="flex flex-col gap-5 sm:gap-6">
			<!-- Description -->
			<div class="flex gap-2 sm:gap-3 items-start p-3 sm:p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg sm:rounded-xl border border-amber-200 dark:border-amber-800/30">
				<div class="flex-shrink-0 mt-0.5">
					<Icon name="alert-circle" size="md" class="text-amber-600 dark:text-amber-500" />
				</div>
				<p class="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
					{m.persistence_reselect_description({ chatTitle: chatMetadata.chatTitle })}
				</p>
			</div>

			<!-- Chat info card -->
			<div class="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-[var(--color-whatsapp-light-green)] dark:bg-[var(--color-whatsapp-dark-green)]/20 rounded-lg sm:rounded-xl border border-[var(--color-whatsapp-teal)]/20">
				<ChatAvatar name={chatMetadata.chatTitle} responsive />
				<div class="flex-1 min-w-0">
					<h3 class="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100 truncate mb-1">
						{chatMetadata.chatTitle}
					</h3>
					<div class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
						<Icon name="file" size="xs" />
						<span class="truncate">{chatMetadata.fileName}</span>
					</div>
				</div>
			</div>

			<!-- File drop zone -->
			<div
				role="button"
				tabindex="0"
				aria-label={m.persistence_drop_zip()}
				class="border-2 border-dashed rounded-lg sm:rounded-xl p-6 sm:p-10 text-center transition-all cursor-pointer
					{isDragging
						? 'border-[var(--color-whatsapp-teal)] bg-[var(--color-whatsapp-light-green)] dark:bg-[var(--color-whatsapp-dark-green)]/20 scale-[1.02]'
						: 'border-gray-300 dark:border-gray-600 hover:border-[var(--color-whatsapp-teal)]/50 hover:bg-gray-50 dark:hover:bg-gray-800/30'}"
				ondrop={handleDrop}
				ondragover={handleDragOver}
				ondragenter={handleDragEnter}
				ondragleave={handleDragLeave}
				onkeydown={handleDropZoneKeydown}
				onclick={handleDropZoneClick}
			>
				<div class="flex flex-col items-center gap-3 sm:gap-4">
					<!-- Icon -->
					<div class="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[var(--color-whatsapp-teal)]/10 flex items-center justify-center">
						<Icon name="upload" size="xl" class="text-[var(--color-whatsapp-teal)] sm:hidden" />
						<Icon name="upload" size="2xl" class="text-[var(--color-whatsapp-teal)] hidden sm:block" />
					</div>

					<!-- Text -->
					<div class="space-y-1 sm:space-y-2">
						<p class="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-200">
							{m.persistence_drop_zip()}
						</p>
						<p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
							{m.persistence_or_browse()}
						</p>
					</div>

					<!-- Browse button -->
					<label class="cursor-pointer">
						<input
							bind:this={fileInputRef}
							type="file"
							accept=".zip"
							class="hidden"
							onchange={handleFileInput}
						/>
						<span class="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-white bg-[var(--color-whatsapp-teal)] hover:bg-[var(--color-whatsapp-dark-green)] rounded-lg transition-colors shadow-sm">
							<Icon name="folder" size="sm" />
							<span>{m.persistence_browse_files()}</span>
						</span>
					</label>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
				<Button variant="secondary" size="lg" class="flex-1" onclick={onSkip}>
					{m.persistence_skip()}
				</Button>
			</div>
		</div>
	</ModalContent>
</Modal>

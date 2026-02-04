<script lang="ts">
import * as m from '$lib/paraglide/messages';
import type { PersistedChatMetadata } from '$lib/persistence.svelte';
import FileDropZone from './FileDropZone.svelte';
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
</script>

<Modal onclose={onClose}>
	<ModalHeader title={m.persistence_reselect_title()} onclose={onClose} />
	<ModalContent>
		<div class="flex flex-col gap-4">
			<!-- Description -->
			<p class="text-sm text-neutral-600 dark:text-neutral-400">
				{m.persistence_reselect_description({ chatTitle: chatMetadata.chatTitle })}
			</p>

			<!-- Expected file info -->
			<div class="bg-neutral-100 dark:bg-neutral-800 p-3 rounded-lg">
				<div class="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
					{m.persistence_reselect_expected_file({ fileName: '' })}
				</div>
				<div class="text-sm font-medium text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
					<Icon name="file" size={16} />
					<span class="truncate">{chatMetadata.fileName}</span>
				</div>
			</div>

			<!-- File drop zone -->
			<div
				class="border-2 border-dashed rounded-lg p-8 text-center transition-colors {isDragging
					? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
					: 'border-neutral-300 dark:border-neutral-600'}"
				ondrop={handleDrop}
				ondragover={handleDragOver}
				ondragleave={handleDragLeave}
			>
				<div class="flex flex-col items-center gap-3">
					<Icon name="upload" size={32} class="text-neutral-400" />
					<div>
						<p class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
							Drop ZIP file here
						</p>
						<p class="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
							or
						</p>
					</div>
					<label class="cursor-pointer">
						<input
							type="file"
							accept=".zip"
							class="hidden"
							onchange={handleFileInput}
						/>
						<span
							class="inline-block px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 rounded-lg transition-colors"
						>
							Browse files
						</span>
					</label>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex gap-3 justify-end pt-2">
				<button
					type="button"
					class="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
					onclick={onSkip}
				>
					{m.persistence_skip()}
				</button>
			</div>
		</div>
	</ModalContent>
</Modal>

<script lang="ts">
import * as m from '$lib/paraglide/messages';
import Icon from './Icon.svelte';

interface Props {
	onFilesSelected: (files: FileList) => void;
	accept?: string;
	isLoading?: boolean;
	loadingProgress?: number;
}

let {
	onFilesSelected,
	accept = '.zip',
	isLoading = false,
	loadingProgress = 0,
}: Props = $props();

let isDragOver = $state(false);
let fileInput: HTMLInputElement;

function handleDragOver(e: DragEvent) {
	e.preventDefault();
	isDragOver = true;
}

function handleDragLeave(e: DragEvent) {
	e.preventDefault();
	isDragOver = false;
}

function handleDrop(e: DragEvent) {
	e.preventDefault();
	isDragOver = false;

	if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
		onFilesSelected(e.dataTransfer.files);
	}
}

function handleFileSelect(e: Event) {
	const input = e.target as HTMLInputElement;
	if (input.files && input.files.length > 0) {
		onFilesSelected(input.files);
	}
}

function openFilePicker() {
	fileInput?.click();
}

async function openElectronFilePicker() {
	if (window.electronAPI) {
		const result = await window.electronAPI.openFile();
		if (result) {
			// Convert ArrayBuffer to File-like object
			const blob = new Blob([result.buffer]);
			const file = new File([blob], result.name, {
				type: getMimeType(result.name),
			});
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);
			onFilesSelected(dataTransfer.files);
		}
	} else {
		openFilePicker();
	}
}

function getMimeType(filename: string): string {
	const ext = filename.toLowerCase().split('.').pop();
	if (ext === 'zip') return 'application/zip';
	return 'application/octet-stream';
}
</script>

<div
	class="border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer {isDragOver
		? 'border-[var(--color-whatsapp-teal)] bg-[var(--color-whatsapp-light-green)]/20'
		: 'border-gray-300 dark:border-gray-600 hover:border-[var(--color-whatsapp-teal)]'}"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	onclick={openElectronFilePicker}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === 'Enter' && openElectronFilePicker()}
>
	<input
		bind:this={fileInput}
		type="file"
		{accept}
		class="hidden"
		onchange={handleFileSelect}
		multiple
	/>

	{#if isLoading}
		<!-- Loading state with progress -->
		<div class="flex flex-col items-center gap-4">
			<svg class="w-16 h-16 animate-spin-slow" viewBox="0 0 36 36">
				<!-- Background circle -->
				<circle
					cx="18"
					cy="18"
					r="16"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					class="text-gray-200 dark:text-gray-700"
				/>
				<!-- Progress circle -->
				<circle
					cx="18"
					cy="18"
					r="16"
					fill="none"
					stroke="var(--color-whatsapp-teal)"
					stroke-width="2"
					stroke-linecap="round"
					stroke-dasharray={100.53}
					stroke-dashoffset={100.53 - (100.53 * loadingProgress) / 100}
					transform="rotate(-90 18 18)"
				/>
			</svg>
			<div class="text-center">
				<p class="text-gray-600 dark:text-gray-300 font-medium">{m.dropzone_loading()}</p>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{Math.round(loadingProgress)}%</p>
			</div>
		</div>
	{:else}
		<!-- Default state -->
		<div class="flex flex-col items-center gap-4">
			<div class="w-16 h-16 rounded-full bg-[var(--color-whatsapp-light-green)] flex items-center justify-center">
				<Icon name="cloud-upload" size="2xl" class="text-[var(--color-whatsapp-teal)]" />
			</div>

			<div>
				<p class="text-lg font-medium text-gray-700 dark:text-gray-200">
					{m.dropzone_title()}
				</p>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
					{m.dropzone_subtitle()} • {m.dropzone_formats()}
				</p>
			</div>

		</div>
	{/if}
</div>

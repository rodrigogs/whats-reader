<script lang="ts">
	interface Props {
		onFilesSelected: (files: FileList) => void;
		accept?: string;
		isLoading?: boolean;
	}

	let { onFilesSelected, accept = '.zip', isLoading = false }: Props = $props();

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
				const file = new File([blob], result.name, { type: getMimeType(result.name) });
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
		<!-- Loading state -->
		<div class="flex flex-col items-center gap-4">
			<div class="animate-spin rounded-full h-12 w-12 border-4 border-[var(--color-whatsapp-teal)] border-t-transparent"></div>
			<p class="text-gray-600 dark:text-gray-300">Processing file...</p>
		</div>
	{:else}
		<!-- Default state -->
		<div class="flex flex-col items-center gap-4">
			<div class="w-16 h-16 rounded-full bg-[var(--color-whatsapp-light-green)] flex items-center justify-center">
				<svg class="w-8 h-8 text-[var(--color-whatsapp-teal)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
				</svg>
			</div>

			<div>
				<p class="text-lg font-medium text-gray-700 dark:text-gray-200">
					{isDragOver ? 'Drop your file here' : 'Drop WhatsApp export here'}
				</p>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
					or click to browse • Supports .zip files
				</p>
			</div>

			<div class="flex items-center gap-4 mt-2">
				<div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
					</svg>
					<span>.zip with media</span>
				</div>
			</div>
		</div>
	{/if}
</div>

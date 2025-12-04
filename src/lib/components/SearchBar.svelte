<script lang="ts">
	import { onDestroy } from 'svelte';

	interface Props {
		value: string;
		onInput: (value: string) => void;
		placeholder?: string;
		debounceMs?: number;
	}

	let { value, onInput, placeholder = 'Search messages...', debounceMs = 300 }: Props = $props();

	let localValue = $state('');
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Sync external value changes (including initial value)
	$effect(() => {
		localValue = value;
	});

	function handleInput(e: Event) {
		const input = e.target as HTMLInputElement;
		localValue = input.value;

		// Clear existing timer
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		// Set new debounced call
		debounceTimer = setTimeout(() => {
			onInput(localValue);
		}, debounceMs);
	}

	function handleClear() {
		localValue = '';
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		onInput('');
	}

	onDestroy(() => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
	});
</script>

<div class="relative">
	<div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
		<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
		</svg>
	</div>

	<input
		type="text"
		value={localValue}
		{placeholder}
		class="w-full pl-10 pr-10 py-2 bg-gray-100 dark:bg-gray-800 border-0 rounded-lg text-gray-800 dark:text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-[var(--color-whatsapp-teal)] focus:outline-none transition-all"
		oninput={handleInput}
	/>

	{#if localValue}
		<button
			class="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
			onclick={handleClear}
			aria-label="Clear search"
		>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	{/if}
</div>

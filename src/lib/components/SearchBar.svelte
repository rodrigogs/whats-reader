<script lang="ts">
import { onDestroy } from 'svelte';
import * as m from '$lib/paraglide/messages';
import Icon from './Icon.svelte';

interface Props {
	value: string;
	onInput: (value: string) => void;
	onNextResult?: () => void;
	onPrevResult?: () => void;
	placeholder?: string;
	debounceMs?: number;
}

let {
	value,
	onInput,
	onNextResult,
	onPrevResult,
	placeholder = m.search_placeholder(),
	debounceMs = 300,
}: Props = $props();

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

function handleKeyDown(e: KeyboardEvent) {
	// Handle navigation keys when there's a search query
	if (!localValue) return;

	if (e.key === 'Enter') {
		e.preventDefault();
		if (e.shiftKey) {
			onPrevResult?.();
		} else {
			onNextResult?.();
		}
	} else if (e.key === 'ArrowDown') {
		e.preventDefault();
		onNextResult?.();
	} else if (e.key === 'ArrowUp') {
		e.preventDefault();
		onPrevResult?.();
	}
}

function handleClear() {
	localValue = '';
	if (debounceTimer) {
		clearTimeout(debounceTimer);
	}
	// Intentionally call onInput('') immediately for instant feedback when clearing,
	// rather than debouncing, to provide a more responsive user experience.
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
		<Icon name="search" class="text-gray-400" />
	</div>

	<input
		type="text"
		value={localValue}
		{placeholder}
		class="w-full pl-10 pr-10 py-2 bg-gray-100 dark:bg-gray-800 border-0 rounded-lg text-gray-800 dark:text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-[var(--color-whatsapp-teal)] focus:outline-none transition-all"
		oninput={handleInput}
		onkeydown={handleKeyDown}
	/>

	{#if localValue}
		<button
			class="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors"
			onclick={handleClear}
			aria-label={m.search_clear()}
		>
			<Icon name="close" />
		</button>
	{/if}
</div>

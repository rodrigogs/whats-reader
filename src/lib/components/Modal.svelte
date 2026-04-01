<script lang="ts">
import type { Snippet } from 'svelte';
import { browser } from '$app/environment';
import * as m from '$lib/paraglide/messages';

interface Props {
	/**
	 * Whether the modal is open
	 */
	open: boolean;
	/**
	 * Callback when the modal should close (backdrop click or ESC key)
	 */
	onClose: () => void;
	/**
	 * Additional CSS classes for the modal container
	 */
	class?: string;
	/**
	 * Accessible label for the close backdrop button
	 */
	closeAriaLabel?: string;
	/**
	 * Modal content
	 */
	children: Snippet;
}

let {
	open,
	onClose,
	class: className = '',
	closeAriaLabel = m.close_modal(),
	children,
}: Props = $props();

// Handle ESC key to close modal
$effect(() => {
	if (!browser || !open) return;

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			onClose();
		}
	};

	window.addEventListener('keydown', handleKeydown);
	return () => window.removeEventListener('keydown', handleKeydown);
});
</script>

{#if open}
	<!-- Backdrop with animation -->
	<button
		type="button"
		class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] cursor-default animate-in fade-in duration-200"
		onclick={onClose}
		aria-label={closeAriaLabel}
	></button>

	<!-- Modal with enhanced elevation and animation -->
	<div
		class="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] sm:w-[calc(100vw-3rem)] md:w-[90vw] md:max-w-[520px] max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] md:max-h-[80vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200 {className}"
		style="box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05);"
		role="dialog"
		aria-modal="true"
	>
		{@render children()}
	</div>
{/if}

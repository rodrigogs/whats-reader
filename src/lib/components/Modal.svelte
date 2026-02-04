<script lang="ts">
import type { Snippet } from 'svelte';
import { browser } from '$app/environment';

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
	 * @default 'Close modal'
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
	closeAriaLabel = 'Close modal',
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
		class="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[480px] md:max-h-[80vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl z-[70] flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200 {className}"
		style="box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05);"
		role="dialog"
		aria-modal="true"
	>
		{@render children()}
	</div>
{/if}

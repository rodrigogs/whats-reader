<script lang="ts">
import type { Snippet } from 'svelte';
import { browser } from '$app/environment';
import { floating } from '$lib/actions/floating';

interface Props {
	/**
	 * Reference element for positioning the dropdown
	 */
	anchor: HTMLElement | null;
	/**
	 * Whether the dropdown is open
	 */
	open: boolean;
	/**
	 * Callback when the dropdown should close
	 */
	onClose: () => void;
	/**
	 * Dropdown placement relative to anchor
	 * @default 'bottom-end'
	 */
	placement?: 'bottom-end' | 'bottom-start' | 'top-end' | 'top-start';
	/**
	 * Fallback placements if primary doesn't fit
	 */
	fallbackPlacements?: Array<
		'bottom-start' | 'top-end' | 'top-start' | 'left-start' | 'right-start'
	>;
	/**
	 * Distance from anchor element in pixels
	 * @default 8
	 */
	offsetDistance?: number;
	/**
	 * Width of the dropdown
	 * @default 'w-64'
	 */
	width?: string;
	/**
	 * Additional CSS classes
	 */
	class?: string;
	/**
	 * Dropdown content
	 */
	children: Snippet;
}

let {
	anchor,
	open,
	onClose,
	placement = 'bottom-end',
	fallbackPlacements = [
		'bottom-start',
		'top-end',
		'top-start',
		'left-start',
		'right-start',
	],
	offsetDistance = 8,
	width = 'w-64',
	class: className = '',
	children,
}: Props = $props();

// Handle ESC key to close dropdown
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

{#if open && anchor}
	<!-- Backdrop to close dropdown -->
	<button
		type="button"
		class="fixed inset-0 z-40 cursor-default"
		onclick={onClose}
		aria-label="Close dropdown"
	></button>

	<!-- Dropdown menu -->
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		role="menu"
		tabindex="-1"
		class="fixed {width} bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden {className}"
		use:floating={{
			reference: anchor,
			placement,
			fallbackPlacements,
			offsetDistance,
			enableSizeConstraint: true,
		}}
		onclick={(e) => e.stopPropagation()}
	>
		{@render children()}
	</div>
{/if}

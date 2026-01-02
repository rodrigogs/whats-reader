<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
	/**
	 * Maximum height for scrollable content
	 * @default 'max-h-48'
	 */
	maxHeight?: string;
	/**
	 * Additional CSS classes
	 */
	class?: string;
	/**
	 * List items
	 */
	children: Snippet;
}

let {
	maxHeight = 'max-h-48',
	class: className = '',
	children,
}: Props = $props();
</script>

<div class="{maxHeight} overflow-y-auto py-1 {className}">
	{@render children()}
</div>

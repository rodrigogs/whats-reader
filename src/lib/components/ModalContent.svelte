<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
	/**
	 * Additional CSS classes for the content container
	 */
	class?: string;
	/**
	 * Modal content
	 */
	children: Snippet;
}

let { class: className = '', children }: Props = $props();
</script>

<div class="flex-1 overflow-y-auto {className}">
	{@render children()}
</div>

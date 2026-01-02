<script lang="ts">
import type { Snippet } from 'svelte';
import Icon from './Icon.svelte';

interface Props {
	/**
	 * The title text displayed in the summary
	 */
	title: string;
	/**
	 * Optional icon to display before the title
	 * @default 'chevron-right'
	 */
	icon?: 'chevron-right' | 'chevron-down';
	/**
	 * Whether the collapsible is open by default
	 * @default false
	 */
	open?: boolean;
	/**
	 * Additional CSS classes to apply to the details element
	 */
	class?: string;
	/**
	 * Content to display when expanded
	 */
	children: Snippet;
}

let {
	title,
	icon = 'chevron-right',
	open = false,
	class: className = '',
	children,
}: Props = $props();
</script>

<details class="group {className}" {open}>
	<summary
		class="flex items-center justify-center gap-2 cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors select-none"
	>
		<Icon
			name={icon}
			size="sm"
			class="transition-transform group-open:rotate-90"
		/>
		{title}
	</summary>
	<div class="mt-3">
		{@render children()}
	</div>
</details>

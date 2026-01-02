<script lang="ts">
import type { Snippet } from 'svelte';
import type { IconName } from './Icon.svelte';
import Icon from './Icon.svelte';

interface Props {
	/**
	 * Badge content - either a number or an icon name (optional for icon variant)
	 */
	badge?: string | number;
	/**
	 * Icon to display in the badge (required for icon variant)
	 */
	icon?: IconName;
	/**
	 * Badge style variant
	 * @default 'numbered' - Circle with number
	 * 'icon' - Circle with icon
	 */
	variant?: 'numbered' | 'icon';
	/**
	 * Additional CSS classes for the container
	 */
	class?: string;
	/**
	 * Content to display next to the badge
	 */
	children: Snippet;
}

let {
	badge,
	icon,
	variant = badge !== undefined ? 'numbered' : 'icon',
	class: className = '',
	children,
}: Props = $props();

// Resolve the effective variant to avoid empty badges when icon is missing
const effectiveVariant = $derived(
	variant === 'icon' && !icon && badge !== undefined ? 'numbered' : variant,
);
</script>

<div
	class="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg {className}"
>
	{#if (effectiveVariant === 'numbered' && badge !== undefined) || (effectiveVariant === 'icon' && icon)}
		<span
			class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center {effectiveVariant === 'numbered' ? 'font-bold' : ''}"
		>
			{#if effectiveVariant === 'numbered' && badge !== undefined}
				{badge}
			{:else if effectiveVariant === 'icon' && icon}
				<Icon name={icon} size="xs" stroke-width="2" />
			{/if}
		</span>
	{/if}
	<span class="text-xs text-gray-600 dark:text-gray-400">
		{@render children()}
	</span>
</div>

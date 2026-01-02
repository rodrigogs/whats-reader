<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';

interface Props extends HTMLButtonAttributes {
	/**
	 * Show active/selected state with teal color
	 */
	active?: boolean;
	/**
	 * Danger variant for destructive actions (red hover)
	 */
	danger?: boolean;
	/**
	 * Text size: 'sm' for text-xs, 'md' for text-sm
	 */
	size?: 'sm' | 'md';
	/**
	 * Button content
	 */
	children?: Snippet;
	/**
	 * Bindable reference to the underlying button element
	 */
	ref?: HTMLButtonElement | null;
}

let {
	active = false,
	danger = false,
	size = 'md',
	children,
	class: className,
	ref = $bindable(null),
	...rest
}: Props = $props();

const baseClasses =
	'w-full text-left cursor-pointer transition-colors flex items-center gap-2';

const sizeClasses = {
	sm: 'px-3 py-1.5 text-xs',
	md: 'px-3 py-2 text-sm',
};

const colorClasses = $derived(
	danger
		? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
		: active
			? 'text-[var(--color-whatsapp-teal)] font-medium'
			: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
);
</script>

<button
bind:this={ref}
type="button"
class={[baseClasses, sizeClasses[size], colorClasses, className]}
{...rest}
>
{@render children?.()}
</button>

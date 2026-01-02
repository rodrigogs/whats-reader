<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';

interface Props extends HTMLButtonAttributes {
	/**
	 * Visual theme based on background context:
	 * - 'light': Gray icon on light backgrounds (modals, panels)
	 * - 'dark': White icon on dark backgrounds (header toolbar)
	 * - 'subtle': Minimal style for in-content buttons (messages)
	 */
	theme?: 'light' | 'dark' | 'subtle';
	size?: 'sm' | 'md' | 'lg';
	rounded?: 'md' | 'lg' | 'full';
	/** Show active/selected state */
	active?: boolean;
	/** Show red color on hover (for delete actions) */
	dangerHover?: boolean;
	children?: Snippet;
	/** Bindable reference to the underlying button element */
	ref?: HTMLButtonElement | null;
}

let {
	theme = 'light',
	size = 'md',
	rounded = 'lg',
	active = false,
	dangerHover = false,
	children,
	class: className,
	ref = $bindable(null),
	...rest
}: Props = $props();

const baseClasses =
	'cursor-pointer transition-colors inline-flex items-center justify-center';

const themeClass = $derived.by(() => {
	if (theme === 'light') {
		return dangerHover
			? 'text-gray-400 hover:text-red-500'
			: 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700';
	}
	if (theme === 'dark') {
		return 'text-white/90 hover:bg-white/10';
	}
	return 'text-gray-400 dark:text-gray-500 hover:bg-black/10 dark:hover:bg-white/10';
});

const activeClasses = {
	light: 'bg-gray-100 dark:bg-gray-700',
	dark: 'bg-white/20',
	subtle: 'bg-black/10 dark:bg-white/10',
};

const sizeClasses = {
	sm: 'p-1',
	md: 'p-1.5',
	lg: 'p-2',
};

const roundedClasses = {
	md: 'rounded-md',
	lg: 'rounded-lg',
	full: 'rounded-full',
};
</script>

<button
	bind:this={ref}
	type="button"
	class={`${baseClasses} ${themeClass} ${active ? activeClasses[theme] : ''} ${sizeClasses[size]} ${roundedClasses[rounded]} ${className || ''}`}
	{...rest}
>
	{@render children?.()}
</button>

<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';

interface Props extends HTMLButtonAttributes {
	variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
	size?: 'sm' | 'md';
	children?: Snippet;
}

let {
	variant = 'ghost',
	size = 'md',
	children,
	class: className,
	...rest
}: Props = $props();

const baseClasses =
	'cursor-pointer transition-colors inline-flex items-center justify-center gap-1.5 font-medium';

const variantClasses = {
	primary:
		'bg-[var(--color-whatsapp-teal)] text-white hover:brightness-110 hover:shadow-md',
	secondary:
		'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
	ghost:
		'text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
	danger:
		'text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20',
};

const sizeClasses = {
	sm: 'px-3 py-1.5 text-xs rounded-md',
	md: 'px-4 py-1.5 text-sm rounded-lg',
};
</script>

<button
type="button"
class={[baseClasses, variantClasses[variant], sizeClasses[size], className]}
{...rest}
>
{@render children?.()}
</button>

<script lang="ts">
import { getInitials } from '$lib/helpers/format';

interface Props {
	name: string;
	size?: 'sm' | 'md';
	responsive?: boolean;
	variant?: 'teal' | 'dark-green';
	class?: string;
}

let {
	name,
	size = 'sm',
	responsive = false,
	variant = 'teal',
	class: className = '',
}: Props = $props();

const bgClasses = $derived(
	variant === 'teal'
		? 'bg-[var(--color-whatsapp-teal)]'
		: 'bg-[var(--color-whatsapp-dark-green)]',
);

const sizeClasses = $derived(
	responsive
		? 'w-10 h-10 sm:w-12 sm:h-12 text-sm sm:text-base'
		: size === 'md'
			? 'w-12 h-12 text-base'
			: 'w-10 h-10 text-sm',
);
</script>

<div
	class="rounded-full flex items-center justify-center font-semibold text-white shadow-sm flex-shrink-0 {bgClasses} {sizeClasses} {className}"
>
	{getInitials(name)}
</div>

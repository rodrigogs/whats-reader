<script lang="ts">
import type { Snippet } from 'svelte';
import type { IconName } from './Icon.svelte';
import Icon from './Icon.svelte';
import IconButton from './IconButton.svelte';

interface Props {
	/**
	 * Icon to display in the header
	 */
	icon?: IconName;
	/**
	 * Main title text
	 */
	title: string;
	/**
	 * Optional subtitle text
	 */
	subtitle?: string;
	/**
	 * Callback when close button is clicked
	 */
	onClose: () => void;
	/**
	 * Close button aria-label
	 * @default 'Close'
	 */
	closeLabel?: string;
	/**
	 * Additional header content (optional)
	 */
	children?: Snippet;
}

let {
	icon,
	title,
	subtitle,
	onClose,
	closeLabel = 'Close',
	children,
}: Props = $props();
</script>

<div
	class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-[var(--color-whatsapp-dark-green)] text-white"
>
	<div class="flex items-center gap-3">
		{#if icon}
			<Icon name={icon} size="md" />
		{/if}
		<div>
			<h2 class="font-semibold">{title}</h2>
			{#if subtitle}
				<p class="text-xs text-white/70">{subtitle}</p>
			{/if}
		</div>
	</div>
	{#if children}
		{@render children()}
	{/if}
	<IconButton theme="dark" size="sm" onclick={onClose} aria-label={closeLabel}>
		<Icon name="close" size="md" />
	</IconButton>
</div>

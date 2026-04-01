<script lang="ts">
/**
 * Simple Toast Notification
 * Displays temporary notification messages
 */
import { fly } from 'svelte/transition';
import * as m from '$lib/paraglide/messages';
import Icon from './Icon.svelte';

interface Props {
	message: string;
	type?: 'success' | 'error' | 'info';
	duration?: number;
	onClose?: () => void;
}

let { message, type = 'success', duration = 3000, onClose }: Props = $props();

let visible = $state(true);

// Reset visibility and restart timer when message changes
$effect(() => {
	// Track message to re-run when it changes
	void message;
	visible = true;
});

// Auto-hide after duration, with cleanup on destroy
$effect(() => {
	if (!visible || duration <= 0) return;

	const timer = setTimeout(() => {
		visible = false;
	}, duration);

	return () => clearTimeout(timer);
});

function handleClose() {
	visible = false;
}

const bgColors = {
	success: 'bg-green-500 dark:bg-green-600',
	error: 'bg-red-500 dark:bg-red-600',
	info: 'bg-blue-500 dark:bg-blue-600',
};

const iconName = $derived(
	type === 'success'
		? 'check-circle'
		: type === 'error'
			? 'alert-circle'
			: 'alert-circle',
);
</script>

{#if visible}
	<div
		class="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white {bgColors[type]}"
		role="alert"
		transition:fly={{ y: 8, duration: 300 }}
		onoutroend={() => onClose?.()}
	>
		<Icon name={iconName} size="md" />
		<span class="text-sm font-medium">{message}</span>
		<button
			type="button"
			onclick={handleClose}
			class="ml-2 hover:opacity-80 transition-opacity"
			aria-label={m.close_notification()}
		>
			<Icon name="x" size="sm" />
		</button>
	</div>
{/if}

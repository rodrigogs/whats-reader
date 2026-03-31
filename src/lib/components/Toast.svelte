<script lang="ts">
/**
 * Simple Toast Notification
 * Displays temporary notification messages
 */
import { fly } from 'svelte/transition';

interface Props {
	message: string;
	type?: 'success' | 'error' | 'info';
	duration?: number;
	onClose?: () => void;
}

let { message, type = 'success', duration = 3000, onClose }: Props = $props();

let visible = $state(true);

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
</script>

{#if visible}
	<div
		class="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white {bgColors[type]}"
		role="alert"
		transition:fly={{ y: 8, duration: 300 }}
		onoutroend={() => onClose?.()}
	>
		<svg
			class="w-5 h-5"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
		>
			{#if type === 'success'}
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M5 13l4 4L19 7"
				></path>
			{:else if type === 'error'}
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				></path>
			{:else}
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				></path>
			{/if}
		</svg>
		<span class="text-sm font-medium">{message}</span>
		<button
			type="button"
			onclick={handleClose}
			class="ml-2 hover:opacity-80 transition-opacity"
			aria-label="Close notification"
		>
			<svg
				class="w-4 h-4"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				></path>
			</svg>
		</button>
	</div>
{/if}

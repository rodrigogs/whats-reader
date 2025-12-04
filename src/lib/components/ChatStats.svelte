<script lang="ts">
	import type { ChatData } from '$lib/state.svelte';
	import { getChatStats } from '$lib/parser';

	interface Props {
		chat: ChatData;
		onClose: () => void;
	}

	let { chat, onClose }: Props = $props();

	const stats = $derived(getChatStats(chat));

	function formatDuration(startDate: Date | null, endDate: Date | null): string {
		if (!startDate || !endDate) return 'Unknown';

		const diff = endDate.getTime() - startDate.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const months = Math.floor(days / 30);
		const years = Math.floor(days / 365);

		if (years > 0) {
			return `${years} year${years > 1 ? 's' : ''}, ${months % 12} month${months % 12 !== 1 ? 's' : ''}`;
		}
		if (months > 0) {
			return `${months} month${months > 1 ? 's' : ''}, ${days % 30} day${days % 30 !== 1 ? 's' : ''}`;
		}
		return `${days} day${days !== 1 ? 's' : ''}`;
	}

	function formatHour(hour: number): string {
		const ampm = hour >= 12 ? 'PM' : 'AM';
		const h = hour % 12 || 12;
		return `${h} ${ampm}`;
	}

	const participantEntries = $derived(
		Object.entries(stats.messagesByParticipant).sort((a, b) => b[1] - a[1])
	);

	const maxMessages = $derived(
		Math.max(...Object.values(stats.messagesByParticipant))
	);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
	onclick={onClose}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
	role="presentation"
>
	<div
		class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="stats-title"
		tabindex="-1"
	>
		<!-- Header -->
		<div class="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
			<h2 id="stats-title" class="text-xl font-bold text-gray-800 dark:text-white">Chat Statistics</h2>
			<button
				class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
				onclick={onClose}
				aria-label="Close"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Content -->
		<div class="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
			<!-- Overview cards -->
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
				<div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
					<div class="text-2xl font-bold text-[var(--color-whatsapp-teal)]">
						{chat.messageCount.toLocaleString()}
					</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">Messages</div>
				</div>
				<div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
					<div class="text-2xl font-bold text-[var(--color-whatsapp-teal)]">
						{chat.participants.length}
					</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">Participants</div>
				</div>
				<div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
					<div class="text-2xl font-bold text-[var(--color-whatsapp-teal)]">
						{stats.avgMessagesPerDay}
					</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">Avg/Day</div>
				</div>
				<div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
					<div class="text-2xl font-bold text-[var(--color-whatsapp-teal)]">
						{chat.mediaCount}
					</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">Media</div>
				</div>
			</div>

			<!-- Duration -->
			<div class="mb-8">
				<h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-2">Duration</h3>
				<p class="text-gray-600 dark:text-gray-300">
					{formatDuration(chat.startDate, chat.endDate)}
				</p>
				<p class="text-sm text-gray-500 dark:text-gray-400">
					{chat.startDate?.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
					→
					{chat.endDate?.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
				</p>
			</div>

			<!-- Messages by participant -->
			<div class="mb-8">
				<h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">Messages by Participant</h3>
				<div class="space-y-3">
					{#each participantEntries as [name, count]}
						<div>
							<div class="flex justify-between items-center mb-1">
								<span class="text-sm text-gray-700 dark:text-gray-300 truncate">{name}</span>
								<span class="text-sm text-gray-500 dark:text-gray-400">{count.toLocaleString()}</span>
							</div>
							<div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
								<div
									class="h-full bg-[var(--color-whatsapp-teal)] rounded-full transition-all"
									style="width: {(count / maxMessages) * 100}%"
								></div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Most active hour -->
			<div class="mb-8">
				<h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-2">Most Active Hour</h3>
				<p class="text-gray-600 dark:text-gray-300">
					{formatHour(stats.mostActiveHour)}
				</p>
			</div>

			<!-- Activity by hour -->
			<div>
				<h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">Activity by Hour</h3>
				<div class="flex items-end gap-1 h-24">
					{#each stats.messagesByHour as count, hour}
						{@const maxHourCount = Math.max(...stats.messagesByHour)}
						{@const height = maxHourCount > 0 ? (count / maxHourCount) * 100 : 0}
						<div class="flex-1 flex flex-col items-center">
							<div
								class="w-full bg-[var(--color-whatsapp-teal)]/70 rounded-t transition-all"
								style="height: {height}%"
								title="{hour}:00 - {count} messages"
							></div>
						</div>
					{/each}
				</div>
				<div class="flex justify-between mt-1 text-xs text-gray-400 dark:text-gray-500">
					<span>12AM</span>
					<span>6AM</span>
					<span>12PM</span>
					<span>6PM</span>
					<span>11PM</span>
				</div>
			</div>
		</div>
	</div>
</div>

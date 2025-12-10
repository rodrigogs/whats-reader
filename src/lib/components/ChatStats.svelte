<script lang="ts">
import { onMount } from 'svelte';
import * as m from '$lib/paraglide/messages';
import type { ChatData } from '$lib/state.svelte';

interface Props {
	chat: ChatData;
	onClose: () => void;
}

interface StatsResult {
	messagesByParticipant: Record<string, number>;
	messagesByDate: Record<string, number>;
	messagesByHour: number[];
	mostActiveParticipant: string;
	mostActiveHour: number;
	avgMessagesPerDay: number;
	totalDays: number;
}

let { chat, onClose }: Props = $props();

let stats = $state<StatsResult | null>(null);
let isLoading = $state(true);
let error = $state<string | null>(null);

onMount(() => {
	// Create worker using Vite's recommended syntax for ES module workers
	const worker = new Worker(
		new URL('../workers/stats-worker.ts', import.meta.url),
		{ type: 'module' },
	);

	worker.onmessage = (event: MessageEvent<StatsResult>) => {
		stats = event.data;
		isLoading = false;
		worker.terminate();
	};

	worker.onerror = (err) => {
		console.error('Stats worker error:', err);
		error = m.stats_failed();
		isLoading = false;
		worker.terminate();
	};

	// Serialize messages for the worker (Date objects don't survive postMessage)
	const serializedMessages = chat.messages.map((m) => ({
		timestamp: m.timestamp.toISOString(),
		sender: m.sender,
		isSystemMessage: m.isSystemMessage,
	}));

	worker.postMessage({
		messages: serializedMessages,
		messageCount: chat.messageCount,
		startDate: chat.startDate?.toISOString() ?? null,
		endDate: chat.endDate?.toISOString() ?? null,
	});

	return () => {
		worker.terminate();
	};
});

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
	stats
		? Object.entries(stats.messagesByParticipant).sort((a, b) => b[1] - a[1])
		: [],
);

const maxMessages = $derived(
	stats ? Math.max(...Object.values(stats.messagesByParticipant)) : 0,
);

const maxHourCount = $derived(stats ? Math.max(...stats.messagesByHour) : 0);
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
			<h2 id="stats-title" class="text-xl font-bold text-gray-800 dark:text-white">{m.stats_title()}</h2>
			<button
				class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
				onclick={onClose}
				aria-label={m.stats_close()}
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Content -->
		<div class="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
			{#if isLoading}
				<!-- Loading state -->
				<div class="flex flex-col items-center justify-center py-16">
					<div class="w-12 h-12 border-4 border-gray-200 dark:border-gray-700 border-t-[var(--color-whatsapp-teal)] rounded-full animate-spin mb-4"></div>
					<p class="text-gray-500 dark:text-gray-400">{m.stats_computing()}</p>
				</div>
			{:else if error}
				<!-- Error state -->
				<div class="flex flex-col items-center justify-center py-16">
					<svg class="w-12 h-12 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
					<p class="text-red-500">{error}</p>
				</div>
			{:else if stats}
				<!-- Overview cards -->
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
					<div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
						<div class="text-2xl font-bold text-[var(--color-whatsapp-teal)]">
							{chat.messageCount.toLocaleString()}
						</div>
						<div class="text-sm text-gray-500 dark:text-gray-400">{m.stats_messages()}</div>
					</div>
					<div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
						<div class="text-2xl font-bold text-[var(--color-whatsapp-teal)]">
							{chat.participants.length}
						</div>
						<div class="text-sm text-gray-500 dark:text-gray-400">{m.stats_participants()}</div>
					</div>
					<div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
						<div class="text-2xl font-bold text-[var(--color-whatsapp-teal)]">
							{stats.avgMessagesPerDay}
						</div>
						<div class="text-sm text-gray-500 dark:text-gray-400">{m.stats_avg_day()}</div>
					</div>
					<div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
						<div class="text-2xl font-bold text-[var(--color-whatsapp-teal)]">
							{chat.mediaCount}
						</div>
						<div class="text-sm text-gray-500 dark:text-gray-400">{m.stats_media()}</div>
					</div>
				</div>

				<!-- Duration -->
				<div class="mb-8">
					<h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-2">{m.stats_duration()}</h3>
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
					<h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">{m.stats_messages_by_participant()}</h3>
					<div class="space-y-3">
						{#each participantEntries as [name, count] (name)}
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
					<h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-2">{m.stats_busiest_hour()}</h3>
					<p class="text-gray-600 dark:text-gray-300">
						{formatHour(stats.mostActiveHour)}
					</p>
				</div>

				<!-- Activity by hour -->
				<div>
					<h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">{m.stats_activity_by_hour()}</h3>
					<div class="flex items-end gap-0.5 h-24">
						{#each stats.messagesByHour as count, hour (hour)}
							{@const height = maxHourCount > 0 ? (count / maxHourCount) * 100 : 0}
							<div
								class="flex-1 bg-[var(--color-whatsapp-teal)] hover:bg-[var(--color-whatsapp-dark-green)] rounded-t transition-all cursor-pointer group relative min-h-[2px]"
								style="height: {height}%"
							>
								<!-- Tooltip -->
								<div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
									{hour}:00 - {count.toLocaleString()} messages
								</div>
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
			{/if}
		</div>
	</div>
</div>

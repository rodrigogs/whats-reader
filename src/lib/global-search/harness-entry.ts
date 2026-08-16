/**
 * GH-67 §9 — Benchmark harness entry.
 *
 * This module is the ONLY hook through which the app exposes the deterministic
 * synthetic corpus (`gh67-v1`) to the release benchmark. It compiles into the
 * bundle only when `VITE_GLOBAL_SEARCH_HARNESS=1` (a dedicated harness build);
 * normal and distributed builds keep the constant false and never install the
 * `window.__gh67GlobalSearchHarness` bridge.
 *
 * Nothing here substitutes or mocks the production path: the corpus is injected
 * through the real app state, queries run through the real UI and the real
 * dedicated worker transport, and the harness only TAPS the transport to record
 * `performance.now()` markers (submit → first shard → first worker progress →
 * terminal complete/cancelled). A loopback/mock substitution or a hidden
 * first-page timing makes the browser integration test and the report gates
 * fail.
 */

import type { ChatMessage } from '../parser/chat-parser';
import type { ChatData } from '../state.svelte';
import type {
	GlobalSearchWorkerInput,
	GlobalSearchWorkerOutput,
} from '../workers/global-search-worker';
import type { GlobalSearchState } from './global-search-state.svelte';
import {
	createWorkerTransport,
	type GlobalSearchTransport,
} from './query-orchestrator';
import {
	createGlobalSearchSyntheticDataset,
	GLOBAL_SEARCH_SYNTHETIC_SEED,
	iterateGlobalSearchSyntheticMessages,
} from './synthetic-generator';

export type GlobalSearchHarnessEnvironment = {
	VITE_GLOBAL_SEARCH_HARNESS?: string;
};

export function isGlobalSearchHarnessEnabled(
	env: GlobalSearchHarnessEnvironment,
): boolean {
	return env.VITE_GLOBAL_SEARCH_HARNESS === '1';
}

/** Build-time constant: false in normal builds, true only in harness builds. */
export const GLOBAL_SEARCH_HARNESS_ENABLED = isGlobalSearchHarnessEnabled(
	import.meta.env as unknown as GlobalSearchHarnessEnvironment,
);

export type GlobalSearchHarnessChatsSummary = {
	archiveCount: number;
	messageCount: number;
	searchableBytes: number;
};

/**
 * Build the deterministic synthetic corpus as real app `ChatData` (the same
 * shape a parsed export would have). The generator's unicode/emoji/CJK
 * content, null timestamps, duplicated chat titles and the >256 KiB content
 * document all flow through untouched. messageIds are globally unique per
 * ordinal (no intra-chat collisions — ChatView keys rendered items by message
 * id); cross-chat id collisions are covered by archive-identity.test.ts with
 * fabricated data, not by this corpus.
 */
export function buildGlobalSearchHarnessChats(
	size: 10_000 | 100_000 | 250_000 | 1_000_000,
): ChatData[] {
	const dataset = createGlobalSearchSyntheticDataset({ size });
	const messagesByArchive = new Map<
		string,
		{ title: string; messages: ChatMessage[] }
	>();

	for (const message of iterateGlobalSearchSyntheticMessages(dataset)) {
		const entry = messagesByArchive.get(message.archiveId) ?? {
			title: message.chatTitle,
			messages: [],
		};
		entry.messages.push({
			id: message.messageId,
			timestamp:
				message.timestamp === null ? new Date(0) : new Date(message.timestamp),
			sender: message.sender,
			content: message.content,
			isSystemMessage: false,
			isMediaMessage: false,
			rawLine: '',
		});
		messagesByArchive.set(message.archiveId, entry);
	}

	return [...messagesByArchive.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([archiveId, entry]) => {
			const timestamps = entry.messages
				.map((message) => message.timestamp.getTime())
				.filter((value) => value !== 0);
			return {
				archiveId,
				title: entry.title,
				messages: entry.messages,
				participants: [
					...new Set(entry.messages.map((message) => message.sender)),
				],
				startDate:
					timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null,
				endDate:
					timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null,
				messageCount: entry.messages.length,
				mediaCount: 0,
				mediaFiles: [],
				hasMedia: false,
				contacts: new Map(),
			};
		});
}

export type GlobalSearchHarnessRunTiming = {
	/** performance.now() when the real submitQuery was entered. */
	submitMs: number;
	/** submit → first `shard` posted (main-thread corpus prep). */
	indexingMs: number;
	/** first `shard` posted → first worker `progress` (worker first response). */
	firstPageMs: number;
	/** submit → terminal `complete` (or `cancelled` for a cancelled run). */
	totalMs: number;
	cancelled: boolean;
	/** cancel requested → worker `cancelled` terminal; null when not cancelled. */
	cancellationMs: number | null;
	shardCount: number;
	progressCount: number;
	/** Result total matches reported by the worker terminal message. */
	totalMatches: number | null;
};

export type GlobalSearchHarnessMemory = {
	available: boolean;
	measureUasBytes: number | null;
	jsHeapUsedBytes: number | null;
	reason: string | null;
};

export type GlobalSearchHarnessWindowApi = {
	readonly seed: typeof GLOBAL_SEARCH_SYNTHETIC_SEED;
	/** True when the real dedicated worker transport was created. */
	readonly workerUsed: boolean;
	/** Inject the deterministic corpus through the real app state. */
	loadCorpus(
		size: 10_000 | 100_000 | 250_000 | 1_000_000,
	): Promise<GlobalSearchHarnessChatsSummary>;
	/** Remove every injected corpus chat, restoring the pre-corpus state. */
	clearCorpus(): Promise<{ removedArchives: number }>;
	/** Reset the timing tap so the next query is measured as a fresh run. */
	beginRun(): void;
	/** Timing of the most recent run, or null before any run completed. */
	getLastRun(): GlobalSearchHarnessRunTiming | null;
	/**
	 * Drop the prepared-source cache so the NEXT query runs the cold prep
	 * path. Used by the runner to give the cancellation observation sample a
	 * deterministic long-running scan window (a warm replay would finish
	 * before the mid-scan cancel click could land). Harness-only: this bridge
	 * is installed solely under VITE_GLOBAL_SEARCH_HARNESS=1, never in
	 * normal or distributed builds.
	 */
	dropPreparedSources(): void;
	getLongTasks(): {
		maxMs: number;
		observed: boolean;
		available: boolean;
		reason: string | null;
	};
	resetLongTasks(): void;
	getMemory(): Promise<GlobalSearchHarnessMemory>;
};

declare global {
	interface Window {
		__gh67GlobalSearchHarness?: GlobalSearchHarnessWindowApi;
	}
}

export type GlobalSearchHarnessTransport = {
	/** True only when the wrapped transport is the real dedicated Worker. */
	readonly workerUsed: boolean;
	tap: {
		submitMs: number | null;
		firstShardMs: number | null;
		firstProgressMs: number | null;
		completeMs: number | null;
		cancelledMs: number | null;
		cancelRequestedMs: number | null;
		shardCount: number;
		progressCount: number;
		totalMatches: number | null;
	};
	transport: GlobalSearchTransport;
	resetRun(): void;
};

/**
 * Wrap the REAL dedicated worker transport with a timing tap. Messages flow to
 * and from the actual worker untouched; the tap only records markers.
 * `workerUsed` is derived from the transport's `kind` marker: a loopback or
 * mock substitution never carries it, so the report's `realWorker` gate and
 * the browser integration test both fail on such a mutation.
 */
export function createGlobalSearchHarnessTransport(
	inner: GlobalSearchTransport = createWorkerTransport(),
): GlobalSearchHarnessTransport {
	const workerUsed = inner.kind === 'worker';
	const tap: GlobalSearchHarnessTransport['tap'] = {
		submitMs: null,
		firstShardMs: null,
		firstProgressMs: null,
		completeMs: null,
		cancelledMs: null,
		cancelRequestedMs: null,
		shardCount: 0,
		progressCount: 0,
		totalMatches: null,
	};

	function resetRun(): void {
		tap.submitMs = null;
		tap.firstShardMs = null;
		tap.firstProgressMs = null;
		tap.completeMs = null;
		tap.cancelledMs = null;
		tap.cancelRequestedMs = null;
		tap.shardCount = 0;
		tap.progressCount = 0;
		tap.totalMatches = null;
	}

	return {
		workerUsed,
		tap,
		transport: {
			post(input: GlobalSearchWorkerInput) {
				if (input.type === 'shard') {
					tap.shardCount += 1;
					if (tap.firstShardMs === null) tap.firstShardMs = performance.now();
				}
				inner.post(input);
			},
			onMessage(handler) {
				inner.onMessage((output: GlobalSearchWorkerOutput) => {
					if (output.type === 'progress') {
						tap.progressCount += 1;
						if (tap.firstProgressMs === null) {
							tap.firstProgressMs = performance.now();
						}
					} else if (output.type === 'complete') {
						if (tap.completeMs === null) tap.completeMs = performance.now();
						tap.totalMatches = output.result.totalMatches;
					} else if (output.type === 'cancelled') {
						if (tap.cancelledMs === null) tap.cancelledMs = performance.now();
					}
					handler(output);
				});
			},
		},
		resetRun,
	};
}

export type GlobalSearchHarnessBridgeOptions = {
	state: GlobalSearchState;
	harness: GlobalSearchHarnessTransport;
	addChat: (chat: ChatData) => void;
	removeChatAt: (index: number) => void;
	getChatCount: () => number;
};

/**
 * Install the `window.__gh67GlobalSearchHarness` bridge. Wraps the REAL
 * submitQuery/cancel to record `performance.now()` at entry; every wrapped call
 * delegates to the original implementation (the real UI/worker path).
 */
export function installGlobalSearchHarnessWindowApi(
	options: GlobalSearchHarnessBridgeOptions,
): GlobalSearchHarnessWindowApi {
	const { state, harness } = options;
	let baseChatCount = 0;
	let longTaskMaxMs = 0;
	let longTaskObserved = false;
	// The observer's REGISTRATION is a capability, separate from whether any
	// long task was observed: zero long tasks is §10.11 compliance, while a
	// failed registration makes the metric honestly unavailable.
	let longTaskObserverAvailable = false;
	let longTaskObserverReason: string | null = null;
	let observer: PerformanceObserver | null = null;

	const originalSubmit = state.submitQuery;
	const originalCancel = state.cancel;
	state.submitQuery = (rawQuery: string) => {
		if (harness.tap.submitMs === null) harness.tap.submitMs = performance.now();
		return originalSubmit(rawQuery);
	};
	state.cancel = () => {
		if (harness.tap.cancelRequestedMs === null) {
			harness.tap.cancelRequestedMs = performance.now();
		}
		originalCancel();
	};

	if (typeof PerformanceObserver === 'undefined') {
		longTaskObserverReason =
			'PerformanceObserver API absent — marked unavailable, not invented';
	} else {
		try {
			observer = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					longTaskObserved = true;
					longTaskMaxMs = Math.max(longTaskMaxMs, entry.duration);
				}
			});
			observer.observe({ type: 'longtask', buffered: true });
			longTaskObserverAvailable = true;
		} catch {
			observer = null;
			longTaskObserverReason =
				'PerformanceObserver could not observe longtask entries — marked unavailable, not invented';
		}
	}

	const api: GlobalSearchHarnessWindowApi = {
		seed: GLOBAL_SEARCH_SYNTHETIC_SEED,
		workerUsed: harness.workerUsed,
		async loadCorpus(size) {
			baseChatCount = options.getChatCount();
			const chats = buildGlobalSearchHarnessChats(size);
			let searchableBytes = 0;
			for (const chat of chats) {
				options.addChat(chat);
				searchableBytes += chat.messages.reduce((sum, message) => {
					return (
						sum +
						new TextEncoder().encode(
							`${message.sender}\u0000${message.content}`,
						).length
					);
				}, 0);
				// Yield so the injected corpus never blocks the main thread in
				// one unbounded task (the query-phase prep is measured
				// separately by the indexing gate).
				await new Promise<void>((resolve) => setTimeout(resolve, 0));
			}
			return {
				archiveCount: chats.length,
				messageCount: chats.reduce(
					(sum, chat) => sum + chat.messages.length,
					0,
				),
				searchableBytes,
			};
		},
		async clearCorpus() {
			let removed = 0;
			while (options.getChatCount() > baseChatCount) {
				options.removeChatAt(options.getChatCount() - 1);
				removed += 1;
			}
			return { removedArchives: removed };
		},
		beginRun() {
			harness.resetRun();
		},
		dropPreparedSources() {
			options.state.dropPreparedSourcesCache();
		},
		getLastRun() {
			const { tap } = harness;
			if (tap.submitMs === null || tap.firstShardMs === null) return null;
			const cancelled = tap.cancelledMs !== null;
			const terminalMs = cancelled ? tap.cancelledMs : tap.completeMs;
			if (terminalMs === null) return null;
			return {
				submitMs: tap.submitMs,
				indexingMs: tap.firstShardMs - tap.submitMs,
				firstPageMs:
					tap.firstProgressMs === null
						? 0
						: tap.firstProgressMs - tap.firstShardMs,
				totalMs: terminalMs - tap.firstShardMs,
				cancelled,
				cancellationMs:
					cancelled && tap.cancelRequestedMs !== null
						? tap.cancelledMs! - tap.cancelRequestedMs
						: null,
				shardCount: tap.shardCount,
				progressCount: tap.progressCount,
				totalMatches: tap.totalMatches,
			};
		},
		getLongTasks() {
			return {
				maxMs: longTaskMaxMs,
				observed: longTaskObserved,
				available: longTaskObserverAvailable,
				reason: longTaskObserverReason,
			};
		},
		resetLongTasks() {
			longTaskMaxMs = 0;
			longTaskObserved = false;
		},
		async getMemory() {
			const memoryApi = performance as unknown as {
				measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
				memory?: { usedJSHeapSize: number };
			};
			try {
				if (memoryApi.measureUserAgentSpecificMemory) {
					const estimate = await memoryApi.measureUserAgentSpecificMemory();
					return {
						available: true,
						measureUasBytes: estimate.bytes,
						jsHeapUsedBytes: memoryApi.memory?.usedJSHeapSize ?? null,
						reason: null,
					};
				}
				if (memoryApi.memory) {
					return {
						available: true,
						measureUasBytes: null,
						jsHeapUsedBytes: memoryApi.memory.usedJSHeapSize,
						reason: null,
					};
				}
			} catch {
				// Fall through to unavailable — never invent a value.
			}
			return {
				available: false,
				measureUasBytes: null,
				jsHeapUsedBytes: null,
				reason:
					'measureUserAgentSpecificMemory API absent — marked unavailable, not invented',
			};
		},
	};

	window.__gh67GlobalSearchHarness = api;
	return api;
}

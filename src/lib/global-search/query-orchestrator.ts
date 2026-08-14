/**
 * GH-67 §7 — Main-thread streaming query client.
 *
 * This is the UI-facing half of the approved 4B worker/controller contract. The
 * worker runs `createGlobalSearchWorkerController` and expects the caller to
 * drive the protocol strictly: `start`, then one `shard` per archive at a time
 * (awaiting each `shard-consumed` before the next), then `complete`. This module
 * implements exactly that protocol over an injectable transport so the rune
 * state can be tested without a real `Worker`.
 *
 * Responsibilities:
 *  - never hold a full corpus: one shard is in flight at a time and the caller
 *    releases each shard array before the next is produced;
 *  - route `progress` messages to the caller and surface the final result;
 *  - support cancellation (the latest requestId wins; a cancelled request
 *    returns a cancelled result and never updates the UI).
 */

import type {
	GlobalSearchWorkerInput,
	GlobalSearchWorkerOutput,
} from '../workers/global-search-worker';
import type { GlobalSearchDocument } from './manifest';
import type {
	GlobalSearchQueryProgress,
	GlobalSearchQueryRequest,
	GlobalSearchQueryResult,
} from './query-worker';

export type GlobalSearchTransport = {
	post(input: GlobalSearchWorkerInput): void;
	onMessage(handler: (output: GlobalSearchWorkerOutput) => void): void;
};

export type GlobalSearchSource = {
	archiveId: string;
	chatTitle: string;
	/** Yields shards (arrays of ≤2,000 docs / ≤1 MiB) one at a time. */
	shards(): AsyncIterable<readonly GlobalSearchDocument[]>;
};

export type GlobalSearchRunProgress = (
	progress: GlobalSearchQueryProgress,
) => void;

function cancelledQueryResult(
	request: GlobalSearchQueryRequest,
): GlobalSearchQueryResult {
	return {
		requestId: request.requestId,
		queryEmpty: request.query.length === 0,
		cancelled: true,
		overLimit: false,
		totalMatches: 0,
		results: [],
		pages: 0,
		truncated: false,
	};
}

function createMessageQueue(transport: GlobalSearchTransport) {
	const queue: GlobalSearchWorkerOutput[] = [];
	let wake: (() => void) | null = null;

	transport.onMessage((message) => {
		queue.push(message);
		wake?.();
	});

	async function next(
		requestId: string,
		predicate: (message: GlobalSearchWorkerOutput) => boolean,
		onProgress?: GlobalSearchRunProgress,
	): Promise<GlobalSearchWorkerOutput> {
		for (;;) {
			// Prefer a matching non-progress message already buffered.
			const matchIndex = queue.findIndex(
				(message) =>
					message.type !== 'progress' &&
					messageMatchesRequest(message, requestId) &&
					predicate(message),
			);
			if (matchIndex !== -1) {
				return queue.splice(matchIndex, 1)[0];
			}

			// Drain progress messages and forward them.
			for (let index = queue.length - 1; index >= 0; index -= 1) {
				if (queue[index].type === 'progress') {
					const progress = queue.splice(index, 1)[0];
					if (
						progress.type === 'progress' &&
						progress.requestId === requestId &&
						onProgress
					) {
						onProgress(progress.progress);
					}
				}
			}

			// Drop stale terminal messages for other requests so the buffer
			// cannot grow without bound during long, chained query sessions.
			for (let index = queue.length - 1; index >= 0; index -= 1) {
				if (queue[index].type !== 'progress' && !predicate(queue[index])) {
					queue.splice(index, 1);
				}
			}

			await new Promise<void>((resolve) => {
				wake = () => {
					wake = null;
					resolve();
				};
			});
		}
	}

	return { next };
}

function messageMatchesRequest(
	message: GlobalSearchWorkerOutput,
	requestId: string,
): boolean {
	// `complete` carries no requestId (the worker only emits it for the
	// current request); every other message carries one and must match.
	return !('requestId' in message) || message.requestId === requestId;
}

export type GlobalSearchQueryClient = {
	run(
		request: GlobalSearchQueryRequest,
		sources: readonly GlobalSearchSource[],
		onProgress?: GlobalSearchRunProgress,
	): Promise<GlobalSearchQueryResult>;
	/** Cancel the in-flight request. Safe to call when nothing is running. */
	cancel(requestId: string): void;
	/**
	 * Drop an archive from the in-flight request and every later request. The
	 * worker's controller owns the removed set, so this survives runner
	 * recreation (spec §7 `removeArchive`).
	 */
	removeArchive(archiveId: string): void;
};

export function createGlobalSearchQueryClient(
	transport: GlobalSearchTransport,
): GlobalSearchQueryClient {
	const queue = createMessageQueue(transport);
	let cancelled = false;

	return {
		async run(request, sources, onProgress) {
			cancelled = false;
			transport.post({ type: 'start', request });

			feed: for (const source of sources) {
				for await (const documents of source.shards()) {
					if (cancelled) break feed;

					transport.post({
						type: 'shard',
						requestId: request.requestId,
						archiveId: source.archiveId,
						documents: documents as GlobalSearchDocument[],
					});

					const outcome = await queue.next(
						request.requestId,
						(message) =>
							message.type === 'shard-consumed' ||
							message.type === 'cancelled' ||
							message.type === 'complete',
						onProgress,
					);

					if (outcome.type === 'cancelled') {
						cancelled = true;
						break feed;
					}
					if (cancelled) break feed;
				}
			}

			// Always post `complete` so the worker flushes a terminal message,
			// even when we cancelled mid-scan.
			transport.post({ type: 'complete', requestId: request.requestId });

			const terminal = await queue.next(
				request.requestId,
				(message) =>
					message.type === 'complete' || message.type === 'cancelled',
				onProgress,
			);

			if (terminal.type !== 'complete') {
				return cancelledQueryResult(request);
			}
			return terminal.result;
		},

		cancel(requestId: string) {
			cancelled = true;
			transport.post({ type: 'cancel', requestId });
		},

		removeArchive(archiveId: string) {
			transport.post({ type: 'remove-archive', archiveId });
		},
	};
}

/**
 * Default production transport: a dedicated module worker running the approved
 * streaming controller. Tests inject a loopback transport instead so no real
 * worker is spawned under vitest.
 */
export function createWorkerTransport(): GlobalSearchTransport {
	const worker = new Worker(
		new URL('../workers/global-search-worker.ts', import.meta.url),
		{ type: 'module' },
	);
	return {
		post(input) {
			worker.postMessage(input);
		},
		onMessage(handler) {
			worker.onmessage = (event: MessageEvent<GlobalSearchWorkerOutput>) => {
				handler(event.data);
			};
		},
	};
}

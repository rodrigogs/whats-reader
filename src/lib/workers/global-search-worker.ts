import type { GlobalSearchDocument } from '../global-search/manifest';
import {
	createGlobalSearchQueryRunner,
	type GlobalSearchQueryProgress,
	type GlobalSearchQueryRequest,
	type GlobalSearchQueryResult,
	type GlobalSearchShardOutcome,
	serializedShardBytes,
	yieldToEventLoop,
} from '../global-search/query-worker';
import { SHARD_MAX_BYTES, SHARD_MAX_DOCUMENTS } from '../global-search/shard';

export type GlobalSearchWorkerInput =
	| { type: 'start'; request: GlobalSearchQueryRequest }
	| {
			type: 'shard';
			requestId: string;
			archiveId: string;
			documents: readonly GlobalSearchDocument[];
	  }
	| { type: 'complete'; requestId: string }
	| { type: 'cancel'; requestId: string }
	| { type: 'remove-archive'; archiveId: string };

export type GlobalSearchWorkerOutput =
	| {
			type: 'progress';
			requestId: string;
			progress: GlobalSearchQueryProgress;
	  }
	| {
			type: 'shard-consumed';
			requestId: string;
			outcome: GlobalSearchShardOutcome;
	  }
	| { type: 'complete'; result: GlobalSearchQueryResult }
	| { type: 'cancelled'; requestId: string };

type QueryRunner = ReturnType<typeof createGlobalSearchQueryRunner>;

type ControllerOptions = {
	/** Real macrotask yield; tests and production share the same default. */
	yieldControl?: () => Promise<void>;
};

/**
 * Streaming controller for the dedicated global-search worker. The caller owns
 * shard reads and sends one archive shard only after the previous response.
 * This module never accepts a complete archive/corpus replacement.
 *
 * Archive removal is controller-owned: `removedArchiveIds` survives `start()`,
 * so a removal in one request stays effective for every later request.
 */
export function createGlobalSearchWorkerController(
	post: (message: GlobalSearchWorkerOutput) => void,
	options: ControllerOptions = {},
) {
	let currentRequestId: string | undefined;
	let runner: QueryRunner | undefined;
	let shardInFlight = false;
	let cancellationPosted = false;
	const removedArchiveIds = new Set<string>();
	const yieldControl = options.yieldControl ?? yieldToEventLoop;

	function start(request: GlobalSearchQueryRequest): void {
		runner?.cancel();
		currentRequestId = request.requestId;
		cancellationPosted = false;
		shardInFlight = false;
		runner = createGlobalSearchQueryRunner(request, {
			yieldControl,
			// The controller-owned set survives `start()`, so a removal in one
			// request stays effective for every later request and every new runner.
			removedArchiveIds,
			onProgress: (progress) => {
				if (currentRequestId === request.requestId) {
					post({ type: 'progress', requestId: request.requestId, progress });
				}
			},
		});
	}

	function cancel(requestId: string): void {
		if (requestId !== currentRequestId) return;
		runner?.cancel();
	}

	async function consumeShard(
		requestId: string,
		archiveId: string,
		documents: readonly GlobalSearchDocument[],
	): Promise<GlobalSearchShardOutcome> {
		if (requestId !== currentRequestId || !runner) return 'ignored';
		if (shardInFlight) {
			post({ type: 'shard-consumed', requestId, outcome: 'rejected' });
			return 'rejected';
		}
		if (
			documents.length > SHARD_MAX_DOCUMENTS ||
			serializedShardBytes(documents) > SHARD_MAX_BYTES
		) {
			post({ type: 'shard-consumed', requestId, outcome: 'rejected' });
			return 'rejected';
		}
		shardInFlight = true;
		try {
			const outcome = await runner.consumeShard(archiveId, documents);
			if (requestId === currentRequestId) {
				post({ type: 'shard-consumed', requestId, outcome });
				if (outcome === 'cancelled') postCancelled(requestId);
			}
			return outcome;
		} finally {
			shardInFlight = false;
		}
	}

	function postCancelled(requestId: string): void {
		if (cancellationPosted) return;
		cancellationPosted = true;
		post({ type: 'cancelled', requestId });
	}

	function complete(requestId: string): void {
		if (requestId !== currentRequestId || !runner) return;
		const result = runner.complete();
		if (requestId !== currentRequestId) return;
		if (result.cancelled) {
			postCancelled(requestId);
			return;
		}
		post({ type: 'complete', result });
	}

	function removeArchive(archiveId: string): void {
		removedArchiveIds.add(archiveId);
		runner?.removeArchive(archiveId);
	}

	async function handle(input: GlobalSearchWorkerInput): Promise<void> {
		switch (input.type) {
			case 'start':
				start(input.request);
				break;
			case 'cancel':
				cancel(input.requestId);
				break;
			case 'remove-archive':
				removeArchive(input.archiveId);
				break;
			case 'shard':
				await consumeShard(input.requestId, input.archiveId, input.documents);
				break;
			case 'complete':
				complete(input.requestId);
				break;
		}
	}

	return { start, cancel, consumeShard, complete, removeArchive, handle };
}

const workerScope = typeof self === 'undefined' ? undefined : self;
if (workerScope && 'postMessage' in workerScope) {
	const controller = createGlobalSearchWorkerController((message) => {
		workerScope.postMessage(message);
	});
	workerScope.onmessage = (event: MessageEvent<GlobalSearchWorkerInput>) => {
		void controller.handle(event.data);
	};
}

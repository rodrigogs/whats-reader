import { describe, expect, it } from 'vitest';
import type { GlobalSearchDocument } from './manifest';
import {
	createGlobalSearchQueryRunner,
	GLOBAL_SEARCH_MAX_CHATS,
	GLOBAL_SEARCH_MAX_CORPUS_MESSAGES,
	GLOBAL_SEARCH_MAX_SEARCHABLE_BYTES,
	GLOBAL_SEARCH_PAGE_SIZE,
	GLOBAL_SEARCH_STREAMING_MESSAGE_THRESHOLD,
	type GlobalSearchQueryRequest,
} from './query-worker';
import { SHARD_MAX_BYTES, SHARD_MAX_DOCUMENTS } from './shard';

function document(
	archiveId: string,
	ordinal: number,
	options: Partial<GlobalSearchDocument> = {},
): GlobalSearchDocument {
	return {
		archiveId,
		ordinal,
		messageId: options.messageId ?? `shared-${ordinal}`,
		timestamp: options.timestamp ?? ordinal,
		sender: options.sender ?? 'Ana',
		content: options.content ?? 'plain content',
		...options,
	};
}

function request(
	overrides: Partial<GlobalSearchQueryRequest> = {},
): GlobalSearchQueryRequest {
	return {
		requestId: 'request-1',
		query: 'needle',
		filters: {},
		...overrides,
	};
}

/** JSON overhead (bytes) of a serialized one-document shard beyond `content`. */
function serializedOverhead(): number {
	const probe = JSON.stringify([document('a1', 0, { content: 'x' })]);
	return probe.length - 1;
}

function needleShard(
	archiveId: string,
	count: number,
	startOrdinal = 0,
): GlobalSearchDocument[] {
	return Array.from({ length: count }, (_, index) =>
		document(archiveId, startOrdinal + index, { content: 'needle' }),
	);
}

describe('GH-67 global streaming query contract', () => {
	it('matches literal case-insensitive content and sender without accent folding', async () => {
		const runner = createGlobalSearchQueryRunner(request());
		await runner.consumeShard('a1', [
			document('a1', 0, { content: 'NeedLe in content' }),
			document('a1', 1, { sender: 'needle sender' }),
			document('a1', 2, { content: 'NEEDLE only' }),
			document('a1', 3, { content: 'nëedle is different' }),
		]);

		const result = runner.complete();
		expect(result.totalMatches).toBe(3);
		expect(result.results.map((entry) => entry.ordinal)).toEqual([2, 1, 0]);
		expect(result.results.every((entry) => entry.archiveId === 'a1')).toBe(
			true,
		);
		expect(
			result.results.every((entry) => entry.messageId.startsWith('shared-')),
		).toBe(true);
	});

	it('combines filter groups with AND and values inside each group with OR', async () => {
		const runner = createGlobalSearchQueryRunner(
			request({
				filters: {
					archiveIds: ['a1', 'a2'],
					senders: ['ana', 'bruno'],
					dateRanges: [
						{ from: 10, to: 20 },
						{ from: 40, to: 50 },
					],
				},
			}),
		);
		await runner.consumeShard('a1', [
			document('a1', 0, { sender: 'Ana', content: 'needle', timestamp: 15 }),
			document('a1', 1, { sender: 'Carla', content: 'needle', timestamp: 15 }),
			document('a1', 2, { sender: 'Bruno', content: 'needle', timestamp: 30 }),
			document('a1', 3, { sender: 'Bruno', content: 'needle', timestamp: 45 }),
		]);
		await runner.consumeShard('a3', [
			document('a3', 0, { sender: 'Ana', content: 'needle', timestamp: 15 }),
		]);

		expect(runner.complete().results.map((entry) => entry.ordinal)).toEqual([
			3, 0,
		]);
	});

	it('orders collisions by date descending, title, archiveId and ordinal then pages at 50', async () => {
		const runner = createGlobalSearchQueryRunner(
			request({ archiveTitles: { a1: 'Same', a2: 'Same', a3: 'Zulu' } }),
		);
		await runner.consumeShard('a2', [
			document('a2', 1, { content: 'needle', timestamp: 10 }),
		]);
		await runner.consumeShard('a1', [
			document('a1', 2, { content: 'needle', timestamp: 10 }),
			document('a1', 1, { content: 'needle', timestamp: 10 }),
		]);
		await runner.consumeShard('a3', [
			document('a3', 0, { content: 'needle', timestamp: 10 }),
		]);
		await runner.consumeShard(
			'a1',
			Array.from({ length: 50 }, (_, ordinal) =>
				document('a1', ordinal + 100, { content: 'needle', timestamp: 9 }),
			),
		);

		const result = runner.complete();
		expect(GLOBAL_SEARCH_PAGE_SIZE).toBe(50);
		expect(
			result.results
				.slice(0, 4)
				.map((entry) => [entry.archiveId, entry.ordinal]),
		).toEqual([
			['a1', 1],
			['a1', 2],
			['a2', 1],
			['a3', 0],
		]);
		expect(result.pages).toBe(2);
		expect(result.results).toHaveLength(54);
	});

	it('returns coverage instead of documents for an empty query', async () => {
		const runner = createGlobalSearchQueryRunner(request({ query: '' }));
		await runner.consumeShard('a1', [document('a1', 0, { content: 'needle' })]);
		expect(runner.complete()).toMatchObject({
			totalMatches: 0,
			results: [],
			queryEmpty: true,
		});
	});

	it('discards each scanned shard and caps navigable results at 1,000 while retaining total', async () => {
		const runner = createGlobalSearchQueryRunner(request());
		await runner.consumeShard(
			'a1',
			Array.from({ length: 1_001 }, (_, ordinal) =>
				document('a1', ordinal, { content: 'needle', timestamp: ordinal }),
			),
		);
		const result = runner.complete();
		expect(result.totalMatches).toBe(1_001);
		expect(result.results).toHaveLength(1_000);
		expect(result.truncated).toBe(true);
		expect(runner.residentDocumentCount()).toBe(0);
	});

	it('yields to an external cancel during a long shard scan with the real macrotask yield', async () => {
		const runner = createGlobalSearchQueryRunner(request());
		// The external cancel is queued BEFORE the scan starts so the macrotask
		// fires while the scan is suspended at the 2,000-doc checkpoint. No
		// injected callback anywhere — this is the production default yield.
		setTimeout(() => runner.cancel(), 0);
		const outcome = await runner.consumeShard('a1', needleShard('a1', 2_000));
		expect(outcome).toBe('cancelled');
		expect(runner.complete()).toMatchObject({ cancelled: true, results: [] });
	});

	it('invalidates prior results and rejects later shards after archive removal', async () => {
		const runner = createGlobalSearchQueryRunner(request());
		await runner.consumeShard('removed', [
			document('removed', 0, { content: 'needle' }),
		]);
		runner.removeArchive('removed');
		expect(
			await runner.consumeShard('removed', [
				document('removed', 1, { content: 'needle' }),
			]),
		).toBe('ignored');
		expect(runner.complete()).toMatchObject({ totalMatches: 0, results: [] });
	});

	it('reports cancellable progress for one-character queries over 100k documents', async () => {
		const { createGlobalSearchWorkerController } = await import(
			'../workers/global-search-worker'
		);
		const progress: Array<{
			degraded: boolean;
			streaming: boolean;
			scannedDocuments: number;
		}> = [];
		const controller = createGlobalSearchWorkerController((message) => {
			if (message.type === 'progress') progress.push(message.progress);
		});
		controller.start(request({ query: 'n', corpusMessageCount: 100_001 }));
		await controller.consumeShard('request-1', 'a1', [
			document('a1', 0, { content: 'needle' }),
		]);
		expect(progress).toEqual([
			{ degraded: true, streaming: false, scannedDocuments: 1 },
		]);
	});

	it('only publishes the newest request after a newer request supersedes it', async () => {
		const { createGlobalSearchWorkerController } = await import(
			'../workers/global-search-worker'
		);
		const published: string[] = [];
		const controller = createGlobalSearchWorkerController((message) => {
			if (message.type === 'complete') published.push(message.result.requestId);
		});
		controller.start(request({ requestId: 'old' }));
		controller.start(request({ requestId: 'new' }));
		await controller.consumeShard('old', 'a1', [
			document('a1', 0, { content: 'needle' }),
		]);
		await controller.consumeShard('new', 'a1', [
			document('a1', 0, { content: 'needle' }),
		]);
		controller.complete('old');
		controller.complete('new');
		expect(published).toEqual(['new']);
	});

	it('keeps archive removal across requests: the controller-owned set survives start()', async () => {
		const { createGlobalSearchWorkerController } = await import(
			'../workers/global-search-worker'
		);
		const controller = createGlobalSearchWorkerController(() => {});
		controller.start(request({ requestId: 'r1' }));
		await controller.consumeShard('r1', 'a1', [
			document('a1', 0, { content: 'needle' }),
		]);
		controller.removeArchive('a1');
		controller.start(request({ requestId: 'r2' }));
		const outcome = await controller.consumeShard('r2', 'a1', [
			document('a1', 1, { content: 'needle' }),
		]);
		expect(outcome).toBe('ignored');
	});

	it('controller yields to an external cancel MessageEvent and acknowledges it', async () => {
		const { createGlobalSearchWorkerController } = await import(
			'../workers/global-search-worker'
		);
		const posts: string[] = [];
		const controller = createGlobalSearchWorkerController((message) => {
			posts.push(message.type);
		});
		controller.start(request({ requestId: 'r1' }));
		// The external cancel is queued before the shard so it interleaves at
		// the real macrotask checkpoint — an injected callback would not prove
		// that external MessageEvents can interleave.
		setTimeout(() => controller.cancel('r1'), 0);
		const outcome = await controller.consumeShard(
			'r1',
			'a1',
			needleShard('a1', 2_000),
		);
		expect(outcome).toBe('cancelled');
		expect(posts).toContain('cancelled');
		expect(posts).not.toContain('complete');
	});

	it('rejects a shard over 2,000 documents fail-closed in the runner', async () => {
		const runner = createGlobalSearchQueryRunner(request());
		expect(
			await runner.consumeShard(
				'a1',
				needleShard('a1', SHARD_MAX_DOCUMENTS + 1),
			),
		).toBe('rejected');
		expect(runner.residentDocumentCount()).toBe(0);
		expect(runner.complete()).toMatchObject({ totalMatches: 0, results: [] });
	});

	it('accepts a shard at exactly 2,000 documents', async () => {
		const runner = createGlobalSearchQueryRunner(request());
		expect(
			await runner.consumeShard('a1', needleShard('a1', SHARD_MAX_DOCUMENTS)),
		).toBe('accepted');
	});

	it('rejects a shard whose serialized size exceeds 1 MiB fail-closed in the runner', async () => {
		const runner = createGlobalSearchQueryRunner(request());
		// One payload byte over the exact 1 MiB boundary.
		const contentLength = SHARD_MAX_BYTES - serializedOverhead();
		expect(
			await runner.consumeShard('a1', [
				document('a1', 0, { content: 'x'.repeat(contentLength + 1) }),
			]),
		).toBe('rejected');
		expect(runner.residentDocumentCount()).toBe(0);
	});

	it('accepts a shard whose serialized size is exactly 1 MiB', async () => {
		const runner = createGlobalSearchQueryRunner(request());
		const contentLength = SHARD_MAX_BYTES - serializedOverhead();
		const serialized = JSON.stringify([
			document('a1', 0, { content: 'x'.repeat(contentLength) }),
		]);
		expect(new TextEncoder().encode(serialized).length).toBe(SHARD_MAX_BYTES);
		expect(
			await runner.consumeShard('a1', [
				document('a1', 0, { content: 'x'.repeat(contentLength) }),
			]),
		).toBe('accepted');
	});

	it('rejects a second shard while another is still resident (concurrent reentrancy)', async () => {
		const runner = createGlobalSearchQueryRunner(request());
		// First shard is within budget but suspends at the index-0 checkpoint.
		const first = runner.consumeShard('a1', needleShard('a1', 2_000));
		const second = await runner.consumeShard('a2', [
			document('a2', 0, { content: 'needle' }),
		]);
		expect(second).toBe('rejected');
		await first;
		expect(runner.residentDocumentCount()).toBe(0);
	});

	it('controller rejects oversized and concurrent shards fail-closed', async () => {
		const { createGlobalSearchWorkerController } = await import(
			'../workers/global-search-worker'
		);
		const outcomes: string[] = [];
		const controller = createGlobalSearchWorkerController((message) => {
			if (message.type === 'shard-consumed') outcomes.push(message.outcome);
		});
		controller.start(request({ requestId: 'r1' }));
		expect(
			await controller.consumeShard(
				'r1',
				'a1',
				needleShard('a1', SHARD_MAX_DOCUMENTS + 1),
			),
		).toBe('rejected');
		// First shard is within budget but suspends at the checkpoint, keeping
		// the controller's in-flight guard active while the second is sent.
		const first = controller.consumeShard('r1', 'a1', needleShard('a1', 2_000));
		expect(
			await controller.consumeShard('r1', 'a2', [
				document('a2', 0, { content: 'needle' }),
			]),
		).toBe('rejected');
		await first;
		expect(outcomes.filter((outcome) => outcome === 'rejected').length).toBe(2);
	});

	it('emits an explicit cancellation acknowledgement when complete arrives on a cancelled request', async () => {
		const { createGlobalSearchWorkerController } = await import(
			'../workers/global-search-worker'
		);
		const posts: Array<{ type: string }> = [];
		const controller = createGlobalSearchWorkerController((message) => {
			posts.push(message);
		});
		controller.start(request({ requestId: 'r1' }));
		controller.cancel('r1');
		controller.complete('r1');
		expect(posts.some((message) => message.type === 'cancelled')).toBe(true);
		expect(posts.some((message) => message.type === 'complete')).toBe(false);
	});

	it('fails closed for a request declaring more than 1M corpus messages', async () => {
		const runner = createGlobalSearchQueryRunner(
			request({ corpusMessageCount: GLOBAL_SEARCH_MAX_CORPUS_MESSAGES + 1 }),
		);
		expect(
			await runner.consumeShard('a1', [
				document('a1', 0, { content: 'needle' }),
			]),
		).toBe('rejected');
		expect(runner.complete()).toMatchObject({ overLimit: true, results: [] });
	});

	it('marks progress as streaming above 250k messages and not below', async () => {
		const streaming: boolean[] = [];
		const runner = createGlobalSearchQueryRunner(
			request({
				corpusMessageCount: GLOBAL_SEARCH_STREAMING_MESSAGE_THRESHOLD + 1,
			}),
			{ onProgress: (progress) => streaming.push(progress.streaming) },
		);
		await runner.consumeShard('a1', [document('a1', 0, { content: 'needle' })]);
		expect(streaming).toEqual([true]);

		const quiet: boolean[] = [];
		const small = createGlobalSearchQueryRunner(
			request({
				corpusMessageCount: GLOBAL_SEARCH_STREAMING_MESSAGE_THRESHOLD,
			}),
			{ onProgress: (progress) => quiet.push(progress.streaming) },
		);
		await small.consumeShard('a1', [document('a1', 0, { content: 'needle' })]);
		expect(quiet).toEqual([false]);
	});

	it('fails closed when the request spans more than 25 chats without an explicit archive filter', async () => {
		const titles = Object.fromEntries(
			Array.from({ length: GLOBAL_SEARCH_MAX_CHATS + 1 }, (_, index) => [
				`chat-${index}`,
				`Title ${index}`,
			]),
		);
		const runner = createGlobalSearchQueryRunner(
			request({ archiveTitles: titles }),
		);
		expect(
			await runner.consumeShard('chat-0', [
				document('chat-0', 0, { content: 'needle' }),
			]),
		).toBe('rejected');
		expect(runner.complete()).toMatchObject({ overLimit: true, results: [] });
	});

	it('pins the spec envelope limits as worker-visible constants', () => {
		expect(GLOBAL_SEARCH_MAX_CHATS).toBe(25);
		expect(GLOBAL_SEARCH_MAX_SEARCHABLE_BYTES).toBe(128 * 1024 * 1024);
		expect(GLOBAL_SEARCH_STREAMING_MESSAGE_THRESHOLD).toBe(250_000);
		expect(GLOBAL_SEARCH_MAX_CORPUS_MESSAGES).toBe(1_000_000);
		expect(SHARD_MAX_DOCUMENTS).toBe(2_000);
		expect(SHARD_MAX_BYTES).toBe(1024 * 1024);
	});
});

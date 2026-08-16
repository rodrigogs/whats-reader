import { describe, expect, it } from 'vitest';
import type {
	GlobalSearchWorkerInput,
	GlobalSearchWorkerOutput,
} from '../workers/global-search-worker';
import { createGlobalSearchWorkerController } from '../workers/global-search-worker';
import type { GlobalSearchDocument } from './manifest';
import { createGlobalSearchQueryClient } from './query-orchestrator';
import type { GlobalSearchQueryRequest } from './query-worker';

/** In-memory loopback: drives the REAL worker controller over a fake transport. */
function createLoopback() {
	let handler: ((output: GlobalSearchWorkerOutput) => void) | null = null;
	const controller = createGlobalSearchWorkerController((output) => {
		setTimeout(() => handler?.(output), 0);
	});
	return {
		transport: {
			post(input: GlobalSearchWorkerInput) {
				void controller.handle(input);
			},
			onMessage(callback: (output: GlobalSearchWorkerOutput) => void) {
				handler = callback;
			},
		},
	};
}

/**
 * Recording transport: captures every posted input AND settles through the
 * real controller, so the wire shape is inspectable while results still flow.
 */
function createRecordingLoopback() {
	const posted: GlobalSearchWorkerInput[] = [];
	const inner = createLoopback();
	return {
		transport: {
			post(input: GlobalSearchWorkerInput) {
				posted.push(input);
				inner.transport.post(input);
			},
			onMessage(callback: (output: GlobalSearchWorkerOutput) => void) {
				inner.transport.onMessage(callback);
			},
		},
		posted,
	};
}

function doc(
	archiveId: string,
	ordinal: number,
	messageId: string,
	timestamp: number,
	sender: string,
	content: string,
): GlobalSearchDocument {
	return { archiveId, ordinal, messageId, timestamp, sender, content };
}

/** Pre-serialized wire payload: JSON string + exact UTF-8 byte length. */
function payload(documents: readonly GlobalSearchDocument[]): {
	documentsJson: string;
	serialisedBytes: number;
} {
	const documentsJson = JSON.stringify(documents);
	return {
		documentsJson,
		serialisedBytes: new TextEncoder().encode(documentsJson).length,
	};
}

function source(
	archiveId: string,
	chatTitle: string,
	documents: GlobalSearchDocument[],
) {
	const { documentsJson, serialisedBytes } = payload(documents);
	return {
		archiveId,
		chatTitle,
		async *shards() {
			yield { documentsJson, serialisedBytes };
		},
	};
}

function request(
	query: string,
	filters: GlobalSearchQueryRequest['filters'] = {},
	archiveTitles: Record<string, string> = {},
): GlobalSearchQueryRequest {
	return {
		requestId: crypto.randomUUID(),
		query,
		filters,
		archiveTitles,
	};
}

const alpha = [
	doc('a1', 0, 'a1-m0', 100, 'Ana', 'hello world'),
	doc('a1', 1, 'a1-m1', 200, 'Bruno', 'goodbye moon'),
	doc('a1', 2, 'a1-m2', 300, 'Ana', 'needle in a haystack'),
];

const beta = [
	doc('a2', 0, 'a2-m0', 150, 'Carla', 'the needle glows'),
	doc('a2', 1, 'a2-m1', 250, 'Ana', 'totally unrelated'),
];

describe('GH-67 streaming query client (real worker controller)', () => {
	it('posts every shard as a pre-serialized JSON string with exact byte length', async () => {
		const { transport, posted } = createRecordingLoopback();
		const client = createGlobalSearchQueryClient(transport);
		await client.run(request('needle', {}, { a1: 'Alpha' }), [
			source('a1', 'Alpha', alpha),
		]);

		const shardInputs = posted.filter(
			(input): input is Extract<GlobalSearchWorkerInput, { type: 'shard' }> =>
				input.type === 'shard',
		);
		expect(shardInputs.length).toBe(1);
		const wire = shardInputs[0];
		expect(wire).toMatchObject({ type: 'shard', archiveId: 'a1' });
		// The wire carries the pre-serialized string, never a raw object
		// array: structuredClone of one string is far cheaper than 2,000
		// objects, and the exact byte length validates the 1 MiB cap O(1).
		expect(wire.documentsJson).toBe(JSON.stringify(alpha));
		expect(wire.serialisedBytes).toBe(
			new TextEncoder().encode(wire.documentsJson).length,
		);
		expect(JSON.parse(wire.documentsJson)).toEqual(alpha);
	});

	it('streams shards from multiple archives and returns ranked results', async () => {
		const { transport } = createLoopback();
		const client = createGlobalSearchQueryClient(transport);
		const result = await client.run(
			request('needle', {}, { a1: 'Alpha', a2: 'Beta' }),
			[source('a1', 'Alpha', alpha), source('a2', 'Beta', beta)],
		);

		expect(result.cancelled).toBe(false);
		expect(result.totalMatches).toBe(2);
		expect(result.results.map((r) => r.messageId).sort()).toEqual([
			'a1-m2',
			'a2-m0',
		]);
		// Ranked by timestamp desc: a1-m2 (300) before a2-m0 (150).
		expect(result.results[0].messageId).toBe('a1-m2');
		expect(result.results[0].chatTitle).toBe('Alpha');
		expect(result.results[1].chatTitle).toBe('Beta');
	});

	it('exposes coverage only for an empty query (no messages)', async () => {
		const { transport } = createLoopback();
		const client = createGlobalSearchQueryClient(transport);
		const result = await client.run(request(''), [
			source('a1', 'Alpha', alpha),
		]);

		expect(result.queryEmpty).toBe(true);
		expect(result.results).toEqual([]);
		expect(result.totalMatches).toBe(0);
	});

	it('applies AND across groups / OR within a group', async () => {
		const { transport } = createLoopback();
		const client = createGlobalSearchQueryClient(transport);

		// archiveIds (OR within the group) intersect senders (AND across groups).
		const result = await client.run(
			request(
				'needle',
				{ archiveIds: ['a1'], senders: ['ana'] },
				{ a1: 'Alpha', a2: 'Beta' },
			),
			[source('a1', 'Alpha', alpha), source('a2', 'Beta', beta)],
		);

		// Only a1-m2 matches: needle + archive a1 + sender ana.
		expect(result.results.map((r) => r.messageId)).toEqual(['a1-m2']);
	});

	it('filters by date period', async () => {
		const { transport } = createLoopback();
		const client = createGlobalSearchQueryClient(transport);
		const result = await client.run(
			request('needle', { dateRanges: [{ from: 100, to: 199 }] }),
			[source('a2', 'Beta', beta)],
		);

		// a2-m0 at 150 is in range; a1-m2 at 300 is excluded by the range.
		expect(result.results.map((r) => r.messageId)).toEqual(['a2-m0']);
	});

	it('caps navigable results at 1,000 and reports truncation', async () => {
		const many: GlobalSearchDocument[] = Array.from(
			{ length: 1_100 },
			(_, index) =>
				doc(
					'big',
					index,
					`m-${index}`,
					1_000 + index,
					'Sender',
					`match ${index}`,
				),
		);
		const { transport } = createLoopback();
		const client = createGlobalSearchQueryClient(transport);
		const result = await client.run(request('match', {}, { big: 'Big' }), [
			source('big', 'Big', many),
		]);

		expect(result.totalMatches).toBe(1_100);
		expect(result.results).toHaveLength(1_000);
		expect(result.truncated).toBe(true);
	});

	it('deterministically orders by timestamp desc, then title, archiveId, ordinal', async () => {
		// Same timestamp, different titles and archiveIds.
		const docs: GlobalSearchDocument[] = [
			doc('a1', 1, 'x', 500, 'S', 'match'),
			doc('a2', 0, 'y', 500, 'S', 'match'),
			doc('a1', 0, 'z', 500, 'S', 'match'),
		];
		const { transport } = createLoopback();
		const client = createGlobalSearchQueryClient(transport);
		const result = await client.run(
			request('match', {}, { a1: 'Alpha', a2: 'Alpha' }),
			[
				source('a1', 'Alpha', [docs[0], docs[2]]),
				source('a2', 'Alpha', [docs[1]]),
			],
		);

		// Title 'Alpha' equal → archiveId 'a1' < 'a2' → then ordinal.
		expect(result.results.map((r) => r.messageId)).toEqual(['z', 'x', 'y']);
	});

	it('reports progress during the scan', async () => {
		const { transport } = createLoopback();
		const client = createGlobalSearchQueryClient(transport);
		const progressSeen: number[] = [];
		await client.run(request('hello'), [source('a1', 'Alpha', alpha)], (p) => {
			progressSeen.push(p.scannedDocuments);
		});

		expect(progressSeen.length).toBeGreaterThan(0);
		expect(progressSeen[progressSeen.length - 1]).toBe(3);
	});

	it('cancels an in-flight request and returns a cancelled result', async () => {
		const { transport } = createLoopback();
		const client = createGlobalSearchQueryClient(transport);
		const req = request('match');
		const run = client.run(req, [
			source(
				'big',
				'Big',
				Array.from({ length: 5_000 }, (_, index) =>
					doc('big', index, `m-${index}`, index, 'S', `match ${index}`),
				),
			),
		]);

		client.cancel(req.requestId);
		const result = await run;

		expect(result.cancelled).toBe(true);
		expect(result.results).toEqual([]);
	});
});

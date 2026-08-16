import { describe, expect, it } from 'vitest';
import { buildSessionDocuments } from './documents';
import type { GlobalSearchDocument } from './manifest';
import {
	computeGenerationChecksum,
	exceedsShardByteBudget,
	finalizeShardChecksums,
	type GlobalSearchShard,
	SHARD_MAX_BYTES,
	SHARD_MAX_DOCUMENTS,
	splitDocuments,
	splitDocumentsIncrementally,
	validateShardReadback,
} from './shard';
import {
	createGlobalSearchSyntheticDataset,
	iterateGlobalSearchSyntheticMessages,
} from './synthetic-generator';

function doc(
	ordinal: number,
	content = `message ${ordinal}`,
): GlobalSearchDocument {
	return {
		archiveId: 'a1',
		ordinal,
		messageId: `m${ordinal}`,
		timestamp: ordinal,
		sender: 'Ana',
		content,
	};
}

describe('GH-67 shard splitting contract', () => {
	it('splits at the 2000-document cap', () => {
		const docs = Array.from({ length: SHARD_MAX_DOCUMENTS + 5 }, (_, i) =>
			doc(i),
		);
		const shards = splitDocuments('a1', 1, docs);
		expect(shards).toHaveLength(2);
		expect(shards[0].documents).toHaveLength(SHARD_MAX_DOCUMENTS);
		expect(shards[1].documents).toHaveLength(5);
		expect(shards.map((s) => s.shardNo)).toEqual([0, 1]);
	});

	it('splits before exceeding the 1 MiB byte cap', async () => {
		// ~2 KiB per doc → need ~520 docs to exceed 1 MiB
		const big = 'x'.repeat(2048);
		const docs = Array.from({ length: 600 }, (_, i) => doc(i, big));
		const shards = splitDocuments('a1', 1, docs);
		expect(shards.length).toBeGreaterThan(1);
		for (const shard of shards) {
			expect(shard.documents.length).toBeLessThanOrEqual(SHARD_MAX_DOCUMENTS);
		}
		// Every shard except possibly the last must be within the byte budget;
		// no shard may exceed it.
		for (const shard of shards) {
			expect(exceedsShardByteBudget(shard.serialisedBytes)).toBe(false);
		}
	});

	it('finalizes checksums that validate on read-back', async () => {
		const docs = Array.from({ length: 10 }, (_, i) => doc(i));
		const raw = splitDocuments('a1', 1, docs);
		const finalized = await finalizeShardChecksums(raw);
		for (const shard of finalized) {
			expect(shard.checksum).toMatch(/^[0-9a-f]{64}$/);
			const ok = await validateShardReadback(shard.documents, shard.checksum);
			expect(ok).toBe(true);
		}
	});

	it('rejects read-back when documents were tampered with', async () => {
		const docs = Array.from({ length: 5 }, (_, i) => doc(i));
		const finalized = await finalizeShardChecksums(
			splitDocuments('a1', 1, docs),
		);
		const tampered = [...finalized[0].documents];
		tampered[0] = { ...tampered[0], content: 'TAMPERED' };
		const ok = await validateShardReadback(tampered, finalized[0].checksum);
		expect(ok).toBe(false);
	});

	it('rejects read-back when serialised bytes exceed the byte budget', async () => {
		const oversized = doc(0, 'x'.repeat(SHARD_MAX_BYTES + 10));
		// splitDocuments places an oversized doc in its own shard; validate
		// read-back must still reject it on the byte budget.
		const finalized = await finalizeShardChecksums(
			splitDocuments('a1', 1, [oversized]),
		);
		const ok = await validateShardReadback(
			finalized[0].documents,
			finalized[0].checksum,
		);
		expect(ok).toBe(false);
	});

	it('computes a generation checksum from ordered shard checksums', async () => {
		const docs = Array.from({ length: SHARD_MAX_DOCUMENTS + 1 }, (_, i) =>
			doc(i),
		);
		const finalized = await finalizeShardChecksums(
			splitDocuments('a1', 1, docs),
		);
		const checksum = await computeGenerationChecksum(finalized);
		expect(checksum).toMatch(/^[0-9a-f]{64}$/);

		// Reordering shards changes the generation checksum.
		const reordered = [...finalized].reverse();
		const reorderedChecksum = await computeGenerationChecksum(reordered);
		expect(reorderedChecksum).not.toBe(checksum);
	});

	it('throws when splitting an empty document set', () => {
		expect(() => splitDocuments('a1', 1, [])).toThrow();
	});
});

describe('GH-67 — pre-serialized shard wire payloads (lever 2)', () => {
	it('carries the exact pre-serialized JSON string on every shard', () => {
		const docs = Array.from({ length: 10 }, (_, i) => doc(i));
		const [shard] = splitDocuments('a1', 1, docs);
		expect(shard.serialisedJson).toBe(JSON.stringify(docs));
		expect(new TextEncoder().encode(shard.serialisedJson).length).toBe(
			shard.serialisedBytes,
		);
		expect(JSON.parse(shard.serialisedJson)).toEqual(docs);
	});

	it('keeps the pre-serialized JSON stable through checksum finalization', async () => {
		const docs = Array.from({ length: 10 }, (_, i) => doc(i));
		const raw = splitDocuments('a1', 1, docs);
		const finalized = await finalizeShardChecksums(raw);
		expect(finalized[0].serialisedJson).toBe(JSON.stringify(docs));
		expect(finalized[0].serialisedBytes).toBe(
			new TextEncoder().encode(finalized[0].serialisedJson).length,
		);
	});

	it('produces the same pre-serialized JSON on the async incremental path', async () => {
		const docs = Array.from({ length: SHARD_MAX_DOCUMENTS + 5 }, (_, i) =>
			doc(i),
		);
		const syncShards = splitDocuments('a1', 0, docs);
		const asyncShards: GlobalSearchShard[] = [];
		for await (const shard of splitDocumentsIncrementally('a1', 0, docs, {
			sliceSize: 1_000,
		})) {
			asyncShards.push(shard);
		}
		expect(asyncShards.map((s) => s.serialisedJson)).toEqual(
			syncShards.map((s) => s.serialisedJson),
		);
	});
});

describe('GH-67 §9 — async incremental shard generation', () => {
	/**
	 * Build the same per-archive document arrays the harness corpus produces:
	 * 8 chats, messages interleaved by `ordinal % 8`, each archive's docs in
	 * the order they appear in that chat (ordinals ascending).
	 */
	function syntheticArchiveDocuments(
		size: 10_000 | 100_000,
	): GlobalSearchDocument[][] {
		const dataset = createGlobalSearchSyntheticDataset({ size });
		const messagesByArchive = new Map<string, unknown[]>();
		for (const message of iterateGlobalSearchSyntheticMessages(dataset)) {
			const messages = messagesByArchive.get(message.archiveId) ?? [];
			messages.push({
				id: message.messageId,
				timestamp:
					message.timestamp === null
						? new Date(0)
						: new Date(message.timestamp),
				sender: message.sender,
				content: message.content,
				isSystemMessage: false,
				isMediaMessage: false,
				rawLine: '',
			});
			messagesByArchive.set(message.archiveId, messages);
		}
		return [...messagesByArchive.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([archiveId, messages]) =>
				buildSessionDocuments({
					archiveId,
					title: 'T',
					messages: messages as never,
				} as never),
			);
	}

	it('produces shards identical to splitDocuments (same caps and boundaries)', async () => {
		for (const documents of syntheticArchiveDocuments(100_000)) {
			const syncShards = splitDocuments(documents[0].archiveId, 0, documents);
			const asyncShards: GlobalSearchShard[] = [];
			for await (const shard of splitDocumentsIncrementally(
				documents[0].archiveId,
				0,
				documents,
				{ sliceSize: 1_000 },
			)) {
				asyncShards.push(shard);
			}
			expect(asyncShards.map((s) => s.documents.length)).toEqual(
				syncShards.map((s) => s.documents.length),
			);
			expect(asyncShards.map((s) => s.serialisedBytes)).toEqual(
				syncShards.map((s) => s.serialisedBytes),
			);
			expect(asyncShards.map((s) => s.shardNo)).toEqual(
				syncShards.map((s) => s.shardNo),
			);
			asyncShards.forEach((shard, index) => {
				expect(shard.documents).toEqual(syncShards[index].documents);
			});
		}
	});

	it('keeps every synchronous prep slice under 50 ms for the 100k corpus', async () => {
		const documentsByArchive = syntheticArchiveDocuments(100_000);

		let sliceStart = performance.now();
		let maxSliceMs = 0;
		let shardCount = 0;
		let documentCount = 0;
		const recordYield = async () => {
			maxSliceMs = Math.max(maxSliceMs, performance.now() - sliceStart);
			sliceStart = performance.now();
		};

		for (const documents of documentsByArchive) {
			for await (const shard of splitDocumentsIncrementally(
				documents[0].archiveId,
				0,
				documents,
				{ sliceSize: 1_000, yieldToMacrotask: recordYield },
			)) {
				shardCount += 1;
				documentCount += shard.documents.length;
				expect(shard.documents.length).toBeLessThanOrEqual(SHARD_MAX_DOCUMENTS);
			}
		}
		maxSliceMs = Math.max(maxSliceMs, performance.now() - sliceStart);

		expect(documentCount).toBe(100_000);
		expect(shardCount).toBeGreaterThan(0);
		expect(maxSliceMs).toBeLessThanOrEqual(50);
	});

	it('throws when splitting an empty document set incrementally', async () => {
		await expect(async () => {
			for await (const _shard of splitDocumentsIncrementally('a1', 1, [])) {
				// never reached — must throw on the empty input
			}
		}).rejects.toThrow();
	});
});

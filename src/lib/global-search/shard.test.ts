import { describe, expect, it } from 'vitest';
import type { GlobalSearchDocument } from './manifest';
import {
	computeGenerationChecksum,
	exceedsShardByteBudget,
	finalizeShardChecksums,
	SHARD_MAX_BYTES,
	SHARD_MAX_DOCUMENTS,
	splitDocuments,
	validateShardReadback,
} from './shard';

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

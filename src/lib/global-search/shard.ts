/**
 * GH-67 §6 — Shard splitting and checksum.
 *
 * Shards cap at 2.000 documents or 1 MiB serialised UTF-8, whichever is hit
 * first. Each serialised shard carries a SHA-256 checksum of its bytes; the
 * commit pointer stores the combined checksum so a reader can validate a full
 * generation without trusting any single shard.
 *
 * Only `GlobalSearchDocument` arrays are serialised — never rawLine, ZIP bytes,
 * media, paths, bookmark comments or error payloads.
 */

import { sha256Hex } from './fingerprint';
import type { GlobalSearchDocument } from './manifest';

/** Soft document cap per shard. A shard never holds more than this many docs. */
export const SHARD_MAX_DOCUMENTS = 2_000;
/** Hard byte cap on the serialised shard payload (1 MiB). */
export const SHARD_MAX_BYTES = 1 * 1024 * 1024;

export type GlobalSearchShard = {
	archiveId: string;
	generation: number;
	shardNo: number;
	documents: GlobalSearchDocument[];
	serialisedBytes: number;
	checksum: string;
};

/**
 * Determine whether a serialised shard exceeds the byte budget. Pure helper
 * used by splitDocuments and by read-back validation.
 */
export function exceedsShardByteBudget(serialisedBytes: number): boolean {
	return serialisedBytes > SHARD_MAX_BYTES;
}

function serializeShardDocuments(
	documents: readonly GlobalSearchDocument[],
): string {
	return JSON.stringify(documents);
}

function utf8ByteLength(text: string): number {
	return new TextEncoder().encode(text).length;
}

/**
 * Split documents into shards. The algorithm packs greedily: it appends a
 * document to the current shard unless doing so would exceed either the
 * document cap or the byte cap, in which case it starts a new shard.
 *
 * If a single document alone exceeds the byte cap (e.g. a >256 KiB content
 * blob from the synthetic generator), that document occupies its own shard.
 * Callers that want to reject oversized documents can pre-filter; the indexer
 * still commits them because the synthetic dataset deliberately includes one.
 */
export function splitDocuments(
	archiveId: string,
	generation: number,
	documents: readonly GlobalSearchDocument[],
): GlobalSearchShard[] {
	if (documents.length === 0) {
		throw new Error('Cannot split an empty document set into shards');
	}

	const shards: GlobalSearchShard[] = [];
	let current: GlobalSearchDocument[] = [];

	const flush = (shardNo: number) => {
		if (current.length === 0) return;
		const serialised = serializeShardDocuments(current);
		const serialisedBytes = utf8ByteLength(serialised);
		shards.push({
			archiveId,
			generation,
			shardNo,
			documents: current,
			serialisedBytes,
			checksum: '', // filled asynchronously by finalizeShardChecksum
		});
		current = [];
	};

	for (const doc of documents) {
		const projectedSerialised = serializeShardDocuments([...current, doc]);
		const projectedBytes = utf8ByteLength(projectedSerialised);
		const overDocCap = current.length + 1 > SHARD_MAX_DOCUMENTS;
		const overByteCap = exceedsShardByteBudget(projectedBytes);

		if (current.length > 0 && (overDocCap || overByteCap)) {
			flush(shards.length);
		}
		current.push(doc);
	}
	flush(shards.length);

	return shards;
}

/**
 * Compute (and set) the SHA-256 checksum of each shard's serialised bytes.
 * Returns the shards with `checksum` populated.
 *
 * This is separate from splitDocuments because SHA-256 is async (Web Crypto).
 */
export async function finalizeShardChecksums(
	shards: readonly GlobalSearchShard[],
): Promise<GlobalSearchShard[]> {
	const finalized: GlobalSearchShard[] = [];
	for (const shard of shards) {
		const serialised = serializeShardDocuments(shard.documents);
		const checksum = await sha256Hex(new TextEncoder().encode(serialised));
		finalized.push({ ...shard, checksum });
	}
	return finalized;
}

/**
 * Combined generation checksum — SHA-256 of the ordered per-shard checksums,
 * joined by U+001F. Stored on the commit pointer so a reader can verify a full
 * generation by recomputing from the shards it reads back.
 */
export async function computeGenerationChecksum(
	shards: readonly GlobalSearchShard[],
): Promise<string> {
	const concat = shards.map((shard) => shard.checksum).join('\u001F');
	return sha256Hex(new TextEncoder().encode(concat));
}

/**
 * Re-validate a shard after reading it back from storage: re-serialise, check
 * the byte cap, recompute the checksum and compare to the stored value.
 * Returns false if the payload is corrupt (checksum mismatch) or oversized.
 */
export async function validateShardReadback(
	documents: GlobalSearchDocument[],
	expectedChecksum: string,
): Promise<boolean> {
	const serialised = serializeShardDocuments(documents);
	if (exceedsShardByteBudget(utf8ByteLength(serialised))) return false;
	const checksum = await sha256Hex(new TextEncoder().encode(serialised));
	return checksum === expectedChecksum;
}

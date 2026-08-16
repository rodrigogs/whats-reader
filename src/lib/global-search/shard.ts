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
	/**
	 * The exact JSON serialization of `documents`. Kept on the shard so the
	 * query path can post the shard as ONE string (cheap structuredClone)
	 * with its exact byte length (O(1) cap validation) instead of cloning
	 * 2,000 objects and re-stringifying on the worker. Persisted shards are
	 * read back as plain document arrays (storage format unchanged); the
	 * wire payload is built from them at read time.
	 */
	serialisedJson: string;
	checksum: string;
};

/**
 * Determine whether a serialised shard exceeds the byte budget. Pure helper
 * used by splitDocuments and by read-back validation.
 */
export function exceedsShardByteBudget(serialisedBytes: number): boolean {
	return serialisedBytes > SHARD_MAX_BYTES;
}

/**
 * UTF-8 byte length of a shard's JSON serialization (the 1 MiB budget).
 * Lives here next to the byte-budget machinery: the query runner imports it
 * for the fail-closed re-serialization when a caller posts a shard WITHOUT a
 * declared byte length, and it stays spiable through the live ESM binding.
 */
export function serializedShardBytes(
	documents: readonly GlobalSearchDocument[],
): number {
	return utf8ByteLength(serializeShardDocuments(documents));
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
 * Real macrotask yield so long synchronous work can interleave with message
 * events and the main thread never blocks on a whole corpus at once.
 * MessageChannel is a macrotask in Node, workers and browsers; setTimeout(0)
 * is the universal fallback. Shared by the async shard generator and the
 * worker-side query runner.
 */
export function yieldToMacrotask(): Promise<void> {
	if (typeof MessageChannel !== 'undefined') {
		return new Promise<void>((resolve) => {
			const channel = new MessageChannel();
			channel.port1.onmessage = () => {
				channel.port1.close();
				channel.port2.close();
				resolve();
			};
			channel.port2.postMessage(null);
		});
	}
	return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export type GlobalSearchShardPacker = {
	/**
	 * Push one document; returns the shard flushed by this push (the
	 * accumulated previous documents), or null when the document was simply
	 * appended. The returned shard's `documents` array is never mutated
	 * again, so a caller may hand it off (postMessage, yield) immediately.
	 */
	push(document: GlobalSearchDocument): GlobalSearchShard | null;
	/** Flush the trailing shard, if any documents remain. */
	flush(): GlobalSearchShard | null;
};

/**
 * Shared greedy packing state machine behind `splitDocuments` and the async
 * incremental splitters: a shard flushes when appending the next document
 * would exceed the 2,000-document or 1 MiB serialized cap. Every caller
 * shares the same decisions, so shard boundaries never drift between the
 * synchronous and asynchronous paths.
 */
export function createGlobalSearchShardPacker(
	archiveId: string,
	generation: number,
): GlobalSearchShardPacker {
	let shardNo = 0;
	let current: GlobalSearchDocument[] = [];
	// Exact serialized byte length of the current shard's JSON array
	// (including the two brackets). Kept incrementally so the byte-budget
	// check never re-serializes the whole candidate array per document
	// (which was O(shardSize²) and made 100k-message prep take minutes).
	let currentSerializedBytes = 2;

	const flush = (): GlobalSearchShard | null => {
		if (current.length === 0) return null;
		const serialised = serializeShardDocuments(current);
		const serialisedBytes = utf8ByteLength(serialised);
		const shard: GlobalSearchShard = {
			archiveId,
			generation,
			shardNo,
			documents: current,
			serialisedBytes,
			serialisedJson: serialised,
			checksum: '', // filled asynchronously by finalizeShardChecksum
		};
		shardNo += 1;
		current = [];
		currentSerializedBytes = 2;
		return shard;
	};

	return {
		push(document) {
			// JSON.stringify is deterministic for these plain objects, so the
			// projected array size is exact: brackets + comma separators + the
			// per-document serialization computed once here.
			const itemBytes = utf8ByteLength(serializeShardDocuments([document])) - 2;
			const projectedBytes =
				currentSerializedBytes + (current.length === 0 ? 0 : 1) + itemBytes;
			const overDocCap = current.length + 1 > SHARD_MAX_DOCUMENTS;
			const overByteCap = exceedsShardByteBudget(projectedBytes);

			let flushed: GlobalSearchShard | null = null;
			if (current.length > 0 && (overDocCap || overByteCap)) {
				flushed = flush();
			}
			current.push(document);
			currentSerializedBytes += (current.length === 1 ? 0 : 1) + itemBytes;
			return flushed;
		},
		flush,
	};
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

	const packer = createGlobalSearchShardPacker(archiveId, generation);
	const shards: GlobalSearchShard[] = [];
	for (const document of documents) {
		const flushed = packer.push(document);
		if (flushed) shards.push(flushed);
	}
	const final = packer.flush();
	if (final) shards.push(final);

	return shards;
}

/**
 * Asynchronous splitDocuments: yields each complete shard as it is packed,
 * awaiting a macrotask every `sliceSize` documents so no synchronous slice
 * of a large corpus prep ever blocks the main thread beyond the §10.11
 * 50 ms long-task ceiling. Shard boundaries are identical to
 * `splitDocuments` (both use the same packer and caps).
 */
export async function* splitDocumentsIncrementally(
	archiveId: string,
	generation: number,
	documents: readonly GlobalSearchDocument[],
	options: {
		/** Documents packed per synchronous slice before a macrotask yield. */
		sliceSize?: number;
		/** Injectable yield for tests; defaults to the real macrotask yield. */
		yieldToMacrotask?: () => Promise<void>;
	} = {},
): AsyncGenerator<GlobalSearchShard> {
	if (documents.length === 0) {
		throw new Error('Cannot split an empty document set into shards');
	}

	const packer = createGlobalSearchShardPacker(archiveId, generation);
	const sliceSize = options.sliceSize ?? 1_000;
	const yieldMacrotask = options.yieldToMacrotask ?? yieldToMacrotask;

	for (let index = 0; index < documents.length; index += 1) {
		const flushed = packer.push(documents[index]);
		if (flushed) yield flushed;
		if ((index + 1) % sliceSize === 0) await yieldMacrotask();
	}

	const final = packer.flush();
	if (final) yield final;
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
		// The shard already carries its exact serialization; hashing it here
		// instead of re-stringifying guarantees the checksum covers the same
		// bytes the query path posts.
		const checksum = await sha256Hex(
			new TextEncoder().encode(shard.serialisedJson),
		);
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

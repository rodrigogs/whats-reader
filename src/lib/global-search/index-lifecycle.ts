/**
 * GH-67 §6 — Atomic generation lifecycle: staging → validate → commit → ready.
 *
 * Invariants enforced by this module:
 *
 *  1. Readers only ever see the generation named by the commit pointer
 *     (`readyGeneration`). Staging generations are never exposed.
 *  2. A commit is atomic: the public ready manifest and commit pointer switch
 *     together in one storage transaction. If the process dies before that
 *     transaction, the previous ready generation remains live and staging is
 *     cleaned up on the next startup.
 *  3. On failure (quota, corrupt shard, checksum mismatch, worker crash,
 *     cancellation) the previous generation is preserved. Staging data for the
 *     failed generation is best-effort deleted, but the ready generation is
 *     never touched until a new commit succeeds.
 *  4. Startup cleanup removes staging manifests, orphan shards and manifests
 *     whose schema/index version is unknown. Unknown-version manifests are
 *     marked `stale` (never read) rather than silently upgraded.
 *
 * Every entry point takes the feature gate as an argument so contracts can
 * assert the fail-closed behaviour without monkey-patching module state.
 */

import type { GlobalSearchConsent } from './consent';
import { isConsentValidForPersistence } from './consent';
import { computeSourceFingerprint, sha256Hex } from './fingerprint';
import {
	commitKey,
	GLOBAL_SEARCH_INDEX_VERSION,
	GLOBAL_SEARCH_NORMALIZATION_VERSION,
	GLOBAL_SEARCH_SCHEMA_VERSION,
	type GlobalSearchDocument,
	type GlobalSearchManifest,
	type GlobalSearchManifestState,
	manifestKey,
	parseShardKey,
	parseStagingKey,
	shardKey,
	stagingKey,
} from './manifest';
import {
	computeGenerationChecksum,
	exceedsShardByteBudget,
	finalizeShardChecksums,
	type GlobalSearchShard,
	splitDocuments,
	validateShardReadback,
} from './shard';
import type { GlobalSearchStorage } from './storage';
import {
	decideQuotaGate,
	type QuotaGateDecision,
	type StorageEstimateProvider,
} from './storage-estimate';

export type { GlobalSearchConsent } from './consent';

export type GlobalSearchIndexOutcome =
	| { status: 'committed'; manifest: GlobalSearchManifest }
	| { status: 'skipped-no-consent' }
	| { status: 'skipped-gate-disabled' }
	| { status: 'refused-quota'; decision: QuotaGateDecision }
	| {
			status: 'failed';
			code: 'quota' | 'worker-crash' | 'corrupt' | 'version-mismatch';
			previousGenerationPreserved: boolean;
	  };

export type GlobalSearchIndexRequest = {
	archiveId: string;
	chatTitle: string;
	documents: GlobalSearchDocument[];
	consent: GlobalSearchConsent | undefined;
	gate: boolean;
	storage: GlobalSearchStorage;
	estimateProvider?: StorageEstimateProvider;
};

function utcNow(): number {
	return Date.now();
}

async function readCommitPointer(
	storage: GlobalSearchStorage,
	archiveId: string,
): Promise<{
	archiveId: string;
	readyGeneration: number;
	shardCount: number;
	checksum: string;
} | null> {
	return (await storage.get(commitKey(archiveId))) ?? null;
}

/**
 * Compute the next generation number for an archive. Generations are global
 * per archive (not per run) so they always increase.
 */
export function nextGeneration(
	currentReady: number | null,
	maxStaging: number | null,
): number {
	const base = Math.max(currentReady ?? 0, maxStaging ?? 0);
	return base + 1;
}

async function writeStagingManifest(
	storage: GlobalSearchStorage,
	manifest: GlobalSearchManifest,
): Promise<void> {
	await storage.set(
		stagingKey(manifest.archiveId, manifest.generation),
		manifest,
	);
}

/**
 * Build a staging manifest for a generation. Pure helper, exposed for tests.
 */
export function buildStagingManifest(
	archiveId: string,
	chatTitle: string,
	generation: number,
	messageCount: number,
	documents: readonly GlobalSearchDocument[],
	fingerprint: string,
): GlobalSearchManifest {
	const searchableUtf8Bytes = documents.reduce(
		(sum, doc) =>
			sum +
			new TextEncoder().encode(`${doc.sender}\u0000${doc.content}`).length,
		0,
	);
	return {
		schemaVersion: GLOBAL_SEARCH_SCHEMA_VERSION,
		indexVersion: GLOBAL_SEARCH_INDEX_VERSION,
		normalizationVersion: GLOBAL_SEARCH_NORMALIZATION_VERSION,
		archiveId,
		generation,
		state: 'staging',
		chatTitle,
		sourceFingerprint: fingerprint,
		messageCount,
		indexedDocumentCount: documents.length,
		searchableUtf8Bytes,
		storedBytes: 0, // filled after shards are finalised
		includes: { content: true, sender: true, transcriptions: false },
		createdAt: utcNow(),
	};
}

/**
 * Fail-closed guard: when the gate is false the lifecycle must not read or
 * write anything. Returns true only when the gate is explicitly enabled.
 */
export function isGateEnabled(gate: boolean): boolean {
	return gate === true;
}

/**
 * Estimate the total bytes a generation will occupy once committed. Conservative
 * upper bound: sum of serialised shard sizes (already includes JSON overhead).
 */
function projectedGenerationBytes(
	shards: readonly GlobalSearchShard[],
): number {
	return shards.reduce((sum, shard) => sum + shard.serialisedBytes, 0);
}

/**
 * Commit a new generation atomically.
 *
 * Steps (§6 process):
 *   1. Validate gate + consent.
 *   2. Split documents into shards and compute checksums + sourceFingerprint.
 *   3. Run the quota gate; refuse on failure (previous generation untouched).
 *   4. Write every shard, validating count + checksum after each write.
 *   5. Write the staging manifest.
 *   6. Atomically publish the ready manifest and commit pointer.
 *   8. Clean up the previous generation's shards + staging.
 *
 * If any step 4-6 throws, we attempt to delete the staging generation's shards
 * and manifest, then return `failed` with `previousGenerationPreserved: true`.
 */
export async function commitGeneration(
	request: GlobalSearchIndexRequest,
): Promise<GlobalSearchIndexOutcome> {
	const { archiveId, chatTitle, documents, consent, gate, storage } = request;

	if (!isGateEnabled(gate)) {
		return { status: 'skipped-gate-disabled' };
	}

	if (!isConsentValidForPersistence(consent, archiveId)) {
		return { status: 'skipped-no-consent' };
	}

	if (documents.length === 0) {
		return {
			status: 'failed',
			code: 'corrupt',
			previousGenerationPreserved: true,
		};
	}

	const previousPointer = await readCommitPointer(storage, archiveId);
	const currentReady = previousPointer?.readyGeneration ?? null;

	let shards: GlobalSearchShard[];
	try {
		const rawShards = splitDocuments(archiveId, 0, documents);
		shards = await finalizeShardChecksums(rawShards);
	} catch {
		return {
			status: 'failed',
			code: 'corrupt',
			previousGenerationPreserved: currentReady !== null,
		};
	}

	// Quota gate. The projection is computed before assigning a generation
	// number so a refusal never allocates one (keeping generations monotonic
	// across refused attempts).
	const projected = projectedGenerationBytes(shards);
	const estimate = request.estimateProvider
		? await safeEstimate(request.estimateProvider)
		: null;
	const existingBytes = await measureExistingGenerationBytes(
		storage,
		archiveId,
	);
	const decision = decideQuotaGate(estimate, existingBytes, projected);
	if (!decision.allowed) {
		return { status: 'refused-quota', decision };
	}

	const generation = nextGeneration(currentReady, null);
	// Re-stamp the shard objects with the real generation (splitDocuments only
	// needs the count/size caps, so it was given a placeholder). The stored key
	// and the shard's own generation field must agree.
	shards = shards.map((shard) => ({ ...shard, generation }));
	const fingerprint = await computeSourceFingerprint(documents);
	const stagingManifest = buildStagingManifest(
		archiveId,
		chatTitle,
		generation,
		documents.length,
		documents,
		fingerprint,
	);

	// Step 4: write shards one at a time, validating each.
	try {
		for (const shard of shards) {
			if (exceedsShardByteBudget(shard.serialisedBytes)) {
				throw new Error('shard exceeds byte budget');
			}
			await storage.set(
				shardKey(archiveId, generation, shard.shardNo),
				shard.documents,
			);
		}
		// Validate read-back of every shard: count + checksum.
		for (const shard of shards) {
			const readback = await storage.get<GlobalSearchDocument[]>(
				shardKey(archiveId, generation, shard.shardNo),
			);
			if (!readback || readback.length !== shard.documents.length) {
				throw new Error('shard count mismatch on read-back');
			}
			const ok = await validateShardReadback(readback, shard.checksum);
			if (!ok) throw new Error('shard checksum mismatch on read-back');
		}
	} catch {
		await bestEffortDeleteGeneration(storage, archiveId, generation);
		return {
			status: 'failed',
			code: 'corrupt',
			previousGenerationPreserved: currentReady !== null,
		};
	}

	// Step 5: write staging, then atomically publish both public records.
	stagingManifest.storedBytes = projected;
	const readyManifest: GlobalSearchManifest = {
		...stagingManifest,
		state: 'ready' satisfies GlobalSearchManifestState,
		indexedAt: utcNow(),
	};
	try {
		await writeStagingManifest(storage, stagingManifest);
		const checksum = await computeGenerationChecksum(shards);
		await storage.setMany([
			[manifestKey(archiveId), readyManifest],
			[
				commitKey(archiveId),
				{
					archiveId,
					readyGeneration: generation,
					shardCount: shards.length,
					checksum,
				},
			],
		]);
	} catch {
		await bestEffortDeleteGeneration(storage, archiveId, generation);
		return {
			status: 'failed',
			code: 'corrupt',
			previousGenerationPreserved: currentReady !== null,
		};
	}

	// Cleanup is strictly post-publication and never changes a committed result.
	try {
		await storage.del(stagingKey(archiveId, generation));
	} catch {}

	// Step 7: clean up the previous generation's shards (only after publication).
	if (currentReady !== null && currentReady !== generation) {
		try {
			await bestEffortDeleteGenerationShards(storage, archiveId, currentReady);
		} catch {}
	}

	return { status: 'committed', manifest: readyManifest };
}

async function safeEstimate(provider: StorageEstimateProvider) {
	try {
		return await provider();
	} catch {
		return null;
	}
}

/**
 * Read the currently-ready generation for an archive. Returns null when there
 * is no commit pointer, or when the manifest is stale/failed/corrupt.
 *
 * This is the ONLY reader the query worker is allowed to use.
 */
export async function readReadyGeneration(
	storage: GlobalSearchStorage,
	archiveId: string,
	gate: boolean,
): Promise<{
	manifest: GlobalSearchManifest;
	shards: GlobalSearchDocument[][];
} | null> {
	if (!isGateEnabled(gate)) return null;

	const pointer = await readCommitPointer(storage, archiveId);
	if (!pointer) return null;
	if (pointer.archiveId !== archiveId) return null;

	const manifest = await storage.get<GlobalSearchManifest>(
		manifestKey(archiveId),
	);
	if (!manifest) return null;
	if (manifest.archiveId !== archiveId) return null;

	// Stale/failed/removing manifests are never read.
	if (manifest.state !== 'ready') return null;
	// Version mismatch → stale, not read.
	if (
		manifest.schemaVersion !== GLOBAL_SEARCH_SCHEMA_VERSION ||
		manifest.indexVersion !== GLOBAL_SEARCH_INDEX_VERSION
	) {
		return null;
	}
	if (manifest.generation !== pointer.readyGeneration) return null;

	const shards: GlobalSearchDocument[][] = [];
	for (let shardNo = 0; shardNo < pointer.shardCount; shardNo += 1) {
		const docs = await storage.get<GlobalSearchDocument[]>(
			shardKey(archiveId, pointer.readyGeneration, shardNo),
		);
		if (!docs) return null; // missing shard → treat as not-ready
		shards.push(docs);
	}

	// Recompute generation checksum and compare to the commit pointer.
	const allShardChecksums = await collectShardChecksums(
		storage,
		archiveId,
		pointer.readyGeneration,
		pointer.shardCount,
	);
	if (!allShardChecksums) return null;
	const recomputed = await recomputeGenerationChecksum(allShardChecksums);
	if (recomputed !== pointer.checksum) return null;

	return { manifest, shards };
}

async function collectShardChecksums(
	storage: GlobalSearchStorage,
	archiveId: string,
	generation: number,
	shardCount: number,
): Promise<string[] | null> {
	const checksums: string[] = [];
	for (let shardNo = 0; shardNo < shardCount; shardNo += 1) {
		const docs = await storage.get<GlobalSearchDocument[]>(
			shardKey(archiveId, generation, shardNo),
		);
		if (!docs) return null;
		const serialised = new TextEncoder().encode(JSON.stringify(docs));
		checksums.push(await sha256Hex(serialised));
	}
	return checksums;
}

async function recomputeGenerationChecksum(
	shardChecksums: string[],
): Promise<string> {
	const concat = shardChecksums.join('\u001F');
	const serialised = new TextEncoder().encode(concat);
	return sha256Hex(serialised);
}

/**
 * Startup cleanup — §6 "No startup": remove staging manifests, orphan shards,
 * and mark incompatible manifests stale.
 *
 * Returns a summary of what was cleaned. Pure with respect to the storage
 * adapter; safe to call multiple times.
 */
export type StartupCleanupReport = {
	stagingManifestsDeleted: number;
	orphanShardsDeleted: number;
	manifestsMarkedStale: number;
};

export async function startupCleanup(
	storage: GlobalSearchStorage,
	gate: boolean,
): Promise<StartupCleanupReport> {
	if (!isGateEnabled(gate)) {
		return {
			stagingManifestsDeleted: 0,
			orphanShardsDeleted: 0,
			manifestsMarkedStale: 0,
		};
	}

	const allKeys = await storage.keys();
	const report: StartupCleanupReport = {
		stagingManifestsDeleted: 0,
		orphanShardsDeleted: 0,
		manifestsMarkedStale: 0,
	};

	// 1. Delete every staging manifest + its generation's shards.
	const stagingInfos = allKeys
		.map((key) => ({ key, parsed: parseStagingKey(key) }))
		.filter(
			(
				entry,
			): entry is {
				key: string;
				parsed: { archiveId: string; generation: number };
			} => entry.parsed !== null,
		);

	for (const { key, parsed } of stagingInfos) {
		await storage.del(key);
		report.stagingManifestsDeleted += 1;
		// Best-effort: delete shards for that staging generation.
		for (const shardKeyCandidate of allKeys) {
			const parsedShard = parseShardKey(shardKeyCandidate);
			if (
				parsedShard &&
				parsedShard.archiveId === parsed.archiveId &&
				parsedShard.generation === parsed.generation
			) {
				await storage.del(shardKeyCandidate);
				report.orphanShardsDeleted += 1;
			}
		}
	}

	// 2. Delete orphan shards — shards whose generation is not the committed one.
	const commitPointers = new Map<string, number>();
	for (const key of allKeys) {
		if (key.startsWith('whatsapp-global-search-commit-v1-')) {
			const archiveId = key.slice('whatsapp-global-search-commit-v1-'.length);
			const pointer = await storage.get<{ readyGeneration: number }>(key);
			if (pointer) commitPointers.set(archiveId, pointer.readyGeneration);
		}
	}
	for (const key of allKeys) {
		const parsed = parseShardKey(key);
		if (!parsed) continue;
		const committedGen = commitPointers.get(parsed.archiveId);
		if (committedGen === undefined || committedGen !== parsed.generation) {
			await storage.del(key);
			report.orphanShardsDeleted += 1;
		}
	}

	// 3. Mark incompatible manifests stale (do not delete — preserve evidence).
	const manifestPrefix = 'whatsapp-global-search-manifest-v1-';
	for (const key of allKeys) {
		if (!key.startsWith(manifestPrefix)) continue;
		const manifest = await storage.get<GlobalSearchManifest>(key);
		if (!manifest) continue;
		if (
			manifest.schemaVersion !== GLOBAL_SEARCH_SCHEMA_VERSION ||
			manifest.indexVersion !== GLOBAL_SEARCH_INDEX_VERSION
		) {
			const staleManifest: GlobalSearchManifest = {
				...manifest,
				state: 'stale',
			};
			await storage.set(key, staleManifest);
			report.manifestsMarkedStale += 1;
		}
	}

	return report;
}

/**
 * List every archiveId that has a committed, version-compatible ready manifest.
 * Used for coverage display and for "delete all indices".
 */
export async function listReadyArchives(
	storage: GlobalSearchStorage,
	gate: boolean,
): Promise<GlobalSearchManifest[]> {
	if (!isGateEnabled(gate)) return [];

	const allKeys = await storage.keys();
	const manifests: GlobalSearchManifest[] = [];
	for (const key of allKeys) {
		if (!key.startsWith('whatsapp-global-search-manifest-v1-')) continue;
		const manifest = await storage.get<GlobalSearchManifest>(key);
		if (!manifest) continue;
		if (key !== manifestKey(manifest.archiveId)) continue;
		if (manifest.state !== 'ready') continue;
		if (
			manifest.schemaVersion !== GLOBAL_SEARCH_SCHEMA_VERSION ||
			manifest.indexVersion !== GLOBAL_SEARCH_INDEX_VERSION
		) {
			continue;
		}
		const pointer = await readCommitPointer(storage, manifest.archiveId);
		if (
			!pointer ||
			pointer.archiveId !== manifest.archiveId ||
			pointer.readyGeneration !== manifest.generation
		) {
			continue;
		}
		manifests.push(manifest);
	}
	return manifests;
}

async function bestEffortDeleteGeneration(
	storage: GlobalSearchStorage,
	archiveId: string,
	generation: number,
): Promise<void> {
	try {
		await storage.del(stagingKey(archiveId, generation));
	} catch {}
	try {
		await bestEffortDeleteGenerationShards(storage, archiveId, generation);
	} catch {}
}

async function bestEffortDeleteGenerationShards(
	storage: GlobalSearchStorage,
	archiveId: string,
	generation: number,
): Promise<void> {
	let allKeys: string[];
	try {
		allKeys = await storage.keys();
	} catch {
		return;
	}
	for (const key of allKeys) {
		const parsed = parseShardKey(key);
		if (
			parsed &&
			parsed.archiveId === archiveId &&
			parsed.generation === generation
		) {
			try {
				await storage.del(key);
			} catch {}
		}
	}
}

async function measureExistingGenerationBytes(
	storage: GlobalSearchStorage,
	archiveId: string,
): Promise<number> {
	const pointer = await readCommitPointer(storage, archiveId);
	if (!pointer) return 0;
	let total = 0;
	const allKeys = await storage.keys();
	for (const key of allKeys) {
		const parsed = parseShardKey(key);
		if (
			parsed &&
			parsed.archiveId === archiveId &&
			parsed.generation === pointer.readyGeneration
		) {
			const docs = await storage.get<GlobalSearchDocument[]>(key);
			if (docs) {
				total += new TextEncoder().encode(JSON.stringify(docs)).length;
			}
		}
	}
	return total;
}

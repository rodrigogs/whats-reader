/**
 * GH-67 §6 — Global search manifest, document and IndexedDB key contracts.
 *
 * Every key produced here starts with `whatsapp-global-search-` so the entire
 * feature namespace can be enumerated and purged without touching persisted
 * chat metadata, file handles, bookmarks, transcriptions or settings.
 *
 * This module is pure: it only builds keys and types. No IndexedDB access, no
 * network, no console output. It is safe to import from workers and tests.
 */

import type { ArchiveMessageKey } from './archive-identity';

/**
 * Versioned schema/index markers. A manifest whose `schemaVersion` or
 * `indexVersion` does not match the current constants is treated as stale and
 * never read. Bumping these constants invalidates every prior index without
 * destructive migration.
 */
export const GLOBAL_SEARCH_SCHEMA_VERSION = 1 as const;
export const GLOBAL_SEARCH_INDEX_VERSION = 1 as const;
export const GLOBAL_SEARCH_NORMALIZATION_VERSION = 1 as const;

/**
 * Build-time feature gate. Defaults to false until the feature ships; flipping
 * this to true (and rebuilding) is the only way to activate V1 persistence.
 * When false or unknown the lifecycle layer reads/writes nothing and clears
 * every in-flight reference — see §8 of the spec.
 *
 * Lifecycle entry points accept the gate value as a parameter so the contracts
 * are testable without monkey-patching module state.
 */
export const GLOBAL_SEARCH_V1_ENABLED = false;

export type GlobalSearchManifestState =
	| 'staging'
	| 'ready'
	| 'stale'
	| 'failed'
	| 'removing';

/**
 * Enumerated error codes only — never free text, never payloads with content.
 * The UI maps each code to a localised message key.
 */
export type GlobalSearchErrorCode =
	| 'quota'
	| 'worker-crash'
	| 'corrupt'
	| 'version-mismatch';

export type GlobalSearchManifest = {
	schemaVersion: typeof GLOBAL_SEARCH_SCHEMA_VERSION;
	indexVersion: typeof GLOBAL_SEARCH_INDEX_VERSION;
	normalizationVersion: typeof GLOBAL_SEARCH_NORMALIZATION_VERSION;
	archiveId: string;
	generation: number;
	state: GlobalSearchManifestState;
	chatTitle: string;
	sourceFingerprint: string;
	messageCount: number;
	indexedDocumentCount: number;
	searchableUtf8Bytes: number;
	storedBytes: number;
	includes: { content: true; sender: true; transcriptions: false };
	createdAt: number;
	indexedAt?: number;
	lastErrorCode?: GlobalSearchErrorCode;
};

/**
 * A searchable document. Only `content` and `sender` are persisted — both
 * gated by consent. `ArchiveMessageKey` carries the canonical identity triple
 * (archiveId, ordinal, messageId) so results never collapse across archives or
 * rely on a bare messageId.
 */
export type GlobalSearchDocument = ArchiveMessageKey & {
	timestamp: number | null;
	sender: string;
	content: string;
};

export type GlobalSearchCommitPointer = {
	archiveId: string;
	readyGeneration: number;
	shardCount: number;
	checksum: string;
};

/**
 * Namespace prefix shared by every feature key. The fail-closed recovery and
 * "delete all indices" operations enumerate only keys with this prefix.
 */
export const GLOBAL_SEARCH_KEY_PREFIX = 'whatsapp-global-search-';

const SCHEMA_SEGMENT = `v${GLOBAL_SEARCH_SCHEMA_VERSION}`;

/** Public manifest — reflects the last committed (or known-failed) state. */
export function manifestKey(archiveId: string): string {
	return `${GLOBAL_SEARCH_KEY_PREFIX}manifest-${SCHEMA_SEGMENT}-${archiveId}`;
}

/** Temporary staging manifest written per generation during indexing. */
export function stagingKey(archiveId: string, generation: number): string {
	return `${GLOBAL_SEARCH_KEY_PREFIX}staging-${SCHEMA_SEGMENT}-${archiveId}-${generation}`;
}

/** Serialized shard document array. */
export function shardKey(
	archiveId: string,
	generation: number,
	shardNo: number,
): string {
	return `${GLOBAL_SEARCH_KEY_PREFIX}shard-${SCHEMA_SEGMENT}-${archiveId}-${generation}-${shardNo}`;
}

/** Commit pointer — the atomic switch that exposes a generation to readers. */
export function commitKey(archiveId: string): string {
	return `${GLOBAL_SEARCH_KEY_PREFIX}commit-${SCHEMA_SEGMENT}-${archiveId}`;
}

/** Consent record for a remembered archive. */
export function consentKey(archiveId: string): string {
	return `${GLOBAL_SEARCH_KEY_PREFIX}consent-${SCHEMA_SEGMENT}-${archiveId}`;
}

export function isGlobalSearchKey(key: string): boolean {
	return key.startsWith(GLOBAL_SEARCH_KEY_PREFIX);
}

export function isArchiveGlobalSearchKey(
	key: string,
	archiveId: string,
): boolean {
	return isGlobalSearchKey(key) && key.includes(`-${archiveId}`);
}

/**
 * Parse a shard key into its components. Returns null for non-shard keys or
 * malformed segments so startup cleanup can iterate safely.
 */
export function parseShardKey(
	key: string,
): { archiveId: string; generation: number; shardNo: number } | null {
	// whatsapp-global-search-shard-v1-<archiveId>-<generation>-<shardNo>
	// archiveId may contain hyphens, so split from the right: shardNo and
	// generation are the last two numeric segments.
	const prefix = `${GLOBAL_SEARCH_KEY_PREFIX}shard-${SCHEMA_SEGMENT}-`;
	if (!key.startsWith(prefix)) return null;
	const rest = key.slice(prefix.length);
	const lastHyphen = rest.lastIndexOf('-');
	if (lastHyphen < 0) return null;
	const shardNoStr = rest.slice(lastHyphen + 1);
	const beforeShard = rest.slice(0, lastHyphen);
	const secondHyphen = beforeShard.lastIndexOf('-');
	if (secondHyphen < 0) return null;
	const genStr = beforeShard.slice(secondHyphen + 1);
	const archiveId = beforeShard.slice(0, secondHyphen);
	const shardNo = Number(shardNoStr);
	const generation = Number(genStr);
	if (
		!Number.isInteger(shardNo) ||
		shardNo < 0 ||
		!Number.isInteger(generation) ||
		generation < 0 ||
		archiveId.length === 0
	) {
		return null;
	}
	return { archiveId, generation, shardNo };
}

export function parseStagingKey(
	key: string,
): { archiveId: string; generation: number } | null {
	const prefix = `${GLOBAL_SEARCH_KEY_PREFIX}staging-${SCHEMA_SEGMENT}-`;
	if (!key.startsWith(prefix)) return null;
	const rest = key.slice(prefix.length);
	const lastHyphen = rest.lastIndexOf('-');
	if (lastHyphen < 0) return null;
	const genStr = rest.slice(lastHyphen + 1);
	const archiveId = rest.slice(0, lastHyphen);
	const generation = Number(genStr);
	if (
		!Number.isInteger(generation) ||
		generation < 0 ||
		archiveId.length === 0
	) {
		return null;
	}
	return { archiveId, generation };
}

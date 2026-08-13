/**
 * GH-67 §5 & §8 — Removal and fail-closed recovery.
 *
 * Two operations:
 *
 *  - `removeArchiveIndex(archiveId)`: deletes every key for one archive
 *    (shards, staging, manifest, commit pointer, consent). Used by "Remove
 *    from library". Returns a readback report asserting zero remaining keys.
 *
 *  - `deleteAllIndices(storage, gate)`: the local recovery / "delete all
 *    indices" action. Enumerates only `whatsapp-global-search-*` keys, deletes
 *    them, then reads back and requires a count of zero. Never touches
 *    persisted-chat, file-handle, bookmark, transcription or settings keys.
 *
 * Both require the gate so that a disabled feature is a no-op that also fails
 * closed. A readback that finds any remaining key marks the operation as
 * incomplete (the caller must not declare success until `remaining === 0`).
 */

import { isGateEnabled } from './index-lifecycle';
import {
	GLOBAL_SEARCH_KEY_PREFIX,
	parseShardKey,
	parseStagingKey,
} from './manifest';
import type { GlobalSearchStorage } from './storage';

const MANIFEST_PREFIX = `${GLOBAL_SEARCH_KEY_PREFIX}manifest-v1-`;
const COMMIT_PREFIX = `${GLOBAL_SEARCH_KEY_PREFIX}commit-v1-`;
const CONSENT_PREFIX = `${GLOBAL_SEARCH_KEY_PREFIX}consent-v1-`;

export type RemovalReadback = {
	archiveId: string;
	deletedKeys: string[];
	remaining: number;
	complete: boolean;
};

export type DeleteAllReadback = {
	deletedKeys: string[];
	remaining: number;
	complete: boolean;
};

/**
 * Enumerate every global-search key that belongs to `archiveId`, using exact
 * key-type parsing so an archiveId that is a substring of another never
 * over-matches. ArchiveIds are UUIDs and may themselves contain hyphens, so
 * parsing must split structurally (shard/staging from the right; manifest/
 * commit/consent as the entire suffix after the typed prefix).
 */
export async function enumerateArchiveKeys(
	storage: GlobalSearchStorage,
	archiveId: string,
): Promise<string[]> {
	const allKeys = await storage.keys();
	const owned: string[] = [];
	for (const key of allKeys) {
		if (keyBelongsToArchive(key, archiveId)) {
			owned.push(key);
		}
	}
	return owned;
}

function keyBelongsToArchive(key: string, archiveId: string): boolean {
	const shard = parseShardKey(key);
	if (shard) return shard.archiveId === archiveId;

	const staging = parseStagingKey(key);
	if (staging) return staging.archiveId === archiveId;

	if (key.startsWith(MANIFEST_PREFIX)) {
		return key.slice(MANIFEST_PREFIX.length) === archiveId;
	}
	if (key.startsWith(COMMIT_PREFIX)) {
		return key.slice(COMMIT_PREFIX.length) === archiveId;
	}
	if (key.startsWith(CONSENT_PREFIX)) {
		return key.slice(CONSENT_PREFIX.length) === archiveId;
	}
	return false;
}

/**
 * Delete all global-search keys for one archive, then read back and require
 * zero remaining keys in that archive's namespace.
 */
export async function removeArchiveIndex(
	storage: GlobalSearchStorage,
	archiveId: string,
	gate: boolean,
): Promise<RemovalReadback> {
	if (!isGateEnabled(gate)) {
		return { archiveId, deletedKeys: [], remaining: 0, complete: true };
	}

	const toDelete = await enumerateArchiveKeys(storage, archiveId);
	for (const key of toDelete) {
		await storage.del(key);
	}

	// Readback: enumerate again; any survivor means incomplete.
	const survivors = await enumerateArchiveKeys(storage, archiveId);
	return {
		archiveId,
		deletedKeys: toDelete,
		remaining: survivors.length,
		complete: survivors.length === 0,
	};
}

/**
 * Delete every key in the global-search namespace, then read back and require
 * zero remaining keys. This is the local recovery / "delete all indices"
 * action. It never touches any other namespace.
 */
export async function deleteAllIndices(
	storage: GlobalSearchStorage,
	gate: boolean,
): Promise<DeleteAllReadback> {
	if (!isGateEnabled(gate)) {
		return { deletedKeys: [], remaining: 0, complete: true };
	}

	const toDelete = await storage.keys();
	for (const key of toDelete) {
		await storage.del(key);
	}

	const survivors = await storage.keys();
	return {
		deletedKeys: toDelete,
		remaining: survivors.length,
		complete: survivors.length === 0,
	};
}

/**
 * Isolation guard: assert that a set of keys contains only global-search keys
 * and none from another namespace. Used by tests to prove namespace isolation.
 */
export function containsOnlyGlobalSearchKeys(keys: readonly string[]): boolean {
	return keys.every((key) => key.startsWith(GLOBAL_SEARCH_KEY_PREFIX));
}

/**
 * GH-67 §6 — IndexedDB-backed storage adapter for the global-search namespace.
 *
 * All persistence modules depend on `GlobalSearchStorage`, never directly on
 * idb-keyval. This keeps the lifecycle pure and lets tests use an in-memory map
 * (see `createInMemoryGlobalSearchStorage`) without mocking the idb-keyval
 * module. The idb-keyval adapter wraps the same `get/set/keys/del` calls the
 * app already uses elsewhere.
 *
 * The adapter only ever reads/writes keys under `whatsapp-global-search-`; the
 * idb-keyval backend does not enforce that, so the lifecycle layer is careful
 * to pass only keys produced by `manifest.ts` key builders.
 */

import { del, get, keys, set, setMany } from 'idb-keyval';
import { isGlobalSearchKey } from './manifest';

export interface GlobalSearchStorage {
	get<T>(key: string): Promise<T | undefined>;
	set<T>(key: string, value: T): Promise<void>;
	/** Atomically replace every entry in one storage transaction. */
	setMany(entries: readonly [string, unknown][]): Promise<void>;
	del(key: string): Promise<void>;
	/** Enumerate every key in the global-search namespace. */
	keys(): Promise<string[]>;
}

export function isGlobalSearchStorageKey(key: unknown): key is string {
	return typeof key === 'string' && isGlobalSearchKey(key);
}

/**
 * idb-keyval adapter. Only reads/keys filtered to the global-search prefix —
 * this is the only function that talks to IndexedDB; the rest of the feature
 * goes through `GlobalSearchStorage`.
 */
export const idbGlobalSearchStorage: GlobalSearchStorage = {
	async get<T>(key: string): Promise<T | undefined> {
		return (await get<T>(key)) ?? undefined;
	},
	async set<T>(key: string, value: T): Promise<void> {
		await set(key, value);
	},
	async setMany(entries: readonly [string, unknown][]): Promise<void> {
		await setMany(Array.from(entries));
	},
	async del(key: string): Promise<void> {
		await del(key);
	},
	async keys(): Promise<string[]> {
		const allKeys = await keys();
		return allKeys.filter(isGlobalSearchStorageKey) as string[];
	},
};

/**
 * In-memory storage for unit tests. Faithful to the idb-keyval contract:
 * `get` resolves undefined for missing keys, `keys` returns only stored keys.
 */
export function createInMemoryGlobalSearchStorage(
	seed: Record<string, unknown> = {},
): GlobalSearchStorage & { snapshot(): Map<string, unknown> } {
	const store = new Map<string, unknown>(Object.entries(seed));
	return {
		async get<T>(key: string): Promise<T | undefined> {
			return (store.get(key) as T | undefined) ?? undefined;
		},
		async set<T>(key: string, value: T): Promise<void> {
			store.set(key, value);
		},
		async setMany(entries: readonly [string, unknown][]): Promise<void> {
			// Map mutations cannot throw after validation, so apply a prepared copy
			// and publish it only once every entry has been accepted.
			const next = new Map(store);
			for (const [key, value] of entries) next.set(key, value);
			store.clear();
			for (const [key, value] of next) store.set(key, value);
		},
		async del(key: string): Promise<void> {
			store.delete(key);
		},
		async keys(): Promise<string[]> {
			return [...store.keys()].filter(isGlobalSearchKey);
		},
		/**
		 * Live reference to the underlying map. Returned (not copied) so tests
		 * can seed and tamper with state that the adapter then observes.
		 */
		snapshot() {
			return store;
		},
	};
}

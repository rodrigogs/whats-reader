import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../parser/chat-parser';
import { type ChatData, createAppState } from '../state.svelte';
import type {
	GlobalSearchWorkerInput,
	GlobalSearchWorkerOutput,
} from '../workers/global-search-worker';
import { createGlobalSearchWorkerController } from '../workers/global-search-worker';
import * as documentsModule from './documents';
import { buildSessionDocuments, searchableUtf8Bytes } from './documents';
import { createGlobalSearchState } from './global-search-state.svelte';
import type { GlobalSearchTransport } from './query-orchestrator';
import { createInMemoryGlobalSearchStorage } from './storage';

function loopback(): () => GlobalSearchTransport {
	let handler: ((output: GlobalSearchWorkerOutput) => void) | null = null;
	const controller = createGlobalSearchWorkerController((output) => {
		setTimeout(() => handler?.(output), 0);
	});
	return () => ({
		post(input: GlobalSearchWorkerInput) {
			void controller.handle(input);
		},
		onMessage(callback) {
			handler = callback;
		},
	});
}

/**
 * Transport that records every posted input and delivers a terminal
 * `complete` after the client posts its own `complete` (so submitQuery
 * settles without a real worker). Used to prove the objects crossing the
 * post boundary are structured-cloneable — the real dedicated-worker
 * transport runs `worker.postMessage(input)`, which uses the same
 * serialization and rejects Svelte 5 `$state` deep proxies.
 */
function recordingTransport(): {
	factory: () => GlobalSearchTransport;
	posted: GlobalSearchWorkerInput[];
} {
	const posted: GlobalSearchWorkerInput[] = [];
	let handler: ((output: GlobalSearchWorkerOutput) => void) | null = null;
	return {
		factory: () => ({
			post(input: GlobalSearchWorkerInput) {
				posted.push(input);
				if (input.type === 'complete') {
					setTimeout(() => {
						handler?.({
							type: 'complete',
							result: {
								requestId: input.requestId,
								queryEmpty: false,
								cancelled: false,
								overLimit: false,
								totalMatches: 0,
								results: [],
								pages: 0,
								truncated: false,
							},
						});
					}, 0);
				}
			},
			onMessage(callback) {
				handler = callback;
			},
		}),
		posted,
	};
}

function msg(
	id: string,
	content: string,
	sender: string,
	timestamp: number,
): ChatMessage {
	return {
		id,
		content,
		sender,
		timestamp: new Date(timestamp),
		isSystemMessage: false,
		isMediaMessage: false,
		rawLine: `${timestamp} - ${sender}: ${content}`,
	};
}

function chat(
	archiveId: string,
	title: string,
	messages: ChatMessage[],
): ChatData {
	return {
		archiveId,
		title,
		messages,
		participants: [],
		startDate: null,
		endDate: null,
		messageCount: messages.length,
		mediaCount: 0,
		mediaFiles: [],
		hasMedia: false,
		contacts: new Map(),
	};
}

function createState(gate = true) {
	const storage = createInMemoryGlobalSearchStorage();
	const state = createGlobalSearchState({
		gate,
		storage,
		workerFactory: loopback(),
		estimateProvider: async () => ({
			usage: 0,
			quota: Number.MAX_SAFE_INTEGER,
		}),
	});
	return { state, storage };
}

describe('GH-67 global search state — fail-closed', () => {
	it('is inert when the gate is false', async () => {
		const { state } = createState(false);

		expect(state.enabled).toBe(false);
		expect(state.status).toBe('disabled');

		await state.initialize();
		state.setLoadedChats([
			chat('a1', 'Family', [msg('m1', 'hello', 'Ana', 1)]),
		]);
		await state.submitQuery('hello');

		expect(state.status).toBe('disabled');
		expect(state.results).toEqual([]);
		expect(state.coverage).toEqual([]);
	});
});

describe('GH-67 global search state — entry without a selected chat', () => {
	it('runs a query with no loaded chats and returns zero results', async () => {
		const { state } = createState();
		state.setLoadedChats([]);

		await state.submitQuery('hello');

		expect(state.status).toBe('complete');
		expect(state.results).toEqual([]);
		expect(state.totalMatches).toBe(0);
	});
});

describe('GH-67 global search state — identity and navigation', () => {
	it('navigates by canonical (archiveId, ordinal, messageId) despite title and message-id collisions', async () => {
		const { state } = createState();
		const first = chat('archive-a', 'Family', [
			msg('m1', 'hello world', 'Ana', 100),
		]);
		const second = chat('archive-b', 'Family', [
			msg('m1', 'hello world', 'Ana', 200),
		]);
		expect(first.title).toBe(second.title);
		state.setLoadedChats([first, second]);

		await state.submitQuery('hello');

		expect(state.results).toHaveLength(2);
		const byArchive = new Map(state.results.map((r) => [r.archiveId, r]));
		const outcomeA = state.openResult(byArchive.get('archive-a')!);
		const outcomeB = state.openResult(byArchive.get('archive-b')!);

		expect(outcomeA).toEqual({
			kind: 'navigate',
			archiveId: 'archive-a',
			ordinal: 0,
			messageId: 'm1',
		});
		expect(outcomeB).toEqual({
			kind: 'navigate',
			archiveId: 'archive-b',
			ordinal: 0,
			messageId: 'm1',
		});
	});

	it('returns requires-source for a remembered archive that is not loaded', async () => {
		const { state } = createState();
		state.setRememberedArchives([
			{ archiveId: 'archive-remembered', chatTitle: 'Remembered' },
		]);
		state.setLoadedChats([]);

		// Build a ready manifest for the remembered archive by indexing it first,
		// then simulate it being closed.
		state.setLoadedChats([
			chat('archive-remembered', 'Remembered', [
				msg('m9', 'needle', 'Ana', 300),
			]),
		]);
		await state.setConsentChoice('archive-remembered', 'keep-locally');

		// Close the chat (session only) — the index remains.
		state.setLoadedChats([]);

		await state.submitQuery('needle');
		expect(state.results).toHaveLength(1);

		const outcome = state.openResult(state.results[0]);
		expect(outcome).toEqual({
			kind: 'requires-source',
			archiveId: 'archive-remembered',
		});
		expect(state.sourceMissingArchiveId).toBe('archive-remembered');
	});

	it('preserves query and filters when the source is missing', async () => {
		const { state } = createState();
		state.setRememberedArchives([
			{ archiveId: 'archive-remembered', chatTitle: 'Remembered' },
		]);
		state.setLoadedChats([
			chat('archive-remembered', 'Remembered', [
				msg('m9', 'needle', 'Ana', 300),
			]),
		]);
		await state.setConsentChoice('archive-remembered', 'keep-locally');
		state.setLoadedChats([]);

		state.setFilters({ senders: ['Ana'] });
		await state.submitQuery('needle');
		state.openResult(state.results[0]);

		expect(state.query).toBe('needle');
		expect(state.filters).toEqual({ senders: ['Ana'] });
	});
});

describe('GH-67 global search state — empty query exposes coverage', () => {
	it('shows session-only coverage and no messages for an empty query', async () => {
		const { state } = createState();
		state.setLoadedChats([
			chat('a1', 'Family', [msg('m1', 'hello', 'Ana', 1)]),
		]);

		await state.submitQuery('   ');

		expect(state.status).toBe('idle');
		expect(state.results).toEqual([]);
		expect(state.totalMatches).toBe(0);
		expect(state.coverage).toEqual([
			{ archiveId: 'a1', chatTitle: 'Family', status: 'session-only' },
		]);
	});
});

describe('GH-67 global search state — 50-result paging', () => {
	it('pages deterministically at 50 items', async () => {
		const { state } = createState();
		const messages = Array.from({ length: 51 }, (_, index) =>
			msg(`m-${index}`, `match ${index}`, 'Ana', 1_000 + index),
		);
		state.setLoadedChats([chat('a1', 'Big', messages)]);

		await state.submitQuery('match');

		expect(state.results).toHaveLength(51);
		expect(state.totalPages).toBe(2);
		expect(state.pageSize).toBe(50);
		expect(state.pagedResults).toHaveLength(50);

		state.nextPage();
		expect(state.page).toBe(1);
		expect(state.pagedResults).toHaveLength(1);
		expect(state.canGoNext).toBe(false);
		expect(state.canGoPrev).toBe(true);
	});
});

describe('GH-67 global search state — consent and removal distinctions', () => {
	it('keep-locally indexes; session-only removes the index; close-chat keeps it', async () => {
		const { state } = createState();
		const archive = chat('a1', 'Family', [msg('m1', 'hello', 'Ana', 1)]);
		state.setLoadedChats([archive]);

		await state.setConsentChoice('a1', 'keep-locally');
		expect(state.isKeepingLocally('a1')).toBe(true);
		expect(state.coverage).toEqual([
			{ archiveId: 'a1', chatTitle: 'Family', status: 'ready' },
		]);

		// Close-chat (session removal only) must NOT drop the ready index.
		state.setLoadedChats([]);
		expect(state.coverage).toEqual([
			{ archiveId: 'a1', chatTitle: 'Family', status: 'ready' },
		]);

		state.setLoadedChats([archive]);
		await state.setConsentChoice('a1', 'session-only');
		expect(state.isKeepingLocally('a1')).toBe(false);
		expect(state.coverage).toEqual([
			{ archiveId: 'a1', chatTitle: 'Family', status: 'session-only' },
		]);
	});

	it('remove-from-library drops the archive entirely', async () => {
		const { state } = createState();
		const archive = chat('a1', 'Family', [msg('m1', 'hello', 'Ana', 1)]);
		state.setLoadedChats([archive]);
		state.setRememberedArchives([{ archiveId: 'a1', chatTitle: 'Family' }]);
		await state.setConsentChoice('a1', 'keep-locally');

		// Close the chat first (remove-from-library is a separate action that
		// also removes the persisted index + consent).
		state.setLoadedChats([]);

		const report = await state.removeFromLibrary('a1');
		expect(report.complete).toBe(true);
		expect(state.isKeepingLocally('a1')).toBe(false);

		// §5: removal drops the archive from coverage entirely — no longer
		// loaded, remembered, ready, stale or failed.
		expect(state.coverage).toEqual([]);
	});

	it('delete-all-local-indices removes only the global-search namespace and acknowledges', async () => {
		const { state, storage } = createState();
		const archive = chat('a1', 'Family', [msg('m1', 'hello', 'Ana', 1)]);
		state.setLoadedChats([archive]);
		await state.setConsentChoice('a1', 'keep-locally');

		const report = await state.deleteAllLocalIndices();
		expect(report.complete).toBe(true);
		expect(report.remaining).toBe(0);
		expect(state.deleteAllAcknowledged).toBe(true);
		expect(state.coverage).toEqual([
			{ archiveId: 'a1', chatTitle: 'Family', status: 'session-only' },
		]);

		const remainingKeys = await storage.keys();
		expect(remainingKeys).toEqual([]);
	});
});

describe('GH-67 global search state — cancellation and focus', () => {
	it('cancels an in-flight query and requests input focus', async () => {
		const { state } = createState();
		const messages = Array.from({ length: 5_000 }, (_, index) =>
			msg(`m-${index}`, `match ${index}`, 'Ana', index),
		);
		state.setLoadedChats([chat('big', 'Big', messages)]);

		const run = state.submitQuery('match');
		state.cancel();
		await run;

		expect(state.status).toBe('cancelled');
		expect(state.results).toEqual([]);
		expect(state.focusTarget).toBe('input');
	});
});

describe('GH-67 global search state — local-search shortcut isolation', () => {
	it('does not touch the local (in-chat) search state', async () => {
		const app = createAppState();
		const { state } = createState();
		state.setLoadedChats([
			chat('a1', 'Family', [msg('m1', 'hello', 'Ana', 1)]),
		]);

		app.setSearchQuery('local-needle');
		await state.submitQuery('global-needle');

		// The local search query and results are untouched by global search.
		expect(app.searchQuery).toBe('local-needle');
		expect(app.searchResultIds).toEqual([]);
		expect(state.query).toBe('global-needle');
	});
});

describe('GH-67 global search state — structured-clone post boundary', () => {
	it('posts a start request whose filters are plain data, not the live $state proxy', async () => {
		const { factory, posted } = recordingTransport();
		const state = createGlobalSearchState({
			gate: true,
			storage: createInMemoryGlobalSearchStorage(),
			workerFactory: factory,
			estimateProvider: async () => ({
				usage: 0,
				quota: Number.MAX_SAFE_INTEGER,
			}),
		});
		await state.initialize();
		state.setFilters({ archiveIds: ['a1'], senders: ['Ana'] });

		await state.submitQuery('hello');
		const start = posted.find((input) => input.type === 'start');
		expect(start).toBeDefined();

		// The real dedicated-worker transport runs worker.postMessage(input),
		// which serializes the payload with the structured-clone algorithm
		// and rejects Svelte 5 $state deep proxies with DataCloneError (seen
		// in the harness build). The request must therefore carry a plain
		// snapshot of filters, never the live reactive $state object.
		expect(() => structuredClone(start)).not.toThrow();
		if (start?.type === 'start') {
			expect(start.request.filters).not.toBe(state.filters);
			expect(() => structuredClone(start.request.filters)).not.toThrow();
			expect(start.request.filters).toEqual({
				archiveIds: ['a1'],
				senders: ['Ana'],
			});
		}
		expect(state.status).toBe('complete');
	});
});

describe('GH-67 global search state — interleaved corpus prep', () => {
	/**
	 * Loopback transport that ALSO records every posted input, so a query
	 * with loaded chats can settle (shard-consumed acks) while the posted
	 * request envelope stays inspectable.
	 */
	function recordingLoopback(): {
		factory: () => GlobalSearchTransport;
		posted: GlobalSearchWorkerInput[];
	} {
		const posted: GlobalSearchWorkerInput[] = [];
		const inner = loopback()();
		return {
			factory: () => ({
				post(input: GlobalSearchWorkerInput) {
					posted.push(input);
					inner.post(input);
				},
				onMessage(handler) {
					inner.onMessage(handler);
				},
			}),
			posted,
		};
	}

	it('reports the same searchable-byte envelope as the document-based computation', async () => {
		const { factory, posted } = recordingLoopback();
		const state = createGlobalSearchState({
			gate: true,
			storage: createInMemoryGlobalSearchStorage(),
			workerFactory: factory,
			estimateProvider: async () => ({
				usage: 0,
				quota: Number.MAX_SAFE_INTEGER,
			}),
		});
		await state.initialize();
		const chats = [
			chat('a1', 'Family', [
				msg('m1', 'olá mundo', 'Ana ação', 1),
				msg('m2', 'café ☕ mañana', 'Zoë', 2),
			]),
			chat('a2', 'Work', [
				msg('m3', '東京 こんにちは 🚀', '李雷', 3),
				msg('m4', 'plain ascii', 'Noah', 4),
			]),
		];
		state.setLoadedChats(chats);

		await state.submitQuery('hello');
		const start = posted.find((input) => input.type === 'start');
		expect(start?.type).toBe('start');

		// The interleaved slice-based byte pass must agree with the reference
		// computation over the built documents (the pre-interleaving path).
		const expectedBytes = chats.reduce(
			(sum, loadedChat) =>
				sum + searchableUtf8Bytes(buildSessionDocuments(loadedChat)),
			0,
		);
		if (start?.type === 'start') {
			expect(start.request.corpusSearchableBytes).toBe(expectedBytes);
		}
		expect(state.status).toBe('complete');
	});
});

describe('GH-67 global search state — prepared-source cache', () => {
	/**
	 * Loopback transport that records every posted input, so a query with
	 * loaded chats can settle (shard-consumed acks) while the posted shard
	 * arrays stay inspectable. Shard arrays are compared BY REFERENCE: the
	 * prepared-source cache replays the exact materialized arrays on repeat
	 * queries, while a re-prep would allocate fresh ones.
	 */
	function recordingLoopback(): {
		factory: () => GlobalSearchTransport;
		posted: GlobalSearchWorkerInput[];
	} {
		const posted: GlobalSearchWorkerInput[] = [];
		const inner = loopback()();
		return {
			factory: () => ({
				post(input: GlobalSearchWorkerInput) {
					posted.push(input);
					inner.post(input);
				},
				onMessage(handler) {
					inner.onMessage(handler);
				},
			}),
			posted,
		};
	}

	function shardInputs(posted: GlobalSearchWorkerInput[]) {
		return posted.filter(
			(input): input is Extract<GlobalSearchWorkerInput, { type: 'shard' }> =>
				input.type === 'shard',
		);
	}

	async function stateWithCorpus(recorded: {
		factory: () => GlobalSearchTransport;
		posted: GlobalSearchWorkerInput[];
	}) {
		const state = createGlobalSearchState({
			gate: true,
			storage: createInMemoryGlobalSearchStorage(),
			workerFactory: recorded.factory,
			estimateProvider: async () => ({
				usage: 0,
				quota: Number.MAX_SAFE_INTEGER,
			}),
		});
		await state.initialize();
		return state;
	}

	it('reuses the materialized shards on a repeat query over an unchanged corpus', async () => {
		const recorded = recordingLoopback();
		const state = await stateWithCorpus(recorded);
		state.setLoadedChats([
			chat('a1', 'Family', [
				msg('m1', 'needle one', 'Ana', 1),
				msg('m2', 'needle two', 'Ana', 2),
			]),
			chat('a2', 'Work', [msg('m3', 'needle three', 'Noah', 3)]),
		]);

		await state.submitQuery('needle');
		await state.submitQuery('needle');

		const shards = shardInputs(recorded.posted);
		// Two runs over two chats → 2 shards per run (each chat packs into a
		// single shard under the 2,000-doc cap).
		expect(shards.length).toBe(4);
		// Cached replay: run 2 posts the EXACT same pre-serialized payload
		// strings as run 1 — re-preparing would have built fresh strings
		// (RED before the cache).
		expect(shards[2]?.documentsJson).toBe(shards[0]?.documentsJson);
		expect(shards[3]?.documentsJson).toBe(shards[1]?.documentsJson);
		expect(state.status).toBe('complete');
	});

	it('does not re-run the byte-envelope pass on a repeat query over an unchanged corpus', async () => {
		// The shard cache is already proven above; the warm indexingMs cost
		// is the searchable-byte envelope pass re-encoding every message on
		// EVERY submit. A repeat query over identical chats must reuse the
		// cached envelope instead of re-encoding the corpus.
		const spy = vi.spyOn(documentsModule, 'searchableUtf8BytesOfMessages');
		const recorded = recordingLoopback();
		const state = await stateWithCorpus(recorded);
		const messages = Array.from({ length: 50 }, (_, index) =>
			msg(`m-${index}`, `needle ${index}`, 'Ana', index),
		);
		state.setLoadedChats([chat('a1', 'Family', messages)]);

		await state.submitQuery('needle');
		const callsAfterFirst = spy.mock.calls.length;
		expect(callsAfterFirst).toBeGreaterThan(0);

		await state.submitQuery('needle');
		expect(spy.mock.calls.length).toBe(callsAfterFirst);
		spy.mockRestore();
	});

	it('re-prepares only the mutated chat when loaded content changes', async () => {
		const recorded = recordingLoopback();
		const state = await stateWithCorpus(recorded);
		state.setLoadedChats([
			chat('a1', 'Family', [
				msg('m1', 'needle one', 'Ana', 1),
				msg('m2', 'needle two', 'Ana', 2),
			]),
			chat('a2', 'Work', [msg('m3', 'needle three', 'Noah', 3)]),
		]);

		await state.submitQuery('needle');
		// Mutate chat a1: append a message (same archiveId, new content).
		state.setLoadedChats([
			chat('a1', 'Family', [
				msg('m1', 'needle one', 'Ana', 1),
				msg('m2', 'needle two', 'Ana', 2),
				msg('m9', 'added message', 'Ana', 9),
			]),
			chat('a2', 'Work', [msg('m3', 'needle three', 'Noah', 3)]),
		]);
		await state.submitQuery('needle');

		const shards = shardInputs(recorded.posted);
		// Run 1: [a1-shard, a2-shard]; run 2: [a1-shard', a2-shard].
		expect(shards.length).toBe(4);
		// a1 changed → fresh prep (new payload strings).
		expect(shards[2]?.documentsJson).not.toBe(shards[0]?.documentsJson);
		// a2 unchanged → replayed from the cache (same payload strings).
		expect(shards[3]?.documentsJson).toBe(shards[1]?.documentsJson);
	});

	it('re-prepares after the harness drop hook clears the prepared-source cache', async () => {
		// The benchmark's cancellation sample needs a deterministic cold scan
		// window: the harness bridge hook must force a full re-prep on the NEXT
		// query even when the corpus is byte-identical (a cache replay would
		// finish the scan before the mid-scan cancel click could land).
		const spy = vi.spyOn(documentsModule, 'buildSessionDocumentsFromMessages');
		const recorded = recordingLoopback();
		const state = await stateWithCorpus(recorded);
		state.setLoadedChats([
			chat('a1', 'Family', [msg('m1', 'needle one', 'Ana', 1)]),
			chat('a2', 'Work', [msg('m3', 'needle three', 'Noah', 3)]),
		]);

		await state.submitQuery('needle');
		const prepCallsAfterRun1 = spy.mock.calls.length;
		expect(prepCallsAfterRun1).toBeGreaterThan(0);

		// Warm replay: an unchanged corpus must NOT re-prepare.
		await state.submitQuery('needle');
		expect(spy.mock.calls.length).toBe(prepCallsAfterRun1);

		// Drop the cache through the harness hook: the SAME unchanged corpus
		// must now go through document building again (cold window for the
		// cancellation sample) instead of replaying the cached shards.
		state.dropPreparedSourcesCache();
		await state.submitQuery('needle');
		expect(spy.mock.calls.length).toBeGreaterThan(prepCallsAfterRun1);
		spy.mockRestore();
	});

	it('drops the prepared source when the archive is removed from the library', async () => {
		// Pre-serialized payloads for identical content are byte-identical, so a
		// fresh re-prep is observable only through the rebuild itself: the §5
		// removal cascade must have dropped the cache entry, and the re-added
		// chat goes through document building again instead of a cache replay.
		const spy = vi.spyOn(documentsModule, 'buildSessionDocumentsFromMessages');
		const recorded = recordingLoopback();
		const state = await stateWithCorpus(recorded);
		state.setLoadedChats([
			chat('a1', 'Family', [msg('m1', 'needle one', 'Ana', 1)]),
			chat('a2', 'Work', [msg('m3', 'needle three', 'Noah', 3)]),
		]);

		await state.submitQuery('needle');
		const prepCallsAfterRun1 = spy.mock.calls.length;
		await state.removeFromLibrary('a1');
		// Re-add a1 with the SAME content (identical fingerprint): the §5
		// removal cascade must have dropped the cache entry, so the query
		// treats it as a fresh load and re-prepares instead of replaying.
		state.setLoadedChats([
			chat('a1', 'Family', [msg('m1', 'needle one', 'Ana', 1)]),
			chat('a2', 'Work', [msg('m3', 'needle three', 'Noah', 3)]),
		]);
		await state.submitQuery('needle');

		const shards = shardInputs(recorded.posted);
		expect(shards.length).toBe(4);
		expect(spy.mock.calls.length).toBeGreaterThan(prepCallsAfterRun1);
		spy.mockRestore();
	});
});

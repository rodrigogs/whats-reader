/**
 * GH-67 §5/§7/§8 — Rune-backed global-search state.
 *
 * This is the UI-side controller for the accessible global (not local-chat)
 * search surface. It is deliberately separate from the local search state
 * (`state.svelte.ts`) and never reads or mutates it, so the two shortcuts stay
 * fully isolated.
 *
 * Fail-closed contract (§8): when the build-time gate is false — or when no
 * persistence backend is provided — the feature is inert. It renders no
 * results, performs no reads/writes, and every persistence action is a no-op.
 * The gate is never inferred from `GLOBAL_SEARCH_V1_ENABLED` as a substitute
 * for a missing worker/persistence contract; both must be wired by the caller.
 *
 * Svelte 5 runes only. No stores. Persistence/consent/query logic lives in the
 * pure modules; this file only orchestrates them reactively.
 */

import type { ChatData } from '../state.svelte';
import {
	createStorageConsentStore,
	revokeConsent as deleteConsent,
	type GlobalSearchConsent,
	type GlobalSearchConsentChoice,
	isConsentValidForPersistence,
	readConsent,
	grantConsent as writeConsent,
} from './consent';
import { computeCoverage, type GlobalSearchCoverageEntry } from './coverage';
import {
	buildSessionDocuments,
	buildSessionDocumentsFromMessages,
	searchableUtf8BytesOfMessages,
} from './documents';
import {
	commitGeneration,
	type GlobalSearchIndexOutcome,
	listReadyArchives,
	readReadyGeneration,
	startupCleanup,
} from './index-lifecycle';
import {
	createNoopPersistedChatRemovalStore,
	type LibraryRemovalReadback,
	type PersistedChatRemovalStore,
	removeFromLibraryCascade,
} from './library-removal';
import {
	GLOBAL_SEARCH_KEY_PREFIX,
	GLOBAL_SEARCH_V1_ENABLED,
	type GlobalSearchManifest,
} from './manifest';
import {
	createGlobalSearchQueryClient,
	createWorkerTransport,
	type GlobalSearchQueryClient,
	type GlobalSearchShardPayload,
	type GlobalSearchSource,
	type GlobalSearchTransport,
} from './query-orchestrator';
import {
	createSerializedShardPayload,
	GLOBAL_SEARCH_PAGE_SIZE,
	type GlobalSearchFilters,
	type GlobalSearchQueryProgress,
	type GlobalSearchQueryRequest,
	type GlobalSearchResult,
} from './query-worker';
import {
	type DeleteAllReadback,
	deleteAllIndices,
	removeArchiveIndex,
} from './removal';
import { createGlobalSearchShardPacker, yieldToMacrotask } from './shard';
import {
	createInMemoryGlobalSearchStorage,
	type GlobalSearchStorage,
} from './storage';
import {
	createBrowserStorageEstimateProvider,
	type StorageEstimateProvider,
} from './storage-estimate';

export type GlobalSearchStatus =
	| 'disabled'
	| 'idle'
	| 'searching'
	| 'complete'
	| 'cancelled'
	| 'over-limit'
	| 'error';

export type GlobalSearchOpenOutcome =
	| { kind: 'navigate'; archiveId: string; ordinal: number; messageId: string }
	| { kind: 'requires-source'; archiveId: string }
	| { kind: 'unavailable'; archiveId: string };

export type GlobalSearchStateDeps = {
	/** Build-time feature gate. Defaults to the module constant (false). */
	gate?: boolean;
	/**
	 * Persistence backend. Absent → session-only: consent is held in memory and
	 * no index is written (fail-closed).
	 */
	storage?: GlobalSearchStorage;
	estimateProvider?: StorageEstimateProvider;
	/** Transport factory. Tests inject a loopback; production uses the worker. */
	workerFactory?: () => GlobalSearchTransport;
	/**
	 * Persisted-chat metadata/file-handle adapter for the unified §5 removal
	 * cascade. Absent → a no-op store (session-only archives: removal is a
	 * persistence no-op but still clears in-session state). Production wires
	 * `idbPersistedChatRemovalStore`.
	 */
	persistedLibraryStore?: PersistedChatRemovalStore;
};

export type RememberedArchiveEntry = {
	archiveId: string;
	chatTitle: string;
};

export function createGlobalSearchState(deps: GlobalSearchStateDeps = {}) {
	const gate = deps.gate ?? GLOBAL_SEARCH_V1_ENABLED;
	const storage: GlobalSearchStorage =
		deps.storage ?? createInMemoryGlobalSearchStorage();
	const hasStorage = deps.storage !== undefined;
	const estimateProvider =
		deps.estimateProvider ?? createBrowserStorageEstimateProvider();
	const workerFactory = deps.workerFactory ?? createWorkerTransport;
	const consentStore = createStorageConsentStore(storage);
	const persistedStore =
		deps.persistedLibraryStore ?? createNoopPersistedChatRemovalStore();

	// ── Reactive inputs ────────────────────────────────────────────────────
	let loadedChats = $state<ChatData[]>([]);
	let rememberedArchiveIds = $state<Set<string>>(new Set());
	let rememberedTitles = $state<Map<string, string>>(new Map());
	let consentByArchive = $state<Map<string, GlobalSearchConsent>>(new Map());
	let indexingArchiveIds = $state<Set<string>>(new Set());
	let readyManifests = $state<Map<string, GlobalSearchManifest>>(new Map());
	let staleArchiveIds = $state<Set<string>>(new Set());
	let failedArchiveIds = $state<Set<string>>(new Set());
	let initialized = $state(false);

	// ── Query state ────────────────────────────────────────────────────────
	let query = $state('');
	let filters = $state<GlobalSearchFilters>({});
	let results = $state<GlobalSearchResult[]>([]);
	let page = $state(0);
	let totalMatches = $state(0);
	let truncated = $state(false);
	let status = $state<GlobalSearchStatus>(gate ? 'idle' : 'disabled');
	let progress = $state<GlobalSearchQueryProgress | null>(null);
	let sourceMissingArchiveId = $state<string | null>(null);
	let deleteAllAcknowledged = $state(false);
	/** Focus management intent consumed by the UI (input | results | null). */
	let focusTarget = $state<'input' | 'results' | null>(null);

	// ── Worker / client (lazy, reused so removals survive) ─────────────────
	let client: GlobalSearchQueryClient | null = null;
	let currentRequestId: string | null = null;

	function ensureClient(): GlobalSearchQueryClient | null {
		if (!gate) return null;
		if (!client) {
			client = createGlobalSearchQueryClient(workerFactory());
		}
		return client;
	}

	// ── Derived values ─────────────────────────────────────────────────────
	const coverage = $derived.by(() =>
		computeCoverage({
			gate,
			loaded: loadedChats.map((chat) => ({
				archiveId: chat.archiveId,
				chatTitle: chat.title,
			})),
			ready: [...readyManifests.values()].map((manifest) => ({
				archiveId: manifest.archiveId,
				chatTitle: manifest.chatTitle,
			})),
			stale: [...staleArchiveIds].map((archiveId) => ({
				archiveId,
				chatTitle: rememberedTitles.get(archiveId) ?? '',
			})),
			failed: [...failedArchiveIds].map((archiveId) => ({
				archiveId,
				chatTitle: rememberedTitles.get(archiveId) ?? '',
			})),
			remembered: [...rememberedArchiveIds]
				.filter(
					(archiveId) =>
						!loadedChats.some((chat) => chat.archiveId === archiveId),
				)
				.map((archiveId) => ({
					archiveId,
					chatTitle: rememberedTitles.get(archiveId) ?? '',
				})),
			consentKeepLocally: new Set(
				[...consentByArchive.entries()]
					.filter(([archiveId, consent]) =>
						isConsentValidForPersistence(consent, archiveId),
					)
					.map(([archiveId]) => archiveId),
			),
			indexing: indexingArchiveIds,
		}),
	);

	const totalPages = $derived(
		Math.ceil(results.length / GLOBAL_SEARCH_PAGE_SIZE),
	);
	const pagedResults = $derived(
		results.slice(
			page * GLOBAL_SEARCH_PAGE_SIZE,
			(page + 1) * GLOBAL_SEARCH_PAGE_SIZE,
		),
	);
	const canGoPrev = $derived(page > 0);
	const canGoNext = $derived(page < totalPages - 1);

	// ── Lifecycle helpers ──────────────────────────────────────────────────
	async function refreshManifests(): Promise<void> {
		if (!gate) {
			readyManifests = new Map();
			staleArchiveIds = new Set();
			failedArchiveIds = new Set();
			return;
		}
		const ready = await listReadyArchives(storage, gate);
		const readyMap = new Map<string, GlobalSearchManifest>();
		for (const manifest of ready) {
			readyMap.set(manifest.archiveId, manifest);
		}
		readyManifests = readyMap;

		// Stale/failed manifests are read directly (they are never returned by
		// listReadyArchives). Titles come from the manifest itself.
		const stale = new Set<string>();
		const failed = new Set<string>();
		const manifestPrefix = `${GLOBAL_SEARCH_KEY_PREFIX}manifest-`;
		const allKeys = await storage.keys();
		for (const key of allKeys) {
			if (!key.startsWith(manifestPrefix)) continue;
			const manifest = await storage.get<GlobalSearchManifest>(key);
			if (!manifest) continue;
			if (manifest.state === 'stale') stale.add(manifest.archiveId);
			if (manifest.state === 'failed') failed.add(manifest.archiveId);
		}
		staleArchiveIds = stale;
		failedArchiveIds = failed;
	}

	async function refreshConsent(): Promise<void> {
		const next = new Map<string, GlobalSearchConsent>();
		if (gate) {
			const archiveIds = new Set<string>([
				...loadedChats.map((chat) => chat.archiveId),
				...rememberedArchiveIds,
				...readyManifests.keys(),
			]);
			for (const archiveId of archiveIds) {
				const consent = await readConsent(consentStore, archiveId);
				if (consent) next.set(archiveId, consent);
			}
		}
		consentByArchive = next;
	}

	async function initialize(): Promise<void> {
		if (initialized) return;
		initialized = true;
		if (!gate) {
			status = 'disabled';
			return;
		}
		await startupCleanup(storage, gate);
		await refreshManifests();
		await refreshConsent();
	}

	// ── Input sync (called by +page.svelte) ───────────────────────────────
	// The consent refresh is deferred to a microtask so its synchronous reads
	// of loadedChats/rememberedArchiveIds/readyManifests do NOT run inside the
	// caller's $effect tracking scope. When the harness build turns the gate
	// on, the caller effect writes these same states here; refreshing consent
	// synchronously would make the effect read what it writes and loop
	// (effect_update_depth_exceeded). Deferring keeps the eventual consent
	// map identical while breaking the cycle.
	function setLoadedChats(chats: ChatData[]): void {
		loadedChats = chats;
		queueMicrotask(() => void refreshConsent());
	}

	function setRememberedArchives(entries: RememberedArchiveEntry[]): void {
		rememberedArchiveIds = new Set(entries.map((entry) => entry.archiveId));
		rememberedTitles = new Map(
			entries.map((entry) => [entry.archiveId, entry.chatTitle]),
		);
		queueMicrotask(() => void refreshConsent());
	}

	// ── Consent ────────────────────────────────────────────────────────────
	async function indexArchive(
		archiveId: string,
		consent: GlobalSearchConsent,
	): Promise<GlobalSearchIndexOutcome | null> {
		const chat = loadedChats.find(
			(candidate) => candidate.archiveId === archiveId,
		);
		if (!chat) return null;
		if (!gate || !hasStorage) return null;
		if (!isConsentValidForPersistence(consent, archiveId)) return null;

		const documents = buildSessionDocuments(chat);
		if (documents.length === 0) return null;

		indexingArchiveIds = new Set([...indexingArchiveIds, archiveId]);
		try {
			const outcome = await commitGeneration({
				archiveId,
				chatTitle: chat.title,
				documents,
				consent,
				gate,
				storage,
				estimateProvider,
			});
			if (outcome.status === 'committed') {
				readyManifests = new Map(readyManifests).set(
					archiveId,
					outcome.manifest,
				);
			} else if (outcome.status === 'failed') {
				failedArchiveIds = new Set([...failedArchiveIds, archiveId]);
			}
			return outcome;
		} finally {
			const next = new Set(indexingArchiveIds);
			next.delete(archiveId);
			indexingArchiveIds = next;
		}
	}

	async function setConsentChoice(
		archiveId: string,
		choice: GlobalSearchConsentChoice,
	): Promise<void> {
		const consent = await writeConsent(consentStore, archiveId, choice);
		consentByArchive = new Map(consentByArchive).set(archiveId, consent);

		if (choice === 'keep-locally') {
			await indexArchive(archiveId, consent);
		} else {
			// Switching to session-only removes any previously persisted index.
			await removeArchiveIndex(storage, archiveId, gate);
			readyManifests = new Map(readyManifests);
			readyManifests.delete(archiveId);
		}
	}

	async function revokeConsent(archiveId: string): Promise<void> {
		await deleteConsent(consentStore, archiveId);
		const next = new Map(consentByArchive);
		next.delete(archiveId);
		consentByArchive = next;
		await removeArchiveIndex(storage, archiveId, gate);
		const ready = new Map(readyManifests);
		ready.delete(archiveId);
		readyManifests = ready;
	}

	function getConsent(archiveId: string): GlobalSearchConsent | undefined {
		return consentByArchive.get(archiveId);
	}

	function isKeepingLocally(archiveId: string): boolean {
		return isConsentValidForPersistence(
			consentByArchive.get(archiveId),
			archiveId,
		);
	}

	// ── Query ──────────────────────────────────────────────────────────────
	function setQuery(value: string): void {
		query = value;
	}

	function setFilters(value: GlobalSearchFilters): void {
		filters = value;
	}

	function cancel(): void {
		if (currentRequestId) {
			client?.cancel(currentRequestId);
		}
	}

	function requestId(): string {
		return crypto.randomUUID();
	}

	// ── Prepared-source cache ─────────────────────────────────────────────
	// Repeat queries over an unchanged corpus must not re-run the per-archive
	// document building + shard packing on the main thread: even with the
	// macrotask interleave, that prep burned wall-clock between the first
	// shard and the terminal (totalMs ~1.3 s on the 100k corpus). The cache
	// materializes each archive's shards once and replays them on later
	// queries; a content fingerprint invalidates the entry when the chat
	// mutates, and the §5 removal cascade drops it eagerly. The benchmark
	// harness can drop the whole cache (see dropPreparedSourcesCache) to
	// force a deterministic cold scan window for its cancellation sample.
	const preparedSourceCache = new Map<
		string,
		{ fingerprint: string; source: GlobalSearchSource }
	>();

	/**
	 * The shards depend only on archiveId + message ids/order; the chat title
	 * is display metadata carried by the per-query request envelope, so a
	 * rename alone does not invalidate the materialized shards.
	 */
	function chatFingerprint(chat: ChatData): string {
		const first = chat.messages[0];
		const last = chat.messages[chat.messages.length - 1];
		return [
			chat.archiveId,
			chat.messages.length,
			first?.id ?? '',
			last?.id ?? '',
		].join('|');
	}

	// ── Byte-envelope cache (lever 1: warm submits must be O(1)) ──────────
	// `indexingMs` (submit → first shard) on warm samples used to be
	// 190–289ms purely from the searchable-byte envelope pass re-encoding
	// every message on EVERY submit. The shard cache was already hitting
	// (proven by reference equality); the envelope was the remaining
	// O(corpus) work. Cache the computed envelope keyed by a corpus
	// fingerprint that covers every loaded chat and every ready manifest;
	// any mutation or removal changes the fingerprint, so the cache can
	// never serve a stale envelope.
	let envelopeCache: {
		fingerprint: string;
		corpusMessageCount: number;
		corpusSearchableBytes: number;
	} | null = null;

	/**
	 * Drop every materialized prepared source and the cached byte envelope so
	 * the NEXT query runs the cold prep path. This is the benchmark harness's
	 * deterministic cold-window hook: the cancellation observation sample
	 * needs a scan that lasts long enough for a mid-scan cancel click to land,
	 * which a warm cache replay would finish before the click. The corpus
	 * itself is untouched — a repeat query simply re-prepares identical
	 * shards (byte-identical payloads) and re-runs the envelope pass.
	 */
	function dropPreparedSourcesCache(): void {
		preparedSourceCache.clear();
		envelopeCache = null;
	}

	function corpusFingerprint(): string {
		const loaded = [...loadedChats]
			.map((chat) => chatFingerprint(chat))
			.sort()
			.join('|');
		const manifests = [...readyManifests.entries()]
			.map(
				([archiveId, manifest]) =>
					`${archiveId}:${manifest.messageCount}:${manifest.searchableUtf8Bytes}`,
			)
			.sort()
			.join('|');
		return `${loaded}||${manifests}`;
	}

	/**
	 * Compute (or replay from cache) the searchable-byte envelope over the
	 * current corpus. The interleaved slice pass with macrotask yields is
	 * only paid once per fingerprint; repeat queries over unchanged chats
	 * reuse the cached values, so warm indexingMs collapses to ~ms.
	 */
	async function corpusEnvelope(): Promise<{
		corpusMessageCount: number;
		corpusSearchableBytes: number;
	}> {
		const fingerprint = corpusFingerprint();
		if (envelopeCache && envelopeCache.fingerprint === fingerprint) {
			return {
				corpusMessageCount: envelopeCache.corpusMessageCount,
				corpusSearchableBytes: envelopeCache.corpusSearchableBytes,
			};
		}

		// Searchable byte envelope, computed over bounded message slices with
		// macrotask yields so the pass never blocks the main thread (it used
		// to re-build every chat's documents synchronously here).
		let corpusMessageCount = loadedChats.reduce(
			(sum, chat) => sum + chat.messages.length,
			0,
		);
		let corpusSearchableBytes = 0;
		for (const chat of loadedChats) {
			const messages = chat.messages;
			for (let start = 0; start < messages.length; start += 2_000) {
				corpusSearchableBytes += searchableUtf8BytesOfMessages(
					messages.slice(start, Math.min(start + 2_000, messages.length)),
				);
				await yieldToMacrotask();
			}
		}

		// Persisted archives that are not currently loaded contribute their
		// declared manifest bytes (already computed at index time).
		for (const manifest of readyManifests.values()) {
			corpusMessageCount += manifest.messageCount;
			corpusSearchableBytes += manifest.searchableUtf8Bytes;
		}

		envelopeCache = { fingerprint, corpusMessageCount, corpusSearchableBytes };
		return { corpusMessageCount, corpusSearchableBytes };
	}

	/**
	 * A source is created lazily: no document building or shard splitting
	 * happens at submit time. The heavy per-archive prep runs inside the
	 * `shards()` generator, one bounded slice at a time with a real macrotask
	 * yield between slices, so the submit path never blocks the main thread
	 * on a whole corpus (the pre-fix behavior showed up as a ~1 s long task
	 * on the 100k benchmark corpus). Prepared sources are cached per
	 * archiveId and replayed on repeat queries over unchanged content; each
	 * shard is kept PRE-SERIALIZED so a replay posts one JSON string (with
	 * its exact byte length) instead of re-stringifying or cloning 2,000
	 * objects per shard.
	 */
	function sessionSource(chat: ChatData): GlobalSearchSource | null {
		if (chat.messages.length === 0) return null;
		const fingerprint = chatFingerprint(chat);
		const cached = preparedSourceCache.get(chat.archiveId);
		if (cached !== undefined && cached.fingerprint === fingerprint) {
			return cached.source;
		}
		const source = createPreparedSessionSource(chat);
		preparedSourceCache.set(chat.archiveId, { fingerprint, source });
		return source;
	}

	function createPreparedSessionSource(chat: ChatData): GlobalSearchSource {
		let prepared: GlobalSearchShardPayload[] | null = null;
		return {
			archiveId: chat.archiveId,
			chatTitle: chat.title,
			async *shards() {
				// First iteration materializes (interleaved with macrotask
				// yields); every later iteration replays the exact cached
				// pre-serialized payloads — a repeat query posts them
				// immediately, no re-prep, no re-stringify.
				if (prepared !== null) {
					for (const payload of prepared) yield payload;
					return;
				}
				const materialized: GlobalSearchShardPayload[] = [];
				const packer = createGlobalSearchShardPacker(chat.archiveId, 0);
				const messages = chat.messages;
				const sliceSize = 2_000;
				for (let start = 0; start < messages.length; start += sliceSize) {
					const chunk = messages.slice(
						start,
						Math.min(start + sliceSize, messages.length),
					);
					const documents = buildSessionDocumentsFromMessages(
						chat.archiveId,
						chunk,
						start,
					);
					for (const document of documents) {
						const flushed = packer.push(document);
						if (flushed) {
							const payload: GlobalSearchShardPayload = {
								documentsJson: flushed.serialisedJson,
								serialisedBytes: flushed.serialisedBytes,
							};
							materialized.push(payload);
							yield payload;
						}
					}
					await yieldToMacrotask();
				}
				const final = packer.flush();
				if (final) {
					const payload: GlobalSearchShardPayload = {
						documentsJson: final.serialisedJson,
						serialisedBytes: final.serialisedBytes,
					};
					materialized.push(payload);
					yield payload;
				}
				prepared = materialized;
			},
		};
	}

	async function persistedSource(
		archiveId: string,
		chatTitle: string,
	): Promise<GlobalSearchSource | null> {
		const ready = await readReadyGeneration(storage, archiveId, gate);
		if (!ready) return null;
		return {
			archiveId,
			chatTitle,
			async *shards() {
				for (const shard of ready.shards) {
					// Persisted shards are read back as plain document
					// arrays; build the pre-serialized wire payload once per
					// query (the storage read already dominates this path).
					yield createSerializedShardPayload(shard);
				}
			},
		};
	}

	async function submitQuery(rawQuery: string): Promise<void> {
		query = rawQuery;

		if (!gate) {
			status = 'disabled';
			results = [];
			return;
		}

		// Empty query → coverage only, no messages.
		if (rawQuery.trim().length === 0) {
			cancel();
			results = [];
			totalMatches = 0;
			truncated = false;
			page = 0;
			status = 'idle';
			progress = null;
			sourceMissingArchiveId = null;
			focusTarget = 'input';
			return;
		}

		const activeClient = ensureClient();
		if (!activeClient) {
			status = 'disabled';
			results = [];
			return;
		}

		const id = requestId();
		currentRequestId = id;
		status = 'searching';
		progress = null;
		focusTarget = null;

		const loadedIds = new Set(loadedChats.map((chat) => chat.archiveId));
		const archiveTitles: Record<string, string> = {};
		const sources: GlobalSearchSource[] = [];

		for (const chat of loadedChats) {
			archiveTitles[chat.archiveId] = chat.title;
			const source = sessionSource(chat);
			if (source) sources.push(source);
		}

		// Searchable byte envelope: cached per corpus fingerprint, so repeat
		// queries over an unchanged corpus reuse it (warm indexingMs ~ms)
		// instead of re-encoding every message on every submit.
		const { corpusMessageCount, corpusSearchableBytes } =
			await corpusEnvelope();

		// Persisted archives that are not currently loaded.
		for (const [archiveId, manifest] of readyManifests) {
			if (loadedIds.has(archiveId)) continue;
			archiveTitles[archiveId] = manifest.chatTitle;
			const source = await persistedSource(archiveId, manifest.chatTitle);
			if (source) sources.push(source);
		}

		// `filters` is a Svelte 5 `$state` deep proxy; the worker transport
		// serializes the request with structuredClone, which rejects proxies
		// (DataCloneError). Cross the post boundary with a plain snapshot —
		// `filters` itself stays reactive for the UI.
		const request: GlobalSearchQueryRequest = {
			requestId: id,
			query: rawQuery,
			filters: $state.snapshot(filters),
			corpusMessageCount,
			corpusSearchableBytes,
			archiveTitles,
		};

		try {
			const result = await activeClient.run(request, sources, (next) => {
				progress = next;
			});

			if (currentRequestId !== id) return; // a newer request superseded us

			if (result.cancelled) {
				status = 'cancelled';
				results = [];
				totalMatches = 0;
				truncated = false;
				page = 0;
				focusTarget = 'input';
				return;
			}

			results = result.results;
			totalMatches = result.totalMatches;
			truncated = result.truncated;
			page = 0;
			status = result.overLimit ? 'over-limit' : 'complete';
			focusTarget = 'results';
		} catch {
			if (currentRequestId === id) {
				status = 'error';
				results = [];
				focusTarget = 'input';
			}
		}
	}

	function nextPage(): void {
		if (canGoNext) page += 1;
	}

	function prevPage(): void {
		if (canGoPrev) page -= 1;
	}

	// ── Navigation ─────────────────────────────────────────────────────────
	function openResult(result: GlobalSearchResult): GlobalSearchOpenOutcome {
		const isLoaded = loadedChats.some(
			(chat) => chat.archiveId === result.archiveId,
		);
		if (isLoaded) {
			sourceMissingArchiveId = null;
			return {
				kind: 'navigate',
				archiveId: result.archiveId,
				ordinal: result.ordinal,
				messageId: result.messageId,
			};
		}

		if (rememberedArchiveIds.has(result.archiveId)) {
			// Retain query + filters; request reselection.
			sourceMissingArchiveId = result.archiveId;
			return { kind: 'requires-source', archiveId: result.archiveId };
		}

		return { kind: 'unavailable', archiveId: result.archiveId };
	}

	function clearSourceMissing(): void {
		sourceMissingArchiveId = null;
	}

	// ── Removal ────────────────────────────────────────────────────────────
	async function removeFromLibrary(
		archiveId: string,
	): Promise<LibraryRemovalReadback> {
		try {
			// ONE unified §5 cascade: persisted metadata + file-handle reference +
			// every global-search key (shards/manifest/commit/consent), each half
			// verified by readback and fail-closed on any survivor.
			const report = await removeFromLibraryCascade(
				archiveId,
				persistedStore,
				storage,
				gate,
			);
			return report;
		} finally {
			// In-session cleanup (spec §5: coverage drops the archive entirely,
			// even when it was remembered or loaded). Runs even when the cascade
			// throws (idb rejection): the archive must not linger in-session, and
			// the rejection still propagates so the caller's fail-closed catch
			// (panel removalError / forgetChat toast) fires.
			loadedChats = loadedChats.filter((chat) => chat.archiveId !== archiveId);
			const remembered = new Set(rememberedArchiveIds);
			remembered.delete(archiveId);
			rememberedArchiveIds = remembered;
			const titles = new Map(rememberedTitles);
			titles.delete(archiveId);
			rememberedTitles = titles;

			const consent = new Map(consentByArchive);
			consent.delete(archiveId);
			consentByArchive = consent;

			const ready = new Map(readyManifests);
			ready.delete(archiveId);
			readyManifests = ready;

			const stale = new Set(staleArchiveIds);
			stale.delete(archiveId);
			staleArchiveIds = stale;

			const failed = new Set(failedArchiveIds);
			failed.delete(archiveId);
			failedArchiveIds = failed;

			const indexing = new Set(indexingArchiveIds);
			indexing.delete(archiveId);
			indexingArchiveIds = indexing;

			// Drop the prepared source: a re-added archive is a fresh load,
			// never a replay of pre-removal shards.
			preparedSourceCache.delete(archiveId);
			// The envelope fingerprint changes with the corpus, but drop the
			// cached envelope eagerly too — a stale byte envelope must never
			// survive a removal, even transiently.
			envelopeCache = null;

			client?.removeArchive(archiveId);
		}
	}

	async function deleteAllLocalIndices(): Promise<DeleteAllReadback> {
		deleteAllAcknowledged = false;
		const report = await deleteAllIndices(storage, gate);
		if (report.complete) {
			deleteAllAcknowledged = true;
			consentByArchive = new Map();
			readyManifests = new Map();
			staleArchiveIds = new Set();
			failedArchiveIds = new Set();
			indexingArchiveIds = new Set();
		}
		return report;
	}

	function reset() {
		currentRequestId = null;
		results = [];
		page = 0;
		totalMatches = 0;
		truncated = false;
		status = gate ? 'idle' : 'disabled';
		progress = null;
		sourceMissingArchiveId = null;
		deleteAllAcknowledged = false;
		focusTarget = null;
	}

	return {
		get gate() {
			return gate;
		},
		get enabled() {
			return gate;
		},
		get status() {
			return status;
		},
		get query() {
			return query;
		},
		get filters() {
			return filters;
		},
		get results() {
			return results;
		},
		get pagedResults() {
			return pagedResults;
		},
		get page() {
			return page;
		},
		get totalPages() {
			return totalPages;
		},
		get pageSize() {
			return GLOBAL_SEARCH_PAGE_SIZE;
		},
		get canGoPrev() {
			return canGoPrev;
		},
		get canGoNext() {
			return canGoNext;
		},
		get totalMatches() {
			return totalMatches;
		},
		get truncated() {
			return truncated;
		},
		get progress() {
			return progress;
		},
		get coverage() {
			return coverage;
		},
		get sourceMissingArchiveId() {
			return sourceMissingArchiveId;
		},
		get deleteAllAcknowledged() {
			return deleteAllAcknowledged;
		},
		get focusTarget() {
			return focusTarget;
		},
		get consentByArchive() {
			return consentByArchive;
		},
		get indexingArchiveIds() {
			return indexingArchiveIds;
		},

		initialize,
		setLoadedChats,
		setRememberedArchives,
		getConsent,
		isKeepingLocally,
		setConsentChoice,
		revokeConsent,
		setQuery,
		setFilters,
		submitQuery,
		cancel,
		nextPage,
		prevPage,
		openResult,
		clearSourceMissing,
		removeFromLibrary,
		deleteAllLocalIndices,
		dropPreparedSourcesCache,
		reset,
	};
}

export type GlobalSearchState = ReturnType<typeof createGlobalSearchState>;
export type { GlobalSearchCoverageEntry };

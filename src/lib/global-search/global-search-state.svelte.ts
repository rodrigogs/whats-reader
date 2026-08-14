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
import { buildSessionDocuments, searchableUtf8Bytes } from './documents';
import {
	commitGeneration,
	type GlobalSearchIndexOutcome,
	listReadyArchives,
	readReadyGeneration,
	startupCleanup,
} from './index-lifecycle';
import {
	GLOBAL_SEARCH_KEY_PREFIX,
	GLOBAL_SEARCH_V1_ENABLED,
	type GlobalSearchManifest,
} from './manifest';
import {
	createGlobalSearchQueryClient,
	createWorkerTransport,
	type GlobalSearchQueryClient,
	type GlobalSearchSource,
	type GlobalSearchTransport,
} from './query-orchestrator';
import {
	GLOBAL_SEARCH_PAGE_SIZE,
	type GlobalSearchFilters,
	type GlobalSearchQueryProgress,
	type GlobalSearchQueryRequest,
	type GlobalSearchResult,
} from './query-worker';
import {
	type DeleteAllReadback,
	deleteAllIndices,
	type RemovalReadback,
	removeArchiveIndex,
} from './removal';
import { splitDocuments } from './shard';
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
	function setLoadedChats(chats: ChatData[]): void {
		loadedChats = chats;
		void refreshConsent();
	}

	function setRememberedArchives(entries: RememberedArchiveEntry[]): void {
		rememberedArchiveIds = new Set(entries.map((entry) => entry.archiveId));
		rememberedTitles = new Map(
			entries.map((entry) => [entry.archiveId, entry.chatTitle]),
		);
		void refreshConsent();
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

	function sessionSource(chat: ChatData): GlobalSearchSource | null {
		const documents = buildSessionDocuments(chat);
		if (documents.length === 0) return null;
		const shards = splitDocuments(chat.archiveId, 0, documents);
		return {
			archiveId: chat.archiveId,
			chatTitle: chat.title,
			async *shards() {
				for (const shard of shards) yield shard.documents;
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
				for (const shard of ready.shards) yield shard;
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

		let corpusMessageCount = loadedChats.reduce(
			(sum, chat) => sum + chat.messages.length,
			0,
		);
		let corpusSearchableBytes = loadedChats.reduce((sum, chat) => {
			return sum + searchableUtf8Bytes(buildSessionDocuments(chat));
		}, 0);

		// Persisted archives that are not currently loaded.
		for (const [archiveId, manifest] of readyManifests) {
			if (loadedIds.has(archiveId)) continue;
			archiveTitles[archiveId] = manifest.chatTitle;
			const source = await persistedSource(archiveId, manifest.chatTitle);
			if (source) sources.push(source);
			corpusMessageCount += manifest.messageCount;
			corpusSearchableBytes += manifest.searchableUtf8Bytes;
		}

		const request: GlobalSearchQueryRequest = {
			requestId: id,
			query: rawQuery,
			filters,
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
	): Promise<RemovalReadback> {
		const report = await removeArchiveIndex(storage, archiveId, gate);
		await deleteConsent(consentStore, archiveId);
		const consent = new Map(consentByArchive);
		consent.delete(archiveId);
		consentByArchive = consent;

		const ready = new Map(readyManifests);
		ready.delete(archiveId);
		readyManifests = ready;

		client?.removeArchive(archiveId);
		return report;
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
		reset,
	};
}

export type GlobalSearchState = ReturnType<typeof createGlobalSearchState>;
export type { GlobalSearchCoverageEntry };

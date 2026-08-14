import type { GlobalSearchDocument } from './manifest';
import { SHARD_MAX_BYTES, SHARD_MAX_DOCUMENTS } from './shard';

export const GLOBAL_SEARCH_PAGE_SIZE = 50;
export const GLOBAL_SEARCH_MAX_NAVIGABLE_RESULTS = 1_000;
export const GLOBAL_SEARCH_CANCEL_CHECKPOINT = 2_000;

/** Envelope: at most 25 chats may be searched without an explicit scope. */
export const GLOBAL_SEARCH_MAX_CHATS = 25;
/** Envelope: 128 MiB of searchable text is the persistence ceiling. */
export const GLOBAL_SEARCH_MAX_SEARCHABLE_BYTES = 128 * 1024 * 1024;
/** Envelope: above 250k messages a query streams with progress events. */
export const GLOBAL_SEARCH_STREAMING_MESSAGE_THRESHOLD = 250_000;
/** Envelope: never accept or persist a corpus above 1M messages. */
export const GLOBAL_SEARCH_MAX_CORPUS_MESSAGES = 1_000_000;

export type GlobalSearchDateRange = {
	from?: number;
	to?: number;
};

export type GlobalSearchFilters = {
	archiveIds?: readonly string[];
	senders?: readonly string[];
	dateRanges?: readonly GlobalSearchDateRange[];
};

export type GlobalSearchQueryRequest = {
	requestId: string;
	query: string;
	filters: GlobalSearchFilters;
	/** Expected corpus size, used only to select the documented degraded mode. */
	corpusMessageCount?: number;
	/** Declared searchable UTF-8 bytes, from the ready manifest; 128 MiB cap. */
	corpusSearchableBytes?: number;
	/** Archive titles are display-only and cannot be used for identity. */
	archiveTitles?: Readonly<Record<string, string>>;
};

export type GlobalSearchResult = GlobalSearchDocument & {
	chatTitle: string;
};

export type GlobalSearchQueryResult = {
	requestId: string;
	queryEmpty: boolean;
	cancelled: boolean;
	/** True when the request violates an envelope limit and was never scanned. */
	overLimit: boolean;
	totalMatches: number;
	results: GlobalSearchResult[];
	pages: number;
	truncated: boolean;
};

export type GlobalSearchQueryProgress = {
	degraded: boolean;
	streaming: boolean;
	scannedDocuments: number;
};

export type GlobalSearchShardOutcome =
	| 'accepted'
	| 'cancelled'
	| 'ignored'
	| 'rejected';

type QueryRunnerOptions = {
	yieldControl?: () => Promise<void>;
	onProgress?: (progress: GlobalSearchQueryProgress) => void;
	/** Shared set owned by the caller; removals survive runner recreation. */
	removedArchiveIds?: Set<string>;
};

/**
 * Real macrotask yield so external MessageEvents (cancel/remove-archive) can
 * interleave during a long shard scan. MessageChannel is a macrotask in Node,
 * workers and browsers; setTimeout(0) is the universal fallback.
 */
export function yieldToEventLoop(): Promise<void> {
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

/** UTF-8 byte length of the shard's JSON serialization (the 1 MiB budget). */
export function serializedShardBytes(
	documents: readonly GlobalSearchDocument[],
): number {
	return new TextEncoder().encode(JSON.stringify(documents)).length;
}

function includesLiteral(value: string, query: string): boolean {
	return value.toLowerCase().includes(query);
}

function matchesFilters(
	document: GlobalSearchDocument,
	filters: GlobalSearchFilters,
): boolean {
	if (
		filters.archiveIds?.length &&
		!filters.archiveIds.includes(document.archiveId)
	) {
		return false;
	}

	if (
		filters.senders?.length &&
		!filters.senders.some(
			(sender) => document.sender.toLowerCase() === sender.toLowerCase(),
		)
	) {
		return false;
	}

	if (filters.dateRanges?.length) {
		const timestamp = document.timestamp;
		if (timestamp === null) return false;
		const matchesRange = filters.dateRanges.some(({ from, to }) => {
			return (
				(from === undefined || timestamp >= from) &&
				(to === undefined || timestamp <= to)
			);
		});
		if (!matchesRange) return false;
	}

	return true;
}

function compareResults(a: GlobalSearchResult, b: GlobalSearchResult): number {
	const aTimestamp = a.timestamp ?? Number.NEGATIVE_INFINITY;
	const bTimestamp = b.timestamp ?? Number.NEGATIVE_INFINITY;
	if (aTimestamp !== bTimestamp) return bTimestamp - aTimestamp;
	const title = a.chatTitle.localeCompare(b.chatTitle);
	if (title !== 0) return title;
	const archiveId = a.archiveId.localeCompare(b.archiveId);
	if (archiveId !== 0) return archiveId;
	return a.ordinal - b.ordinal;
}

/**
 * Per-request streaming query state. It retains only the best 1,000 results;
 * every supplied shard is scanned and released before the next one arrives.
 * Oversized shards (>2,000 docs or >1 MiB serialized) and concurrent shard
 * delivery are rejected fail-closed, never scanned.
 */
export function createGlobalSearchQueryRunner(
	request: GlobalSearchQueryRequest,
	options: QueryRunnerOptions = {},
) {
	const lowerQuery = request.query.toLowerCase();
	const results: GlobalSearchResult[] = [];
	const removedArchiveIds = options.removedArchiveIds ?? new Set<string>();
	const matchesByArchive = new Map<string, number>();
	const yieldControl = options.yieldControl ?? yieldToEventLoop;
	let cancelled = false;
	let completed = false;
	let totalMatches = 0;
	let scannedDocuments = 0;
	let residentDocumentCount = 0;
	let shardInFlight = false;
	const degraded =
		lowerQuery.length === 1 && (request.corpusMessageCount ?? 0) > 100_000;
	const streaming =
		(request.corpusMessageCount ?? 0) >
		GLOBAL_SEARCH_STREAMING_MESSAGE_THRESHOLD;
	const declaredArchiveCount = new Set<string>([
		...Object.keys(request.archiveTitles ?? {}),
		...(request.filters.archiveIds ?? []),
	]).size;
	const overLimit =
		(request.corpusMessageCount ?? 0) > GLOBAL_SEARCH_MAX_CORPUS_MESSAGES ||
		(request.corpusSearchableBytes ?? 0) > GLOBAL_SEARCH_MAX_SEARCHABLE_BYTES ||
		declaredArchiveCount > GLOBAL_SEARCH_MAX_CHATS;

	function cancel(): void {
		cancelled = true;
		results.length = 0;
	}

	function removeArchive(archiveId: string): void {
		removedArchiveIds.add(archiveId);
		totalMatches -= matchesByArchive.get(archiveId) ?? 0;
		matchesByArchive.delete(archiveId);
		for (let index = results.length - 1; index >= 0; index -= 1) {
			if (results[index].archiveId === archiveId) results.splice(index, 1);
		}
	}

	async function consumeShard(
		archiveId: string,
		documents: readonly GlobalSearchDocument[],
	): Promise<GlobalSearchShardOutcome> {
		if (completed || cancelled || removedArchiveIds.has(archiveId))
			return 'ignored';
		if (overLimit) return 'rejected';
		if (shardInFlight) return 'rejected';
		if (documents.length > SHARD_MAX_DOCUMENTS) return 'rejected';
		if (serializedShardBytes(documents) > SHARD_MAX_BYTES) return 'rejected';
		shardInFlight = true;
		residentDocumentCount = documents.length;
		try {
			if (lowerQuery.length === 0) return 'accepted';
			for (let index = 0; index < documents.length; index += 1) {
				if (cancelled || removedArchiveIds.has(archiveId)) return 'cancelled';
				if (index % GLOBAL_SEARCH_CANCEL_CHECKPOINT === 0) {
					await yieldControl();
					if (cancelled || removedArchiveIds.has(archiveId)) return 'cancelled';
				}

				const document = documents[index];
				scannedDocuments += 1;
				if (
					document.archiveId !== archiveId ||
					!matchesFilters(document, request.filters) ||
					(!includesLiteral(document.content, lowerQuery) &&
						!includesLiteral(document.sender, lowerQuery))
				) {
					continue;
				}

				totalMatches += 1;
				matchesByArchive.set(
					archiveId,
					(matchesByArchive.get(archiveId) ?? 0) + 1,
				);
				results.push({
					...document,
					chatTitle: request.archiveTitles?.[archiveId] ?? archiveId,
				});
				results.sort(compareResults);
				if (results.length > GLOBAL_SEARCH_MAX_NAVIGABLE_RESULTS) results.pop();
			}
			options.onProgress?.({ degraded, streaming, scannedDocuments });
			return 'accepted';
		} finally {
			shardInFlight = false;
			residentDocumentCount = 0;
		}
	}

	function complete(): GlobalSearchQueryResult {
		completed = true;
		if (cancelled) {
			return {
				requestId: request.requestId,
				queryEmpty: lowerQuery.length === 0,
				cancelled: true,
				overLimit: false,
				totalMatches: 0,
				results: [],
				pages: 0,
				truncated: false,
			};
		}
		return {
			requestId: request.requestId,
			queryEmpty: lowerQuery.length === 0,
			cancelled: false,
			overLimit,
			totalMatches: overLimit ? 0 : totalMatches,
			results: lowerQuery.length === 0 || overLimit ? [] : results,
			pages: overLimit
				? 0
				: Math.ceil(results.length / GLOBAL_SEARCH_PAGE_SIZE),
			truncated: overLimit ? false : totalMatches > results.length,
		};
	}

	return {
		cancel,
		complete,
		consumeShard,
		removeArchive,
		residentDocumentCount: () => residentDocumentCount,
	};
}

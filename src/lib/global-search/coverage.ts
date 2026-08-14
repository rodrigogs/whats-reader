/**
 * GH-67 §5 — Global-search coverage computation.
 *
 * Empty queries expose coverage, not messages. Coverage is a per-archive
 * status with exactly the states the spec names: `ready`, `indexing`,
 * `session-only`, `requires-file`, `stale`, `failed` and `disabled`. This
 * module reduces the reactive inputs into a deterministic list of entries keyed
 * by canonical `archiveId` — never by title, which is display-only and may
 * collide across archives.
 *
 * Pure: no storage, no network, no console.
 */

export type GlobalSearchCoverageStatus =
	| 'ready'
	| 'indexing'
	| 'session-only'
	| 'requires-file'
	| 'stale'
	| 'failed'
	| 'disabled';

export type GlobalSearchCoverageEntry = {
	archiveId: string;
	chatTitle: string;
	status: GlobalSearchCoverageStatus;
};

export type CoverageArchive = {
	archiveId: string;
	chatTitle: string;
};

export type CoverageInput = {
	/** Feature gate. When false, coverage is empty (the UI is not rendered). */
	gate: boolean;
	/** Loaded chats, in order. */
	loaded: CoverageArchive[];
	/** Archives with a committed `ready` manifest. */
	ready: CoverageArchive[];
	/** Archives whose manifest is `stale` or `failed`. */
	stale: CoverageArchive[];
	failed: CoverageArchive[];
	/** Remembered (persisted) archives that are not currently loaded. */
	remembered: CoverageArchive[];
	/** Archives with a valid keep-locally consent (ready to persist). */
	consentKeepLocally: ReadonlySet<string>;
	/** Archives currently building a generation. */
	indexing: ReadonlySet<string>;
};

function statusFor(
	archiveId: string,
	input: CoverageInput,
	inReady: boolean,
	inStale: boolean,
	inFailed: boolean,
	loaded: boolean,
	remembered: boolean,
): GlobalSearchCoverageStatus {
	if (input.indexing.has(archiveId)) return 'indexing';
	if (inFailed) return 'failed';
	if (inStale) return 'stale';
	if (inReady) return 'ready';
	if (loaded) return 'session-only';
	if (remembered) return 'requires-file';
	return 'disabled';
}

export function computeCoverage(
	input: CoverageInput,
): GlobalSearchCoverageEntry[] {
	if (!input.gate) return [];

	const byArchive = new Map<string, GlobalSearchCoverageEntry>();

	const add = (
		archive: CoverageArchive,
		kind: 'ready' | 'stale' | 'failed',
	) => {
		if (!byArchive.has(archive.archiveId)) {
			byArchive.set(archive.archiveId, {
				archiveId: archive.archiveId,
				chatTitle: archive.chatTitle,
				status: kind,
			});
		}
	};

	for (const archive of input.ready) add(archive, 'ready');
	for (const archive of input.stale) add(archive, 'stale');
	for (const archive of input.failed) add(archive, 'failed');

	const readyIds = new Set(input.ready.map((a) => a.archiveId));
	const staleIds = new Set(input.stale.map((a) => a.archiveId));
	const failedIds = new Set(input.failed.map((a) => a.archiveId));

	// Loaded chats (session sources) — highest presentation priority for
	// their own status, but never shadow a manifest state.
	for (const chat of input.loaded) {
		const existing = byArchive.get(chat.archiveId);
		const status = statusFor(
			chat.archiveId,
			input,
			readyIds.has(chat.archiveId),
			staleIds.has(chat.archiveId),
			failedIds.has(chat.archiveId),
			true,
			false,
		);
		if (existing) {
			existing.chatTitle = chat.chatTitle;
			existing.status = status;
		} else {
			byArchive.set(chat.archiveId, {
				archiveId: chat.archiveId,
				chatTitle: chat.chatTitle,
				status,
			});
		}
	}

	// Remembered-but-not-loaded archives → requires-file (or ready/stale/failed).
	for (const archive of input.remembered) {
		if (byArchive.has(archive.archiveId)) continue;
		byArchive.set(archive.archiveId, {
			archiveId: archive.archiveId,
			chatTitle: archive.chatTitle,
			status: 'requires-file',
		});
	}

	return [...byArchive.values()];
}

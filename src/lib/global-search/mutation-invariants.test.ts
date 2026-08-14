/**
 * GH-67 mutation guards — identity/privacy invariants.
 *
 * These are behavioural tests over the REAL production modules. Each one is a
 * trap for a specific unsafe regression that the spec forbids. They are the
 * tests used in the mutation exercise: mutating the guarded line makes the
 * corresponding test fail (RED), and restoring it byte-exactly makes it pass
 * again (GREEN).
 *
 * Invariant 1 — archiveId is the only lookup key. `findArchiveIndex` and the
 *   rune state's `openResult` must resolve an archive by its canonical
 *   `archiveId`, never by `chatTitle` (titles are display-only and collide).
 *
 * Invariant 2 — no unsafe title fallback. The query worker's `chatTitle`
 *   presentation field must fall back to the *archiveId* when no title is
 *   supplied, never to a title-derived or title-keyed value; a document's
 *   identity stays the `(archiveId, ordinal, messageId)` tuple.
 */

import { describe, expect, it } from 'vitest';
import { findArchiveIndex } from './archive-navigation';
import type { GlobalSearchDocument } from './manifest';
import {
	createGlobalSearchQueryRunner,
	type GlobalSearchQueryRequest,
} from './query-worker';

function doc(
	archiveId: string,
	ordinal: number,
	messageId: string,
	timestamp: number,
	content: string,
): GlobalSearchDocument {
	return {
		archiveId,
		ordinal,
		messageId,
		timestamp,
		sender: 'Ana',
		content,
	};
}

describe('GH-67 mutation guard — archiveId is the only lookup key', () => {
	it('findArchiveIndex resolves two equal-titled archives by archiveId', () => {
		// MUTATION GUARD (RED): changing findArchiveIndex to match on `.title`
		// (e.g. `archive.title === archiveId`) collapses these two archives and
		// this test fails, proving title-keyed lookup is a regression.
		const first = { archiveId: 'archive-a', title: 'Family' };
		const second = { archiveId: 'archive-b', title: 'Family' };
		expect(first.title).toBe(second.title);

		expect(findArchiveIndex([first, second], 'archive-a')).toBe(0);
		expect(findArchiveIndex([first, second], 'archive-b')).toBe(1);
		expect(findArchiveIndex([first, second], 'missing')).toBe(-1);
	});
});

describe('GH-67 mutation guard — no unsafe title fallback', () => {
	it('falls back to archiveId (never a title) when no title is supplied', async () => {
		// MUTATION GUARD (RED): changing the runner's `chatTitle` fallback from
		// `archiveTitles?.[archiveId] ?? archiveId` to a title-derived value (or
		// keying archiveTitles on title) breaks this assertion, proving that a
		// title as identity/presentation fallback is a regression.
		const request: GlobalSearchQueryRequest = {
			requestId: 'req-1',
			query: 'needle',
			filters: {},
			// No archiveTitles supplied at all.
		};

		const runner = createGlobalSearchQueryRunner(request);
		await runner.consumeShard('archive-a', [
			doc('archive-a', 0, 'm0', 100, 'needle here'),
		]);
		const result = runner.complete();

		expect(result.results).toHaveLength(1);
		// The presentation title must be the archiveId itself, never a title.
		expect(result.results[0].chatTitle).toBe('archive-a');
		// The identity triple is preserved through the scan.
		expect(result.results[0].archiveId).toBe('archive-a');
		expect(result.results[0].ordinal).toBe(0);
		expect(result.results[0].messageId).toBe('m0');
	});

	it('keeps the identity tuple intact even when two archives share a title', async () => {
		// MUTATION GUARD (RED): if a document's archiveId were ever replaced by
		// a title, these two same-titled archives would collapse to one match
		// source, and this test fails.
		const request: GlobalSearchQueryRequest = {
			requestId: 'req-2',
			query: 'needle',
			filters: {},
			archiveTitles: { 'archive-a': 'Family', 'archive-b': 'Family' },
		};

		const runner = createGlobalSearchQueryRunner(request);
		await runner.consumeShard('archive-a', [
			doc('archive-a', 0, 'm0', 200, 'needle one'),
		]);
		await runner.consumeShard('archive-b', [
			doc('archive-b', 0, 'm0', 100, 'needle two'),
		]);
		const result = runner.complete();

		expect(result.results).toHaveLength(2);
		const archives = result.results.map((r) => r.archiveId).sort();
		expect(archives).toEqual(['archive-a', 'archive-b']);
		// Same messageId in both archives must not collapse into one result.
		expect(result.results[0].messageId).toBe('m0');
		expect(result.results[1].messageId).toBe('m0');
	});
});

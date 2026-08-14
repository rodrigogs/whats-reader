/**
 * GH-67 §10 — Literal, case-insensitive range highlight.
 *
 * The global search MVP matches substrings literally and case-insensitively
 * (spec §3 D2), with no accent folding. This module computes the byte-visible
 * highlight ranges over the *original* text so rendering can wrap only the
 * matched span while preserving the source case, whitespace and Unicode.
 *
 * Ranges are `[start, end)` offsets in UTF-16 code units — the same unit
 * `String.prototype.slice` uses — so a caller can do `text.slice(start, end)`
 * and `text.slice(0, start)` / `text.slice(end)` directly.
 *
 * This module is pure: no DOM, no storage, no console, no network.
 */

export type LiteralRange = {
	start: number;
	end: number;
};

/**
 * Find every non-overlapping, left-to-right occurrence of `query` inside
 * `haystack`, case-insensitively. An empty query yields no ranges. Accents are
 * never folded: `café` does not match `cafe`.
 */
export function findLiteralRanges(
	haystack: string,
	query: string,
): LiteralRange[] {
	if (query.length === 0 || haystack.length === 0) return [];

	const lowerHaystack = haystack.toLowerCase();
	const lowerQuery = query.toLowerCase();
	const ranges: LiteralRange[] = [];

	let searchFrom = 0;
	while (searchFrom <= lowerHaystack.length - lowerQuery.length) {
		const found = lowerHaystack.indexOf(lowerQuery, searchFrom);
		if (found === -1) break;
		ranges.push({ start: found, end: found + lowerQuery.length });
		// Advance by the full match length so overlapping matches never
		// produce overlapping ranges (leftmost, non-overlapping scan).
		searchFrom = found + lowerQuery.length;
	}

	return ranges;
}

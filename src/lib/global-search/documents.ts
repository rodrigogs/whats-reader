/**
 * GH-67 §5 & §7 — Session documents and literal snippet building.
 *
 * `buildSessionDocuments` converts a loaded chat into the canonical
 * `GlobalSearchDocument[]` shape the query worker consumes. It copies ONLY the
 * searchable fields (ordinal, messageId, timestamp, sender, content) and never
 * `rawLine`, media, paths, bookmark comments, transcription text or error
 * payloads. Ordinal is the message's position in the parsed snapshot, so
 * navigation can resolve the canonical `(archiveId, ordinal, messageId)` tuple.
 *
 * `buildHighlightSnippet` extracts a bounded text window around the first
 * case-insensitive literal match and reports the highlight range(s) inside that
 * window for `<mark>`-style rendering that preserves source case and Unicode.
 */

import type { ChatMessage } from '../parser/chat-parser';
import type { ChatData } from '../state.svelte';
import { findLiteralRanges, type LiteralRange } from './highlight';
import type { GlobalSearchDocument } from './manifest';

const DEFAULT_SNIPPET_LENGTH = 160;

export function buildSessionDocuments(chat: ChatData): GlobalSearchDocument[] {
	return buildSessionDocumentsFromMessages(chat.archiveId, chat.messages, 0);
}

/**
 * Build documents for a slice of a chat's messages, preserving the absolute
 * ordinals of the full chat (`ordinalOffset` is the position of the first
 * message in the slice). Identical output to `buildSessionDocuments` for the
 * same messages; the async shard generator uses it so it can build one
 * bounded slice at a time without ever mapping a whole large chat in one
 * synchronous step.
 */
export function buildSessionDocumentsFromMessages(
	archiveId: string,
	messages: readonly ChatMessage[],
	ordinalOffset: number,
): GlobalSearchDocument[] {
	return messages.map((message, index) => ({
		archiveId,
		ordinal: ordinalOffset + index,
		messageId: message.id,
		timestamp: message.timestamp ? message.timestamp.getTime() : null,
		sender: message.sender,
		content: message.content,
	}));
}

/**
 * UTF-8 byte length of the searchable fields of raw chat messages (`sender`
 * NUL `content`), matching `searchableUtf8Bytes` over the same messages
 * converted to documents. Used to compute the query envelope without a second
 * full document-build pass on the submit path.
 */
export function searchableUtf8BytesOfMessages(
	messages: readonly ChatMessage[],
): number {
	let total = 0;
	const encoder = new TextEncoder();
	for (const message of messages) {
		total += encoder.encode(`${message.sender}\u0000${message.content}`).length;
	}
	return total;
}

/**
 * UTF-8 byte length of the searchable fields, matching the manifest's
 * `searchableUtf8Bytes` definition (`sender` NUL `content`). Used to feed the
 * query's 128 MiB envelope check.
 */
export function searchableUtf8Bytes(
	documents: readonly GlobalSearchDocument[],
): number {
	let total = 0;
	const encoder = new TextEncoder();
	for (const doc of documents) {
		total += encoder.encode(`${doc.sender}\u0000${doc.content}`).length;
	}
	return total;
}

export type HighlightSnippet = {
	/** The bounded text window (a substring of the original). */
	text: string;
	/** Highlight ranges relative to `text`. Empty when there is no match. */
	ranges: LiteralRange[];
	/** Whether the query literally occurs in the source text. */
	matched: boolean;
	/** True when characters before the window were truncated. */
	ellipsisStart: boolean;
	/** True when characters after the window were truncated. */
	ellipsisEnd: boolean;
};

export type HighlightSnippetOptions = {
	/** Maximum length of the returned text window. Default 160. */
	maxLength?: number;
};

/**
 * Build a snippet window centred on the first literal match.
 *
 * The window keeps at most `maxLength` code units and favours centring the
 * match. When the match is wider than the window, the match start anchors the
 * window. Ranges are recomputed inside the extracted window so the caller can
 * wrap them directly.
 */
export function buildHighlightSnippet(
	content: string,
	query: string,
	options: HighlightSnippetOptions = {},
): HighlightSnippet {
	const maxLength = Math.max(8, options.maxLength ?? DEFAULT_SNIPPET_LENGTH);
	const ranges = findLiteralRanges(content, query);

	if (ranges.length === 0 || query.length === 0) {
		const clipped = content.slice(0, maxLength);
		return {
			text: clipped,
			ranges: [],
			matched: ranges.length > 0,
			ellipsisStart: false,
			ellipsisEnd: clipped.length < content.length,
		};
	}

	const first = ranges[0];
	const matchLength = first.end - first.start;

	let start: number;
	let end: number;

	if (matchLength >= maxLength) {
		// The match is longer than the whole window: anchor on its start.
		start = first.start;
		end = start + maxLength;
	} else {
		// Centre the match, then clamp to the source bounds.
		const half = Math.floor((maxLength - matchLength) / 2);
		start = first.start - half;
		end = start + maxLength;
		if (start < 0) {
			end += -start;
			start = 0;
		}
		if (end > content.length) {
			start = Math.max(0, start - (end - content.length));
			end = content.length;
		}
	}

	const text = content.slice(start, end);
	const windowRanges = findLiteralRanges(text, query);

	return {
		text,
		ranges: windowRanges,
		matched: windowRanges.length > 0,
		ellipsisStart: start > 0,
		ellipsisEnd: end < content.length,
	};
}

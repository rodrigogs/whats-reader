import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../parser/chat-parser';
import type { ChatData } from '../state.svelte';
import { buildHighlightSnippet, buildSessionDocuments } from './documents';

function message(
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

describe('GH-67 session documents are built from canonical fields only', () => {
	it('maps ordinal to the message position and preserves archive identity', () => {
		const docs = buildSessionDocuments(
			chat('archive-a', 'Family', [
				message('m1', 'hello', 'Ana', 1_600_000_000_000),
				message('m2', 'world', 'Bruno', 1_600_000_001_000),
			]),
		);

		expect(docs).toEqual([
			{
				archiveId: 'archive-a',
				ordinal: 0,
				messageId: 'm1',
				timestamp: 1_600_000_000_000,
				sender: 'Ana',
				content: 'hello',
			},
			{
				archiveId: 'archive-a',
				ordinal: 1,
				messageId: 'm2',
				timestamp: 1_600_000_001_000,
				sender: 'Bruno',
				content: 'world',
			},
		]);
	});

	it('maps a null timestamp to null', () => {
		const withNull = {
			...message('m1', 'no time', 'Ana', 0),
			timestamp: null as unknown as Date,
		};
		const docs = buildSessionDocuments(chat('a', 'T', [withNull]));
		expect(docs[0].timestamp).toBeNull();
	});

	it('never copies rawLine, media, paths or transcription fields into a document', () => {
		const raw = message('m1', 'secret line', 'Ana', 1);
		const docs = buildSessionDocuments(chat('a', 'T', [raw]));
		const doc = docs[0] as Record<string, unknown>;

		expect(doc.rawLine).toBeUndefined();
		expect(doc.transcription).toBeUndefined();
		expect(doc.media).toBeUndefined();
		expect(doc.path).toBeUndefined();
		expect(Object.keys(doc).sort()).toEqual([
			'archiveId',
			'content',
			'messageId',
			'ordinal',
			'sender',
			'timestamp',
		]);
	});

	it('keeps equal-titled archives distinct by archiveId', () => {
		const first = buildSessionDocuments(
			chat('archive-a', 'Family', [message('m1', 'hi', 'Ana', 1)]),
		);
		const second = buildSessionDocuments(
			chat('archive-b', 'Family', [message('m1', 'hi', 'Ana', 1)]),
		);

		expect(first[0].archiveId).toBe('archive-a');
		expect(second[0].archiveId).toBe('archive-b');
		expect(first[0].messageId).toBe('m1');
		expect(second[0].messageId).toBe('m1');
	});
});

describe('GH-67 literal snippet with range highlight', () => {
	it('anchors the snippet on the first match and reports the highlight range', () => {
		const content = `${'a'.repeat(30)}NEEDLE${'b'.repeat(30)}`;
		const snippet = buildHighlightSnippet(content, 'needle', { maxLength: 20 });
		expect(snippet.matched).toBe(true);
		expect(snippet.text).toContain('NEEDLE');
		expect(
			snippet.text.slice(snippet.ranges[0].start, snippet.ranges[0].end),
		).toBe('NEEDLE');
		// The window is capped at maxLength.
		expect(snippet.text.length).toBeLessThanOrEqual(20);
	});

	it('flags truncation on both sides of a centered match', () => {
		const content = `${'x'.repeat(100)}TARGET${'y'.repeat(100)}`;
		const snippet = buildHighlightSnippet(content, 'target', { maxLength: 12 });
		expect(snippet.matched).toBe(true);
		expect(snippet.ellipsisStart).toBe(true);
		expect(snippet.ellipsisEnd).toBe(true);
	});

	it('reports no match for an absent query', () => {
		const snippet = buildHighlightSnippet('no match here', 'zzz', {
			maxLength: 20,
		});
		expect(snippet.matched).toBe(false);
		expect(snippet.ranges).toEqual([]);
	});

	it('reports no match for an empty query', () => {
		const snippet = buildHighlightSnippet('some content', '', {
			maxLength: 20,
		});
		expect(snippet.matched).toBe(false);
		expect(snippet.ranges).toEqual([]);
	});
});

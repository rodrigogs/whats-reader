import { describe, expect, it } from 'vitest';
import {
	buildGlobalSearchHarnessChats,
	GLOBAL_SEARCH_HARNESS_ENABLED,
	type GlobalSearchHarnessChatsSummary,
	isGlobalSearchHarnessEnabled,
} from './harness-entry';
import { GLOBAL_SEARCH_SYNTHETIC_SEED } from './synthetic-generator';

describe('GH-67 benchmark harness entry contract', () => {
	it('is disabled unless the harness build flag is set', () => {
		expect(isGlobalSearchHarnessEnabled({})).toBe(false);
		expect(
			isGlobalSearchHarnessEnabled({ VITE_GLOBAL_SEARCH_HARNESS: '0' }),
		).toBe(false);
		expect(
			isGlobalSearchHarnessEnabled({ VITE_GLOBAL_SEARCH_HARNESS: '1' }),
		).toBe(true);
		// The module constant follows the same rule (unset in tests → false).
		expect(GLOBAL_SEARCH_HARNESS_ENABLED).toBe(false);
	});

	it('builds the deterministic synthetic corpus as real app chats', () => {
		const chats = buildGlobalSearchHarnessChats(10_000);
		const summary = summarizeChats(chats);

		expect(summary.seed).toBe(GLOBAL_SEARCH_SYNTHETIC_SEED);
		expect(summary.archiveCount).toBe(8);
		expect(summary.messageCount).toBe(10_000);
		expect(summary.archives).toEqual([
			'gh67-v1-archive-00',
			'gh67-v1-archive-01',
			'gh67-v1-archive-02',
			'gh67-v1-archive-03',
			'gh67-v1-archive-04',
			'gh67-v1-archive-05',
			'gh67-v1-archive-06',
			'gh67-v1-archive-07',
		]);
	});

	it('produces identical corpora for the same size (deterministic seed)', () => {
		const first = buildGlobalSearchHarnessChats(10_000);
		const second = buildGlobalSearchHarnessChats(10_000);
		expect(summarizeChats(first)).toEqual(summarizeChats(second));
		expect(first[0].messages[0].content).toBe(second[0].messages[0].content);
	});

	it('maps synthetic messages to valid app ChatMessage shapes', () => {
		const chats = buildGlobalSearchHarnessChats(10_000);
		const chat = chats[0];
		const message = chat.messages[0];

		expect(chat.archiveId).toBe('gh67-v1-archive-00');
		expect(chat.title).toBe('Family Group');
		expect(chat.messageCount).toBe(chat.messages.length);
		expect(chat.mediaFiles).toEqual([]);
		expect(chat.hasMedia).toBe(false);
		expect(message.id).toMatch(/^gh67-v1-message-id-/);
		expect(message.timestamp).toBeInstanceOf(Date);
		expect(typeof message.sender).toBe('string');
		expect(typeof message.content).toBe('string');
		expect(message.isSystemMessage).toBe(false);
		expect(message.isMediaMessage).toBe(false);
		expect(message.rawLine).toBe('');
	});

	it('keeps the 256 KiB+ content document and null timestamps from the generator', () => {
		const chats = buildGlobalSearchHarnessChats(10_000);
		// The generator distributes messages across 8 archives by
		// `ordinal % 8`, so ordinal 5 (the oversized content) is the first
		// message of archive 05 and ordinal 0 (null timestamp) is the first
		// message of archive 00.
		const big = chats[5].messages[0];
		expect(big.content.length).toBeGreaterThan(256 * 1024);

		const first = chats[0].messages[0];
		expect(first.timestamp).toEqual(new Date(0));
	});

	it('produces zero intra-chat messageId duplicates (Svelte each_key guard)', () => {
		const chats = buildGlobalSearchHarnessChats(10_000);
		expect(chats.length).toBeGreaterThanOrEqual(2);
		for (const chat of chats) {
			const uniqueIds = new Set(chat.messages.map((message) => message.id));
			expect(
				uniqueIds.size,
				`chat ${chat.archiveId} has intra-chat messageId duplicates — ChatView each_key_duplicate crash`,
			).toBe(chat.messages.length);
		}
	});

	it('supports every documented synthetic size and rejects invalid ones', () => {
		const sizes = [10_000, 100_000, 250_000, 1_000_000] as const;
		for (const size of sizes) {
			expect(
				summarizeChats(buildGlobalSearchHarnessChats(size)).messageCount,
			).toBe(size);
		}
		expect(() =>
			buildGlobalSearchHarnessChats(42 as (typeof sizes)[number]),
		).toThrow(/size/i);
	});
});

function summarizeChats(
	chats: ReturnType<typeof buildGlobalSearchHarnessChats>,
): GlobalSearchHarnessChatsSummary & { seed: string; archives: string[] } {
	const messageCount = chats.reduce(
		(sum, chat) => sum + chat.messages.length,
		0,
	);
	const searchableBytes = chats.reduce(
		(sum, chat) =>
			sum +
			chat.messages.reduce(
				(chatSum, message) =>
					chatSum +
					new TextEncoder().encode(`${message.sender}\u0000${message.content}`)
						.length,
				0,
			),
		0,
	);
	return {
		seed: chats[0].archiveId.startsWith('gh67-v1-')
			? GLOBAL_SEARCH_SYNTHETIC_SEED
			: 'unknown',
		archiveCount: chats.length,
		messageCount,
		searchableBytes,
		archives: chats.map((chat) => chat.archiveId),
	};
}

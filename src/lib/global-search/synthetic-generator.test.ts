import { describe, expect, it } from 'vitest';
import {
	createGlobalSearchSyntheticDataset,
	GLOBAL_SEARCH_SYNTHETIC_SEED,
	GLOBAL_SEARCH_SYNTHETIC_SIZES,
	getGlobalSearchSyntheticMessage,
	iterateGlobalSearchSyntheticMessages,
} from './synthetic-generator';

describe('GH-67 synthetic global-search generator contract', () => {
	it('uses the required deterministic seed and advertised scenario sizes', () => {
		expect(GLOBAL_SEARCH_SYNTHETIC_SEED).toBe('gh67-v1');
		expect(GLOBAL_SEARCH_SYNTHETIC_SIZES).toEqual([
			10_000, 100_000, 250_000, 1_000_000,
		]);
	});

	it('generates deterministic message fixtures with required pathological cases', () => {
		const dataset = createGlobalSearchSyntheticDataset({ size: 10_000 });
		const firstPass = Array.from(
			iterateGlobalSearchSyntheticMessages(dataset),
		).slice(0, 96);
		const secondPass = Array.from(
			iterateGlobalSearchSyntheticMessages(dataset),
		).slice(0, 96);

		expect(secondPass).toEqual(firstPass);
		expect(firstPass.some((message) => /😀|🚀|✨/.test(message.content))).toBe(
			true,
		);
		expect(
			firstPass.some((message) => /ação|café|mañana/.test(message.content)),
		).toBe(true);
		expect(
			firstPass.some((message) => /東京|消息|漢字/.test(message.content)),
		).toBe(true);
		expect(
			firstPass.some((message) => /<script>|<b>|&lt;/.test(message.content)),
		).toBe(true);
		expect(firstPass.some((message) => message.timestamp === null)).toBe(true);
		expect(
			firstPass.some((message) => message.content.length > 256 * 1024),
		).toBe(true);
		expect(
			new Set(firstPass.map((message) => message.chatTitle)).size,
		).toBeLessThan(firstPass.length);
		// messageIds are globally unique per ordinal: the corpus must never
		// reproduce intra-chat id collisions (Svelte each_key_duplicate crash).
		// Cross-chat id collisions stay covered by archive-identity.test.ts
		// with fabricated data — the benchmark corpus does not need them.
		expect(new Set(firstPass.map((message) => message.messageId)).size).toBe(
			firstPass.length,
		);
	});

	it('supports 1M-size random access without requiring routine tests to materialize every message', () => {
		const million = createGlobalSearchSyntheticDataset({ size: 1_000_000 });
		const first = getGlobalSearchSyntheticMessage(million, 0);
		const last = getGlobalSearchSyntheticMessage(million, 999_999);

		expect(million.size).toBe(1_000_000);
		expect(first.ordinal).toBe(0);
		expect(last.ordinal).toBe(999_999);
		expect(last.archiveId).toMatch(/^gh67-v1-archive-/);
	});
});

import { describe, expect, it } from 'vitest';
import {
	commitKey,
	consentKey,
	GLOBAL_SEARCH_INDEX_VERSION,
	GLOBAL_SEARCH_KEY_PREFIX,
	GLOBAL_SEARCH_NORMALIZATION_VERSION,
	GLOBAL_SEARCH_SCHEMA_VERSION,
	GLOBAL_SEARCH_V1_ENABLED,
	isArchiveGlobalSearchKey,
	isGlobalSearchKey,
	manifestKey,
	parseShardKey,
	parseStagingKey,
	shardKey,
	stagingKey,
} from './manifest';

describe('GH-67 manifest key contracts', () => {
	it('uses the V1 schema/index/normalization versions and a disabled default gate', () => {
		expect(GLOBAL_SEARCH_SCHEMA_VERSION).toBe(1);
		expect(GLOBAL_SEARCH_INDEX_VERSION).toBe(1);
		expect(GLOBAL_SEARCH_NORMALIZATION_VERSION).toBe(1);
		// The gate ships disabled; flipping it is a release decision (§8).
		expect(GLOBAL_SEARCH_V1_ENABLED).toBe(false);
	});

	it('every key shares the exclusive whatsapp-global-search- prefix', () => {
		const keys = [
			manifestKey('a1'),
			stagingKey('a1', 1),
			shardKey('a1', 1, 0),
			commitKey('a1'),
			consentKey('a1'),
		];
		for (const key of keys) {
			expect(key.startsWith(GLOBAL_SEARCH_KEY_PREFIX)).toBe(true);
			expect(isGlobalSearchKey(key)).toBe(true);
		}
	});

	it('manifest/commit/consent keys embed the archiveId as the final segment', () => {
		expect(manifestKey('a1')).toBe('whatsapp-global-search-manifest-v1-a1');
		expect(commitKey('a1')).toBe('whatsapp-global-search-commit-v1-a1');
		expect(consentKey('a1')).toBe('whatsapp-global-search-consent-v1-a1');
	});

	it('parseShardKey round-trips for hyphenated archiveIds', () => {
		const id = '11111111-2222-3333-4444-555555555555';
		const key = shardKey(id, 7, 3);
		expect(parseShardKey(key)).toEqual({
			archiveId: id,
			generation: 7,
			shardNo: 3,
		});
	});

	it('parseStagingKey round-trips for hyphenated archiveIds', () => {
		const id = '11111111-2222-3333-4444-555555555555';
		const key = stagingKey(id, 7);
		expect(parseStagingKey(key)).toEqual({ archiveId: id, generation: 7 });
	});

	it('parseShardKey returns null for manifest/staging/consent/commit keys', () => {
		expect(parseShardKey(manifestKey('a1'))).toBeNull();
		expect(parseShardKey(stagingKey('a1', 1))).toBeNull();
		expect(parseShardKey(consentKey('a1'))).toBeNull();
		expect(parseShardKey(commitKey('a1'))).toBeNull();
	});

	it('parseStagingKey returns null for shard/manifest keys', () => {
		expect(parseStagingKey(shardKey('a1', 1, 0))).toBeNull();
		expect(parseStagingKey(manifestKey('a1'))).toBeNull();
	});

	it('isArchiveGlobalSearchKey narrows to keys containing the archiveId', () => {
		expect(isArchiveGlobalSearchKey(manifestKey('a1'), 'a1')).toBe(true);
		expect(isArchiveGlobalSearchKey(manifestKey('a2'), 'a1')).toBe(false);
		expect(isArchiveGlobalSearchKey('whatsapp-persisted-chat-a1', 'a1')).toBe(
			false,
		);
	});
});

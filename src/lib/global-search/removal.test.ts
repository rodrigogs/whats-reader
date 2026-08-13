import { beforeEach, describe, expect, it } from 'vitest';
import type { GlobalSearchDocument } from './manifest';
import {
	commitKey,
	consentKey,
	GLOBAL_SEARCH_KEY_PREFIX,
	manifestKey,
	shardKey,
} from './manifest';
import {
	containsOnlyGlobalSearchKeys,
	deleteAllIndices,
	enumerateArchiveKeys,
	removeArchiveIndex,
} from './removal';
import { createInMemoryGlobalSearchStorage } from './storage';

function doc(ordinal: number, archiveId = 'a1'): GlobalSearchDocument {
	return {
		archiveId,
		ordinal,
		messageId: `m${ordinal}`,
		timestamp: ordinal,
		sender: 'Ana',
		content: `message ${ordinal}`,
	};
}

/**
 * Seed an archive with one committed generation so removal has real keys to
 * delete. Mirrors what commitGeneration would leave behind.
 */
function seedArchive(
	storage: ReturnType<typeof createInMemoryGlobalSearchStorage>,
	archiveId: string,
) {
	const snap = storage.snapshot();
	snap.set(manifestKey(archiveId), {
		schemaVersion: 1,
		indexVersion: 1,
		normalizationVersion: 1,
		archiveId,
		generation: 1,
		state: 'ready',
		chatTitle: archiveId,
		sourceFingerprint: 'deadbeef',
		messageCount: 1,
		indexedDocumentCount: 1,
		searchableUtf8Bytes: 10,
		storedBytes: 100,
		includes: { content: true, sender: true, transcriptions: false },
		createdAt: 1,
		indexedAt: 2,
	});
	snap.set(commitKey(archiveId), {
		archiveId,
		readyGeneration: 1,
		shardCount: 1,
		checksum: 'deadbeef',
	});
	snap.set(shardKey(archiveId, 1, 0), [doc(0, archiveId)]);
	snap.set(consentKey(archiveId), {
		archiveId,
		copyVersion: 1,
		choice: 'keep-locally',
	});
}

describe('GH-67 removal — removeArchiveIndex with readback', () => {
	beforeEach(() => {});

	it('deletes every key for one archive and reports zero remaining', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		seedArchive(storage, 'a1');
		seedArchive(storage, 'a2');

		const report = await removeArchiveIndex(storage, 'a1', true);
		expect(report.complete).toBe(true);
		expect(report.remaining).toBe(0);
		expect(report.deletedKeys.length).toBeGreaterThan(0);

		// a1 gone, a2 untouched.
		expect(await enumerateArchiveKeys(storage, 'a1')).toEqual([]);
		const a2Keys = await enumerateArchiveKeys(storage, 'a2');
		expect(a2Keys.length).toBeGreaterThan(0);
	});

	it('does not over-match when one archiveId is a substring of another', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		seedArchive(storage, 'a1');
		seedArchive(storage, 'a1-extra');

		await removeArchiveIndex(storage, 'a1', true);
		// 'a1' keys gone, 'a1-extra' keys survive.
		expect(await enumerateArchiveKeys(storage, 'a1')).toEqual([]);
		expect(
			(await enumerateArchiveKeys(storage, 'a1-extra')).length,
		).toBeGreaterThan(0);
	});

	it('does not over-match for hyphenated (UUID-like) archiveIds', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		const idA = '11111111-2222-3333-4444-555555555555';
		const idB = '11111111-2222-3333-4444-666666666666';
		seedArchive(storage, idA);
		seedArchive(storage, idB);

		await removeArchiveIndex(storage, idA, true);
		expect(await enumerateArchiveKeys(storage, idA)).toEqual([]);
		expect((await enumerateArchiveKeys(storage, idB)).length).toBeGreaterThan(
			0,
		);
	});

	it('is a no-op when the gate is disabled', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		seedArchive(storage, 'a1');
		const report = await removeArchiveIndex(storage, 'a1', false);
		expect(report.deletedKeys).toEqual([]);
		expect((await enumerateArchiveKeys(storage, 'a1')).length).toBeGreaterThan(
			0,
		);
	});
});

describe('GH-67 removal — deleteAllIndices with readback', () => {
	it('deletes every global-search key and requires zero remaining', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		seedArchive(storage, 'a1');
		seedArchive(storage, 'a2');

		const report = await deleteAllIndices(storage, true);
		expect(report.complete).toBe(true);
		expect(report.remaining).toBe(0);
		expect(storage.snapshot().size).toBe(0);
	});

	it('never touches persisted-chat, file-handle, bookmark, transcription or settings keys', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		seedArchive(storage, 'a1');
		// Seed foreign-namespace keys that must survive.
		storage.snapshot().set('whatsapp-persisted-chat-a1', { id: 'a1' });
		storage.snapshot().set('whatsapp-file-handle-a1', { handle: true });
		storage.snapshot().set('whatsapp-bookmark-a1-0', { bookmark: true });
		storage.snapshot().set('whatsapp-transcription-a1', { text: 'secret' });
		storage.snapshot().set('whatsapp-settings', { lang: 'en' });
		storage.snapshot().set('whatsapp-dont-show-restore-modal', true);

		const report = await deleteAllIndices(storage, true);
		expect(report.complete).toBe(true);

		const snap = storage.snapshot();
		expect(snap.has('whatsapp-persisted-chat-a1')).toBe(true);
		expect(snap.has('whatsapp-file-handle-a1')).toBe(true);
		expect(snap.has('whatsapp-bookmark-a1-0')).toBe(true);
		expect(snap.has('whatsapp-transcription-a1')).toBe(true);
		expect(snap.has('whatsapp-settings')).toBe(true);
		expect(snap.has('whatsapp-dont-show-restore-modal')).toBe(true);
		// No global-search key survives.
		for (const key of snap.keys()) {
			expect(key.startsWith(GLOBAL_SEARCH_KEY_PREFIX)).toBe(false);
		}
	});

	it('containsOnlyGlobalSearchKeys is true for only prefixed keys', () => {
		expect(
			containsOnlyGlobalSearchKeys([manifestKey('a1'), shardKey('a1', 1, 0)]),
		).toBe(true);
		expect(
			containsOnlyGlobalSearchKeys([
				manifestKey('a1'),
				'whatsapp-persisted-chat-a1',
			]),
		).toBe(false);
	});

	it('is a no-op when the gate is disabled', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		seedArchive(storage, 'a1');
		const report = await deleteAllIndices(storage, false);
		expect(report.deletedKeys).toEqual([]);
		expect((await storage.keys()).length).toBeGreaterThan(0);
	});
});

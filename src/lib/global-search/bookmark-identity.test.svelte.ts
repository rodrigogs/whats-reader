import { beforeEach, describe, expect, it } from 'vitest';
import { bookmarksState } from '$lib/bookmarks.svelte';
import { findArchiveIndex } from './archive-navigation';

const sharedMessage = {
	messageId: 'shared-message',
	chatTitle: 'Family Group',
	messageContent: 'same visible message',
	sender: 'Ana',
	messageTimestamp: new Date('2026-01-02T03:04:05.000Z'),
};

function legacyBookmark(chatId = 'Family Group') {
	return {
		id: 'legacy-bookmark',
		messageId: sharedMessage.messageId,
		chatId,
		comment: 'legacy note',
		createdAt: '2026-01-02T03:04:05.000Z',
		messagePreview: sharedMessage.messageContent,
		sender: sharedMessage.sender,
		messageTimestamp: '2026-01-02T03:04:05.000Z',
	};
}

beforeEach(() => {
	bookmarksState.clearAll();
});

describe('bookmark identity uses archiveId + messageId', () => {
	it('navigates to the exact archive when visible titles collide', () => {
		const archives = [
			{ archiveId: 'archive-a', title: 'Family Group' },
			{ archiveId: 'archive-b', title: 'Family Group' },
		];

		expect(findArchiveIndex(archives, 'archive-b')).toBe(1);
		expect(findArchiveIndex(archives, 'missing-archive')).toBe(-1);
	});

	it('keeps equal-titled archives with the same messageId independent', () => {
		bookmarksState.addBookmark({ archiveId: 'archive-a', ...sharedMessage });
		bookmarksState.addBookmark({ archiveId: 'archive-b', ...sharedMessage });

		expect(bookmarksState.count).toBe(2);
		expect(
			bookmarksState.isBookmarked('archive-a', sharedMessage.messageId),
		).toBe(true);
		expect(
			bookmarksState.isBookmarked('archive-b', sharedMessage.messageId),
		).toBe(true);

		bookmarksState.updateBookmarkComment(
			'archive-a',
			sharedMessage.messageId,
			'only archive A',
		);
		expect(
			bookmarksState.getBookmark('archive-a', sharedMessage.messageId)?.comment,
		).toBe('only archive A');
		expect(
			bookmarksState.getBookmark('archive-b', sharedMessage.messageId)?.comment,
		).toBe('');

		expect(
			bookmarksState.removeBookmark('archive-a', sharedMessage.messageId),
		).toBe(true);
		expect(
			bookmarksState.isBookmarked('archive-a', sharedMessage.messageId),
		).toBe(false);
		expect(
			bookmarksState.isBookmarked('archive-b', sharedMessage.messageId),
		).toBe(true);
	});

	it('toggles only the requested archive when message IDs collide', () => {
		bookmarksState.toggleBookmark({ archiveId: 'archive-a', ...sharedMessage });
		bookmarksState.toggleBookmark({ archiveId: 'archive-b', ...sharedMessage });

		expect(bookmarksState.count).toBe(2);
		expect(
			bookmarksState.toggleBookmark({
				archiveId: 'archive-a',
				...sharedMessage,
			}),
		).toEqual({ added: false });
		expect(
			bookmarksState.isBookmarked('archive-a', sharedMessage.messageId),
		).toBe(false);
		expect(
			bookmarksState.isBookmarked('archive-b', sharedMessage.messageId),
		).toBe(true);
	});

	it('imports two v2 bookmarks with the same title and messageId when archiveIds differ', () => {
		const result = bookmarksState.importBookmarks({
			version: 2,
			exportedAt: '2026-01-02T03:04:05.000Z',
			bookmarks: [
				{
					...legacyBookmark(),
					archiveId: 'archive-a',
					chatTitle: sharedMessage.chatTitle,
				},
				{
					...legacyBookmark(),
					id: 'bookmark-b',
					archiveId: 'archive-b',
					chatTitle: sharedMessage.chatTitle,
				},
			],
		});

		expect(result).toEqual({ imported: 2, skipped: 0 });
		expect(bookmarksState.getBookmarksForArchive('archive-a')).toHaveLength(1);
		expect(bookmarksState.getBookmarksForArchive('archive-b')).toHaveLength(1);
		expect(bookmarksState.exportBookmarks()).toMatchObject({
			version: 2,
			bookmarks: [
				{ archiveId: 'archive-a', messageId: sharedMessage.messageId },
				{ archiveId: 'archive-b', messageId: sharedMessage.messageId },
			],
		});
	});
});

describe('legacy bookmark import fails closed without a validated archive', () => {
	it('rejects unknown export versions instead of treating them as legacy', () => {
		expect(() =>
			bookmarksState.importBookmarks({
				version: 3,
				exportedAt: '2026-01-02T03:04:05.000Z',
				bookmarks: [legacyBookmark()],
			} as never),
		).toThrow('Invalid bookmark export format');
	});

	it('skips manual v1 entries instead of treating a title as archive identity', async () => {
		const data = {
			version: 1 as const,
			exportedAt: '2026-01-02T03:04:05.000Z',
			bookmarks: [legacyBookmark()],
		};
		const file = {
			text: async () => JSON.stringify(data),
		} as File;

		const result = await bookmarksState.importFromFile(file);

		expect(result).toEqual({ imported: 0, skipped: 1 });
		expect(bookmarksState.count).toBe(0);
	});

	it('backfills v1 entries only when restore supplies the validated archiveId', () => {
		const result = bookmarksState.importBookmarks(
			{
				version: 1,
				exportedAt: '2026-01-02T03:04:05.000Z',
				bookmarks: [legacyBookmark()],
			},
			'validated-archive',
		);

		expect(result).toEqual({ imported: 1, skipped: 0 });
		expect(
			bookmarksState.getBookmark('validated-archive', sharedMessage.messageId),
		).toMatchObject({
			archiveId: 'validated-archive',
			chatTitle: sharedMessage.chatTitle,
		});
	});

	it('restores matching v2 entries but skips entries owned by another archive', () => {
		const result = bookmarksState.importValidatedPersistedBookmarks(
			[
				{
					...legacyBookmark(),
					archiveId: 'validated-archive',
					chatTitle: sharedMessage.chatTitle,
				},
				{
					...legacyBookmark(),
					id: 'foreign-bookmark',
					archiveId: 'other-archive',
					chatTitle: sharedMessage.chatTitle,
				},
			],
			'validated-archive',
			'2026-01-02T03:04:05.000Z',
		);

		expect(result).toEqual({ imported: 1, skipped: 1 });
		expect(
			bookmarksState.getBookmarksForArchive('validated-archive'),
		).toHaveLength(1);
		expect(bookmarksState.getBookmarksForArchive('other-archive')).toHaveLength(
			0,
		);
	});

	it('skips malformed and duplicate v2 identities', () => {
		const valid = {
			...legacyBookmark(),
			archiveId: 'archive-a',
			chatTitle: sharedMessage.chatTitle,
		};
		const result = bookmarksState.importBookmarks({
			version: 2,
			exportedAt: '2026-01-02T03:04:05.000Z',
			bookmarks: [
				valid,
				{ ...valid, id: 'duplicate' },
				{ ...valid, id: 'missing-archive', archiveId: '' },
				{ ...valid, id: 'missing-message', messageId: '' },
			],
		});

		expect(result).toEqual({ imported: 1, skipped: 3 });
		expect(bookmarksState.count).toBe(1);
	});
});

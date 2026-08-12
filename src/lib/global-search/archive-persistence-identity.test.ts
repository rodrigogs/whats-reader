import { beforeEach, describe, expect, it, vi } from 'vitest';

const storedValues = new Map<string, unknown>();
let failNextMetadataWrite = false;

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('idb-keyval', () => ({
	del: vi.fn(async (key: string) => {
		storedValues.delete(key);
	}),
	get: vi.fn(async (key: string) => storedValues.get(key)),
	keys: vi.fn(async () => [...storedValues.keys()]),
	set: vi.fn(async (key: string, value: unknown) => {
		if (failNextMetadataWrite && key.startsWith('whatsapp-persisted-chat-')) {
			failNextMetadataWrite = false;
			throw new Error('IndexedDB write failed');
		}
		storedValues.set(key, value);
	}),
}));

const {
	acceptValidatedRestore,
	getPersistedChats,
	removePersistedChat,
	savePersistedChat,
	shouldLoadRestoredChat,
	updatePersistedChat,
} = await import('$lib/persistence.svelte');

function createChat(archiveId: string, title = 'Family Group') {
	return {
		archiveId,
		title,
		messages: [],
		participants: [],
		startDate: null,
		endDate: null,
		messageCount: 0,
		mediaCount: 0,
		mediaFiles: [],
		hasMedia: false,
		contacts: new Map(),
	};
}

const settings = {
	language: 'portuguese',
	autoLoadMedia: false,
	perspective: null,
};

describe('archive-scoped persistence identity', () => {
	beforeEach(() => {
		storedValues.clear();
		failNextMetadataWrite = false;
		vi.stubGlobal('window', {});
		vi.stubGlobal('navigator', {});
	});

	it('preserves a restored file handle when saving without a newly selected file', async () => {
		const chat = createChat('archive-with-handle');
		const handle = { kind: 'file' } as unknown as FileSystemFileHandle;

		await savePersistedChat(chat, null, [], {}, settings, undefined, handle);
		await savePersistedChat(chat, null, [], {}, settings);

		expect(
			storedValues.get('whatsapp-persisted-chat-archive-with-handle'),
		).toMatchObject({
			fileReference: { type: 'file-handle', handleId: 'archive-with-handle' },
		});
		expect(storedValues.get('whatsapp-file-handle-archive-with-handle')).toBe(
			handle,
		);
	});

	it('does not destroy the existing metadata when a replacement write fails', async () => {
		const chat = createChat('archive-write-failure');
		await savePersistedChat(chat, null, [], {}, settings);
		const previous = storedValues.get(
			'whatsapp-persisted-chat-archive-write-failure',
		);

		failNextMetadataWrite = true;
		await expect(
			savePersistedChat(
				chat,
				null,
				[],
				{},
				{ ...settings, language: 'english' },
			),
		).rejects.toThrow('IndexedDB write failed');

		expect(
			storedValues.get('whatsapp-persisted-chat-archive-write-failure'),
		).toBe(previous);
	});

	it('rejects a mismatched restored archive before it can claim the saved identity', async () => {
		const saved = {
			id: 'saved-archive',
			fileName: 'saved.zip',
			chatTitle: 'Family Group',
			messageCount: 1,
			firstMessageTimestamp: '2024-01-01T00:00:00.000Z',
			lastMessageTimestamp: '2024-01-01T00:00:00.000Z',
			firstMessageIds: ['saved-message'],
			savedAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2024-01-01T00:00:00.000Z',
			fileReference: { type: 'reselect-required' as const },
			bookmarks: [],
			transcriptions: {},
			settings,
		};

		expect(shouldLoadRestoredChat(createChat(saved.id), saved)).toBe(false);
	});

	it('does not run restore side effects for mismatched restored archives', () => {
		const saved = {
			id: 'saved-archive',
			fileName: 'saved.zip',
			chatTitle: 'Family Group',
			messageCount: 1,
			firstMessageTimestamp: '2024-01-01T00:00:00.000Z',
			lastMessageTimestamp: '2024-01-01T00:00:00.000Z',
			firstMessageIds: ['saved-message'],
			savedAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2024-01-01T00:00:00.000Z',
			fileReference: { type: 'reselect-required' as const },
			bookmarks: [
				{
					id: 'bookmark-1',
					messageId: 'saved-message',
					chatId: 'Family Group',
					comment: 'important',
					createdAt: '2024-01-01T00:00:00.000Z',
					messagePreview: 'saved',
					sender: 'Ana',
					messageTimestamp: '2024-01-01T00:00:00.000Z',
				},
			],
			transcriptions: { audio: 'transcribed' },
			settings,
		};
		const callbacks = {
			applyBookmarks: vi.fn(),
			applyTranscriptions: vi.fn(),
			applySettings: vi.fn(),
			addChat: vi.fn(),
			startIndex: vi.fn(),
		};

		const accepted = acceptValidatedRestore(
			createChat(saved.id),
			saved,
			callbacks,
		);

		expect(accepted).toBe(false);
		expect(callbacks.applyBookmarks).not.toHaveBeenCalled();
		expect(callbacks.applyTranscriptions).not.toHaveBeenCalled();
		expect(callbacks.applySettings).not.toHaveBeenCalled();
		expect(callbacks.addChat).not.toHaveBeenCalled();
		expect(callbacks.startIndex).not.toHaveBeenCalled();
	});

	it('applies restore side effects exactly once for validated restored archives', () => {
		const saved = {
			id: 'saved-archive',
			fileName: 'saved.zip',
			chatTitle: 'Family Group',
			messageCount: 0,
			firstMessageTimestamp: '2024-01-01T00:00:00.000Z',
			lastMessageTimestamp: '2024-01-01T00:00:00.000Z',
			firstMessageIds: [],
			savedAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2024-01-01T00:00:00.000Z',
			fileReference: { type: 'reselect-required' as const },
			bookmarks: [
				{
					id: 'bookmark-1',
					messageId: 'saved-message',
					chatId: 'Family Group',
					comment: 'important',
					createdAt: '2024-01-01T00:00:00.000Z',
					messagePreview: 'saved',
					sender: 'Ana',
					messageTimestamp: '2024-01-01T00:00:00.000Z',
				},
			],
			transcriptions: { audio: 'transcribed' },
			settings: { ...settings, autoLoadMedia: true, perspective: 'Ana' },
		};
		const chat = createChat(saved.id);
		const callbacks = {
			applyBookmarks: vi.fn(),
			applyTranscriptions: vi.fn(),
			applySettings: vi.fn(),
			addChat: vi.fn(),
			startIndex: vi.fn(),
		};

		const accepted = acceptValidatedRestore(chat, saved, callbacks);

		expect(accepted).toBe(true);
		expect(callbacks.applyBookmarks).toHaveBeenCalledOnce();
		expect(callbacks.applyBookmarks).toHaveBeenCalledWith(
			saved.bookmarks,
			saved.savedAt,
		);
		expect(callbacks.applyTranscriptions).toHaveBeenCalledOnce();
		expect(callbacks.applyTranscriptions).toHaveBeenCalledWith(
			saved.transcriptions,
		);
		expect(callbacks.applySettings).toHaveBeenCalledOnce();
		expect(callbacks.applySettings).toHaveBeenCalledWith(saved.settings);
		expect(callbacks.addChat).toHaveBeenCalledOnce();
		expect(callbacks.addChat).toHaveBeenCalledWith(chat);
		expect(callbacks.startIndex).toHaveBeenCalledOnce();
		expect(callbacks.startIndex).toHaveBeenCalledWith(chat);
	});

	it('keeps equal-titled archives separate and addresses each record by archive ID', async () => {
		const first = createChat('archive-first');
		const second = createChat('archive-second');

		await savePersistedChat(first, null, [], {}, settings);
		await savePersistedChat(second, null, [], {}, settings);
		await savePersistedChat(first, null, [], {}, settings);

		const persisted = await getPersistedChats();
		expect(persisted.map((chat) => chat.id).sort()).toEqual([
			'archive-first',
			'archive-second',
		]);
		expect(persisted).toHaveLength(2);

		await updatePersistedChat(first.archiveId, { chatTitle: 'Renamed First' });
		await removePersistedChat(second.archiveId);

		expect(await getPersistedChats()).toMatchObject([
			{ id: first.archiveId, chatTitle: 'Renamed First' },
		]);
	});
});

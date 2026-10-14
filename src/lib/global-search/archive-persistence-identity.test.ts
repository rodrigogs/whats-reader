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

const { parseChat } = await import('$lib/parser/chat-parser');
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

function releasedMessageId(
	timestamp: Date,
	sender: string,
	content: string,
	chatIdentifier = 'US Chat',
): string {
	const base = `${chatIdentifier}|${timestamp.toISOString()}|${sender}|${content}`;
	let hash = 5381;
	for (let index = 0; index < base.length; index++) {
		hash = ((hash << 5) + hash) ^ base.charCodeAt(index);
	}
	return Math.abs(hash).toString(36);
}

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

	it('accepts a parser-migration alias and remaps persisted message references', () => {
		const parsed = parseChat(
			'01/12/2020, 14:30 - Alex: first\n01/13/2020, 09:00 - Sara: second',
			'US Chat',
			{ includeValidationAliases: true },
		);
		const alias = parsed.validationAliases?.[0];
		expect(alias).toBeDefined();
		if (!alias) throw new Error('Expected a parser migration alias');
		const legacyMessageId = alias.firstMessageIds[0];
		const currentMessage = parsed.messages[0];

		const saved = {
			id: 'saved-us-archive',
			fileName: 'saved.zip',
			chatTitle: 'US Chat',
			messageCount: alias.messageCount,
			firstMessageTimestamp: alias.firstMessageTimestamp,
			lastMessageTimestamp: alias.lastMessageTimestamp,
			firstMessageIds: alias.firstMessageIds,
			savedAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2024-01-01T00:00:00.000Z',
			fileReference: { type: 'reselect-required' as const },
			bookmarks: [
				{
					id: 'bookmark-1',
					messageId: legacyMessageId,
					chatId: 'US Chat',
					comment: 'important',
					createdAt: '2024-01-01T00:00:00.000Z',
					messagePreview: 'old combined message',
					sender: 'Alex',
					messageTimestamp: alias.firstMessageTimestamp,
				},
			],
			transcriptions: { [legacyMessageId]: 'transcribed' },
			settings,
		};
		const chat = {
			...createChat(saved.id, saved.chatTitle),
			...parsed,
		};
		const callbacks = {
			applyBookmarks: vi.fn(),
			applyTranscriptions: vi.fn(),
			applySettings: vi.fn(),
			addChat: vi.fn(),
			startIndex: vi.fn(),
		};

		expect(acceptValidatedRestore(chat, saved, callbacks)).toBe(true);
		expect(chat.validationAliases).toBeUndefined();
		expect(callbacks.applyBookmarks).toHaveBeenCalledWith(
			[
				expect.objectContaining({
					messageId: currentMessage.id,
					messagePreview: currentMessage.content,
					messageTimestamp: currentMessage.timestamp.toISOString(),
				}),
			],
			saved.savedAt,
		);
		expect(callbacks.applyTranscriptions).toHaveBeenCalledWith({
			[currentMessage.id]: 'transcribed',
		});
	});

	it('rejects an exact migration snapshot with an unresolved persisted message ID', () => {
		const parsed = parseChat(
			'01/12/2020, 14:30 - Alex: first\n01/13/2020, 09:00 - Sara: second',
			'US Chat',
			{ includeValidationAliases: true },
		);
		const alias = parsed.validationAliases?.[0];
		expect(alias).toBeDefined();
		if (!alias) throw new Error('Expected a parser migration alias');
		const saved = {
			id: 'saved-us-unresolved',
			fileName: 'saved.zip',
			chatTitle: 'US Chat',
			messageCount: alias.messageCount,
			firstMessageTimestamp: alias.firstMessageTimestamp,
			lastMessageTimestamp: alias.lastMessageTimestamp,
			firstMessageIds: alias.firstMessageIds,
			savedAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2024-01-01T00:00:00.000Z',
			fileReference: { type: 'reselect-required' as const },
			bookmarks: [],
			transcriptions: { 'missing-message-id': 'must not be lost' },
			settings,
		};
		const callbacks = {
			applyBookmarks: vi.fn(),
			applyTranscriptions: vi.fn(),
			applySettings: vi.fn(),
			addChat: vi.fn(),
			startIndex: vi.fn(),
		};

		expect(
			acceptValidatedRestore(
				{ ...createChat(saved.id, saved.chatTitle), ...parsed },
				saved,
				callbacks,
			),
		).toBe(false);
		for (const callback of Object.values(callbacks)) {
			expect(callback).not.toHaveBeenCalled();
		}
	});

	it('rejects changed leading messages that the released parser could not authenticate', () => {
		const legacyTimestamp = new Date(2020, 11, 1, 14, 30);
		const legacyMessageId = releasedMessageId(
			legacyTimestamp,
			'Alex',
			'shared tail',
		);
		const parsed = parseChat(
			'01/13/2020, 09:00 - Sara: DIFFERENT leading message\n01/12/2020, 14:30 - Alex: shared tail',
			'US Chat',
			{ includeValidationAliases: true },
		);
		const saved = {
			id: 'saved-us-leading-message',
			fileName: 'saved.zip',
			chatTitle: 'US Chat',
			messageCount: 1,
			firstMessageTimestamp: legacyTimestamp.toISOString(),
			lastMessageTimestamp: legacyTimestamp.toISOString(),
			firstMessageIds: [legacyMessageId],
			savedAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2024-01-01T00:00:00.000Z',
			fileReference: { type: 'reselect-required' as const },
			bookmarks: [],
			transcriptions: {},
			settings,
		};
		const callbacks = {
			applyBookmarks: vi.fn(),
			applyTranscriptions: vi.fn(),
			applySettings: vi.fn(),
			addChat: vi.fn(),
			startIndex: vi.fn(),
		};

		expect(
			acceptValidatedRestore(
				{ ...createChat(saved.id, saved.chatTitle), ...parsed },
				saved,
				callbacks,
			),
		).toBe(false);
		for (const callback of Object.values(callbacks)) {
			expect(callback).not.toHaveBeenCalled();
		}
	});

	it('rejects a sampled legacy snapshot that cannot authenticate every legacy message', () => {
		const source = [
			'01/12/2020, 10:00 - A: message 1',
			'01/12/2020, 10:01 - A: message 2',
			'01/12/2020, 10:02 - A: message 3',
			'01/12/2020, 10:03 - A: message 4',
			'01/12/2020, 10:04 - A: message 5',
			'01/12/2020, 10:05 - A: message 6',
			'01/12/2020, 10:06 - A: altered message 7',
			'01/13/2020, 10:07 - B: month-first evidence',
		].join('\n');
		const parsed = parseChat(source, 'US Chat', {
			includeValidationAliases: true,
		});
		const legacyTimestamps = Array.from(
			{ length: 7 },
			(_, index) => new Date(2020, 11, 1, 10, index),
		);
		const saved = {
			id: 'saved-us-sampled-alias',
			fileName: 'saved.zip',
			chatTitle: 'US Chat',
			// Produced by the released v1.31.0 parser from the original source,
			// whose seventh message was "message 7" rather than the altered text.
			messageCount: 7,
			firstMessageTimestamp: legacyTimestamps[0].toISOString(),
			lastMessageTimestamp: legacyTimestamps[6].toISOString(),
			firstMessageIds: legacyTimestamps
				.slice(0, 5)
				.map((timestamp, index) =>
					releasedMessageId(timestamp, 'A', `message ${index + 1}`),
				),
			savedAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2024-01-01T00:00:00.000Z',
			fileReference: { type: 'reselect-required' as const },
			bookmarks: [],
			transcriptions: {},
			settings,
		};
		const callbacks = {
			applyBookmarks: vi.fn(),
			applyTranscriptions: vi.fn(),
			applySettings: vi.fn(),
			addChat: vi.fn(),
			startIndex: vi.fn(),
		};

		expect(
			acceptValidatedRestore(
				{ ...createChat(saved.id, saved.chatTitle), ...parsed },
				saved,
				callbacks,
			),
		).toBe(false);
		for (const callback of Object.values(callbacks)) {
			expect(callback).not.toHaveBeenCalled();
		}
	});

	it('uses a fully authenticated migration alias even when normal validation reaches its threshold', () => {
		const source = [
			'01/01/2020, 10:00 - A: one',
			'02/02/2020, 10:00 - A: two',
			'03/03/2020, 10:00 - A: three',
			'04/04/2020, 10:00 - A: four',
			'05/05/2020, 10:00 - A: five',
			'06/06/2020, 10:00 - A: six',
			'01/13/2020, 10:00 - B: month-first evidence',
			'07/07/2020, 10:00 - A: seven',
		].join('\n');
		const parsed = parseChat(source, 'US Chat', {
			includeValidationAliases: true,
		});
		const alias = parsed.validationAliases?.[0];
		expect(alias).toBeDefined();
		if (!alias) throw new Error('Expected a parser migration alias');
		const legacySixthId = Object.entries(alias.messageIdAliases).find(
			([, currentId]) => currentId === parsed.messages[5].id,
		)?.[0];
		expect(legacySixthId).toBeDefined();
		if (!legacySixthId) throw new Error('Expected the sixth legacy ID alias');
		const currentSixthId = alias.messageIdAliases[legacySixthId];
		expect(currentSixthId).toBe(parsed.messages[5].id);
		const legacyTranscriptions = Object.fromEntries(
			alias.legacyMessageIds
				.slice(5)
				.map((messageId, index) => [
					messageId,
					index === 0 ? 'legacy transcript' : 'covered legacy transcript',
				]),
		);

		const saved = {
			id: 'saved-us-threshold',
			fileName: 'saved.zip',
			chatTitle: 'US Chat',
			messageCount: alias.messageCount,
			firstMessageTimestamp: alias.firstMessageTimestamp,
			lastMessageTimestamp: alias.lastMessageTimestamp,
			firstMessageIds: alias.firstMessageIds,
			savedAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2024-01-01T00:00:00.000Z',
			fileReference: { type: 'reselect-required' as const },
			bookmarks: [],
			transcriptions: legacyTranscriptions,
			settings,
		};
		const callbacks = {
			applyBookmarks: vi.fn(),
			applyTranscriptions: vi.fn(),
			applySettings: vi.fn(),
			addChat: vi.fn(),
			startIndex: vi.fn(),
		};

		expect(
			acceptValidatedRestore(
				{ ...createChat(saved.id, saved.chatTitle), ...parsed },
				saved,
				callbacks,
			),
		).toBe(true);
		expect(callbacks.applyTranscriptions).toHaveBeenCalledWith(
			expect.objectContaining({
				[currentSixthId]: 'legacy transcript',
			}),
		);
	});

	it('rejects mismatched legacy metadata even when current validation reaches its threshold', () => {
		const source = [
			'01/01/2020, 10:00 - A: one',
			'02/02/2020, 10:00 - A: two',
			'03/03/2020, 10:00 - A: three',
			'04/04/2020, 10:00 - A: four',
			'05/05/2020, 10:00 - A: five',
			'06/06/2020, 10:00 - A: six',
			'01/13/2020, 10:00 - B: month-first evidence',
			'07/07/2020, 10:00 - A: seven',
		].join('\n');
		const parsed = parseChat(source, 'US Chat', {
			includeValidationAliases: true,
		});
		const alias = parsed.validationAliases?.[0];
		expect(alias).toBeDefined();
		if (!alias) throw new Error('Expected a parser migration alias');
		const saved = {
			id: 'saved-us-mismatched-metadata',
			fileName: 'saved.zip',
			chatTitle: 'US Chat',
			messageCount: alias.messageCount + 100,
			firstMessageTimestamp: alias.firstMessageTimestamp,
			lastMessageTimestamp: alias.lastMessageTimestamp,
			firstMessageIds: alias.firstMessageIds,
			savedAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2024-01-01T00:00:00.000Z',
			fileReference: { type: 'reselect-required' as const },
			bookmarks: [],
			transcriptions: Object.fromEntries(
				alias.legacyMessageIds
					.slice(5)
					.map((messageId) => [messageId, 'authenticated legacy reference']),
			),
			settings,
		};
		const callbacks = {
			applyBookmarks: vi.fn(),
			applyTranscriptions: vi.fn(),
			applySettings: vi.fn(),
			addChat: vi.fn(),
			startIndex: vi.fn(),
		};

		expect(
			acceptValidatedRestore(
				{ ...createChat(saved.id, saved.chatTitle), ...parsed },
				saved,
				callbacks,
			),
		).toBe(false);
		for (const callback of Object.values(callbacks)) {
			expect(callback).not.toHaveBeenCalled();
		}
	});

	it('rejects conflicting transcription aliases without restore side effects', () => {
		const parsed = parseChat(
			'01/12/2020, 14:30 - Alex: first\n01/13/2020, 09:00 - Sara: second',
			'US Chat',
			{ includeValidationAliases: true },
		);
		const alias = parsed.validationAliases?.[0];
		expect(alias).toBeDefined();
		if (!alias) throw new Error('Expected a parser migration alias');
		const legacyId = alias.firstMessageIds[0];
		const currentId = alias.messageIdAliases[legacyId];
		const saved = {
			id: 'saved-us-collision',
			fileName: 'saved.zip',
			chatTitle: 'US Chat',
			messageCount: alias.messageCount,
			firstMessageTimestamp: alias.firstMessageTimestamp,
			lastMessageTimestamp: alias.lastMessageTimestamp,
			firstMessageIds: alias.firstMessageIds,
			savedAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2024-01-01T00:00:00.000Z',
			fileReference: { type: 'reselect-required' as const },
			bookmarks: [],
			transcriptions: {
				[legacyId]: 'legacy text',
				[currentId]: 'different current text',
			},
			settings,
		};
		const callbacks = {
			applyBookmarks: vi.fn(),
			applyTranscriptions: vi.fn(),
			applySettings: vi.fn(),
			addChat: vi.fn(),
			startIndex: vi.fn(),
		};

		expect(
			acceptValidatedRestore(
				{ ...createChat(saved.id, saved.chatTitle), ...parsed },
				saved,
				callbacks,
			),
		).toBe(false);
		for (const callback of Object.values(callbacks)) {
			expect(callback).not.toHaveBeenCalled();
		}
	});

	it('rejects bookmark aliases that collide on one current message', () => {
		const parsed = parseChat(
			'01/12/2020, 14:30 - Alex: first\n01/13/2020, 09:00 - Sara: second',
			'US Chat',
			{ includeValidationAliases: true },
		);
		const alias = parsed.validationAliases?.[0];
		expect(alias).toBeDefined();
		if (!alias) throw new Error('Expected a parser migration alias');
		const legacyId = alias.firstMessageIds[0];
		const currentId = alias.messageIdAliases[legacyId];
		const saved = {
			id: 'saved-us-bookmark-collision',
			fileName: 'saved.zip',
			chatTitle: 'US Chat',
			messageCount: alias.messageCount,
			firstMessageTimestamp: alias.firstMessageTimestamp,
			lastMessageTimestamp: alias.lastMessageTimestamp,
			firstMessageIds: alias.firstMessageIds,
			savedAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2024-01-01T00:00:00.000Z',
			fileReference: { type: 'reselect-required' as const },
			bookmarks: [
				{
					id: 'bookmark-legacy',
					messageId: legacyId,
					chatId: 'US Chat',
					comment: 'legacy comment',
					createdAt: '2024-01-01T00:00:00.000Z',
					messagePreview: 'legacy',
					sender: 'Alex',
					messageTimestamp: alias.firstMessageTimestamp,
				},
				{
					id: 'bookmark-current',
					messageId: currentId,
					chatId: 'US Chat',
					comment: 'current comment',
					createdAt: '2024-01-02T00:00:00.000Z',
					messagePreview: 'current',
					sender: 'Alex',
					messageTimestamp: parsed.messages[0].timestamp.toISOString(),
				},
			],
			transcriptions: {},
			settings,
		};
		const callbacks = {
			applyBookmarks: vi.fn(),
			applyTranscriptions: vi.fn(),
			applySettings: vi.fn(),
			addChat: vi.fn(),
			startIndex: vi.fn(),
		};

		expect(
			acceptValidatedRestore(
				{ ...createChat(saved.id, saved.chatTitle), ...parsed },
				saved,
				callbacks,
			),
		).toBe(false);
		for (const callback of Object.values(callbacks)) {
			expect(callback).not.toHaveBeenCalled();
		}
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

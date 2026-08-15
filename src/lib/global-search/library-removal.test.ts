import { beforeEach, describe, expect, it, vi } from 'vitest';

const storedValues = new Map<string, unknown>();

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('idb-keyval', () => ({
	del: vi.fn(async (key: string) => {
		storedValues.delete(key);
	}),
	get: vi.fn(async (key: string) => storedValues.get(key)),
	keys: vi.fn(async () => [...storedValues.keys()]),
	set: vi.fn(async (key: string, value: unknown) => {
		storedValues.set(key, value);
	}),
}));

const { createVerifiedPersistedChatRemoval } = await import(
	'./library-removal'
);

const PERSISTED_PREFIX = 'whatsapp-persisted-chat-';
const HANDLE_PREFIX = 'whatsapp-file-handle-';

type FileReference =
	| { type: 'file-handle'; handleId: string }
	| { type: 'electron-path'; filePath: string }
	| { type: 'reselect-required' };

interface PersistedMetadataLike {
	id: string;
	fileReference: FileReference;
}

function seedPersistedArchive(archiveId: string, fileReference: FileReference) {
	storedValues.set(`${PERSISTED_PREFIX}${archiveId}`, {
		id: archiveId,
		fileName: `${archiveId}.zip`,
		chatTitle: 'Family Group',
		messageCount: 1,
		firstMessageTimestamp: '2020-01-01T00:00:00.000Z',
		lastMessageTimestamp: '2020-01-01T00:00:01.000Z',
		firstMessageIds: ['m0'],
		savedAt: '2020-01-01T00:00:00.000Z',
		updatedAt: '2020-01-01T00:00:00.000Z',
		fileReference,
		bookmarks: [],
		transcriptions: {},
		settings: {
			language: 'portuguese',
			autoLoadMedia: false,
			perspective: null,
		},
	});
	if (fileReference.type === 'file-handle') {
		storedValues.set(`${HANDLE_PREFIX}${fileReference.handleId}`, {
			kind: 'file',
			name: `${archiveId}.zip`,
		});
	}
}

function persistedKeys(): string[] {
	return [...storedValues.keys()].filter(
		(key) => key.startsWith(PERSISTED_PREFIX) || key.startsWith(HANDLE_PREFIX),
	);
}

/** Real storage adapters over the mocked idb-keyval map. */
function realAdapters() {
	return {
		getPersistedChatMetadata: async (
			id: string,
		): Promise<PersistedMetadataLike | undefined> =>
			(storedValues.get(`${PERSISTED_PREFIX}${id}`) as
				| PersistedMetadataLike
				| undefined) ?? undefined,
		deletePersistedChat: async (id: string): Promise<void> => {
			storedValues.delete(`${PERSISTED_PREFIX}${id}`);
		},
		deleteFileHandle: async (handleId: string): Promise<void> => {
			storedValues.delete(`${HANDLE_PREFIX}${handleId}`);
		},
		getFileHandle: async (handleId: string): Promise<unknown> =>
			storedValues.get(`${HANDLE_PREFIX}${handleId}`),
	};
}

beforeEach(() => {
	storedValues.clear();
	vi.stubGlobal('window', {});
	vi.stubGlobal('navigator', {});
});

describe('GH-67 §5 persisted metadata removal — verified by readback', () => {
	it('deletes the metadata record and its file handle, then verifies by readback', async () => {
		seedPersistedArchive('a1', { type: 'file-handle', handleId: 'a1' });
		seedPersistedArchive('a2', {
			type: 'electron-path',
			filePath: '/x/a2.zip',
		});

		const report = await createVerifiedPersistedChatRemoval(
			'a1',
			realAdapters(),
		);

		expect(report.complete).toBe(true);
		expect(report.metadataExisted).toBe(true);
		expect(report.removedFileHandle).toBe(true);
		// The sibling survives untouched.
		expect(persistedKeys()).toEqual([`${PERSISTED_PREFIX}a2`]);
	});

	it('reports incomplete (fail-closed) when the metadata record survives a claimed-success delete', async () => {
		seedPersistedArchive('a1', { type: 'reselect-required' });

		const report = await createVerifiedPersistedChatRemoval('a1', {
			...realAdapters(),
			deletePersistedChat: async () => {
				// simulate a delete that acknowledges but removes nothing —
				// the §5 readback must catch the survivor.
			},
		});

		expect(report.complete).toBe(false);
		expect(report.metadataRemaining).toBe(1);
	});

	it('reports incomplete when the underlying delete throws', async () => {
		seedPersistedArchive('a1', { type: 'reselect-required' });

		const report = await createVerifiedPersistedChatRemoval('a1', {
			...realAdapters(),
			getPersistedChatMetadata: async () =>
				storedValues.get(`${PERSISTED_PREFIX}a1`) as PersistedMetadataLike,
			deletePersistedChat: async () => {
				throw new Error('IndexedDB delete failed');
			},
			deleteFileHandle: async () => {},
		});

		expect(report.complete).toBe(false);
		expect(report.errorCode).toBe('metadata-delete-failed');
		// Fail-closed readback still ran: the survivor is counted.
		expect(report.metadataRemaining).toBe(1);
	});

	it('reports incomplete when the file-handle record survives its delete', async () => {
		seedPersistedArchive('a1', { type: 'file-handle', handleId: 'a1' });

		const report = await createVerifiedPersistedChatRemoval('a1', {
			...realAdapters(),
			deleteFileHandle: async () => {
				// handle delete acknowledges but removes nothing
			},
		});

		expect(report.complete).toBe(false);
		expect(report.fileHandleRemaining).toBe(1);
		expect(report.metadataRemaining).toBe(0);
	});

	it('treats a missing metadata record as a complete no-op (idempotent re-run)', async () => {
		const report = await createVerifiedPersistedChatRemoval(
			'ghost',
			realAdapters(),
		);

		expect(report.complete).toBe(true);
		expect(report.metadataExisted).toBe(false);
	});
});

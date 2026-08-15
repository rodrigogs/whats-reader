import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../parser/chat-parser';
import type { ChatData } from '../state.svelte';
import type {
	GlobalSearchWorkerInput,
	GlobalSearchWorkerOutput,
} from '../workers/global-search-worker';
import { createGlobalSearchWorkerController } from '../workers/global-search-worker';
import { createGlobalSearchState } from './global-search-state.svelte';
import type { GlobalSearchTransport } from './query-orchestrator';
import { createInMemoryGlobalSearchStorage } from './storage';

function loopback(): () => GlobalSearchTransport {
	let handler: ((output: GlobalSearchWorkerOutput) => void) | null = null;
	const controller = createGlobalSearchWorkerController((output) => {
		setTimeout(() => handler?.(output), 0);
	});
	return () => ({
		post(input: GlobalSearchWorkerInput) {
			void controller.handle(input);
		},
		onMessage(callback) {
			handler = callback;
		},
	});
}

function msg(id: string, content: string, sender: string, timestamp: number) {
	return {
		id,
		content,
		sender,
		timestamp: new Date(timestamp),
		isSystemMessage: false,
		isMediaMessage: false,
		rawLine: `${timestamp} - ${sender}: ${content}`,
	} satisfies ChatMessage;
}

function chat(archiveId: string, title: string, messages: ChatMessage[]) {
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
	} satisfies ChatData;
}

/**
 * In-memory persisted-chat namespace, seeded like the real
 * `whatsapp-persisted-chat-{id}` + `whatsapp-file-handle-{id}` records.
 */
type RemovalFileReference =
	| { type: 'file-handle'; handleId: string }
	| { type: 'electron-path'; filePath: string }
	| { type: 'reselect-required' };

function createPersistedLibraryStore() {
	const metadata = new Map<string, { fileReference: RemovalFileReference }>();
	const handles = new Map<string, unknown>();
	return {
		metadata,
		handles,
		getPersistedChatMetadata: async (archiveId: string) =>
			metadata.get(archiveId),
		deletePersistedChat: async (archiveId: string) => {
			metadata.delete(archiveId);
		},
		deleteFileHandle: async (handleId: string) => {
			handles.delete(handleId);
		},
		getFileHandle: async (handleId: string) => handles.get(handleId),
	};
}

function createState(
	gate = true,
	persistedStore = createPersistedLibraryStore(),
) {
	const storage = createInMemoryGlobalSearchStorage();
	const state = createGlobalSearchState({
		gate,
		storage,
		workerFactory: loopback(),
		estimateProvider: async () => ({
			usage: 0,
			quota: Number.MAX_SAFE_INTEGER,
		}),
		persistedLibraryStore: persistedStore,
	});
	return { state, storage, persistedStore };
}

describe('GH-67 §5/§10.6 unified removal — global-search state surface', () => {
	it('panel remove-from-library deletes index+consent AND persisted metadata+file-handle (full cascade)', async () => {
		const { state, storage, persistedStore } = createState();
		persistedStore.metadata.set('a1', {
			fileReference: { type: 'file-handle', handleId: 'a1' },
		});
		persistedStore.handles.set('a1', { kind: 'file' });

		state.setLoadedChats([
			chat('a1', 'Family', [msg('m1', 'hello', 'Ana', 1)]),
		]);
		await state.setConsentChoice('a1', 'keep-locally');

		const report = await state.removeFromLibrary('a1');

		expect(report.complete).toBe(true);
		// (a) zero orphaned global-search keys (index/manifest/commit/consent)
		expect(await storage.keys()).toEqual([]);
		// (b) zero leftover persisted metadata / file-handle records
		expect(persistedStore.metadata.size).toBe(0);
		expect(persistedStore.handles.size).toBe(0);
		expect(state.isKeepingLocally('a1')).toBe(false);
	});

	it('fails closed when the persisted metadata survives (readback surfaced)', async () => {
		const persistedStore = createPersistedLibraryStore();
		persistedStore.metadata.set('a1', {
			fileReference: { type: 'reselect-required' },
		});
		const { state } = createState(true, {
			...persistedStore,
			deletePersistedChat: async () => {
				// acknowledges but removes nothing
			},
		});

		const report = await state.removeFromLibrary('a1');

		expect(report.complete).toBe(false);
		expect(report.persisted.complete).toBe(false);
		expect(report.persisted.metadataRemaining).toBe(1);
	});

	it('same-title sibling unaffected (archiveId isolation)', async () => {
		const { state, storage, persistedStore } = createState();
		persistedStore.metadata.set('archive-a', {
			fileReference: { type: 'file-handle', handleId: 'archive-a' },
		});
		persistedStore.metadata.set('archive-b', {
			fileReference: { type: 'file-handle', handleId: 'archive-b' },
		});
		persistedStore.handles.set('archive-a', { kind: 'file' });
		persistedStore.handles.set('archive-b', { kind: 'file' });

		state.setLoadedChats([
			chat('archive-a', 'Family', [msg('m1', 'hello', 'Ana', 1)]),
			chat('archive-b', 'Family', [msg('m1', 'hello', 'Ana', 2)]),
		]);
		await state.setConsentChoice('archive-a', 'keep-locally');
		await state.setConsentChoice('archive-b', 'keep-locally');

		const report = await state.removeFromLibrary('archive-a');

		expect(report.complete).toBe(true);
		// Sibling's global-search keys and persisted records survive.
		const remainingKeys = await storage.keys();
		expect(remainingKeys.length).toBeGreaterThan(0);
		expect(remainingKeys.every((key) => key.includes('archive-b'))).toBe(true);
		expect(persistedStore.metadata.has('archive-a')).toBe(false);
		expect(persistedStore.metadata.has('archive-b')).toBe(true);
		expect(state.isKeepingLocally('archive-b')).toBe(true);
	});

	it('session-only archive: persistence no-op but in-session state cleared', async () => {
		const { state, storage, persistedStore } = createState();
		// never persisted, never consented
		state.setLoadedChats([
			chat('session-only', 'Family', [msg('m1', 'hi', 'Ana', 1)]),
		]);

		const report = await state.removeFromLibrary('session-only');

		expect(report.complete).toBe(true);
		expect(report.persisted.metadataExisted).toBe(false);
		expect(report.globalSearch.deletedKeys).toEqual([]);
		expect(await storage.keys()).toEqual([]);
		expect(persistedStore.metadata.size).toBe(0);
		expect(state.isKeepingLocally('session-only')).toBe(false);
	});

	it('gate-false: cascade runs as persistence no-op yet still clears state and reports complete', async () => {
		const { state, storage, persistedStore } = createState(false);
		state.setLoadedChats([
			chat('a1', 'Family', [msg('m1', 'hello', 'Ana', 1)]),
		]);

		const report = await state.removeFromLibrary('a1');

		expect(report.complete).toBe(true);
		expect(report.globalSearch.deletedKeys).toEqual([]);
		expect(await storage.keys()).toEqual([]);
		// The persisted half still removes the metadata record — the feature
		// being disabled must not leave "remove from library" half-done: the
		// sidebar forget path (its twin surface) has always removed metadata.
		expect(persistedStore.metadata.size).toBe(0);
	});
});

describe('GH-67 §5 removal — readback verification detail', () => {
	it('manifest no longer lists the archiveId and storage returns nothing for it', async () => {
		const { state, storage } = createState();
		state.setLoadedChats([
			chat('a1', 'Family', [msg('m1', 'hello', 'Ana', 1)]),
		]);
		await state.setConsentChoice('a1', 'keep-locally');

		await state.removeFromLibrary('a1');

		// Manifest readback: no key mentions the archive at all.
		const remaining = await storage.keys();
		expect(remaining.some((key) => key.includes('a1'))).toBe(false);
		// Coverage readback: the archive left in-session coverage.
		expect(state.coverage.some((entry) => entry.archiveId === 'a1')).toBe(
			false,
		);
	});

	it('coverage drops the removed archive even when it was remembered (requires-file → gone)', async () => {
		const { state } = createState();
		state.setLoadedChats([
			chat('a1', 'Family', [msg('m1', 'hello', 'Ana', 1)]),
		]);
		state.setRememberedArchives([{ archiveId: 'a1', chatTitle: 'Family' }]);
		await state.setConsentChoice('a1', 'keep-locally');
		state.setLoadedChats([]);

		await state.removeFromLibrary('a1');

		expect(state.coverage.some((entry) => entry.archiveId === 'a1')).toBe(
			false,
		);
	});
});

// Keep the rune environment import referenced so this file runs under the
// svelte compiler like its siblings (module-level side effects only).
describe('GH-67 §5 removal — environment', () => {
	it('runs under the svelte rune compiler', () => {
		expect(true).toBe(true);
	});
});

vi.mock('$app/environment', () => ({ browser: true }));

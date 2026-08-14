import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../parser/chat-parser';
import { type ChatData, createAppState } from '../state.svelte';
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

function msg(
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

function createState(gate = true) {
	const storage = createInMemoryGlobalSearchStorage();
	const state = createGlobalSearchState({
		gate,
		storage,
		workerFactory: loopback(),
		estimateProvider: async () => ({
			usage: 0,
			quota: Number.MAX_SAFE_INTEGER,
		}),
	});
	return { state, storage };
}

describe('GH-67 global search state — fail-closed', () => {
	it('is inert when the gate is false', async () => {
		const { state } = createState(false);

		expect(state.enabled).toBe(false);
		expect(state.status).toBe('disabled');

		await state.initialize();
		state.setLoadedChats([
			chat('a1', 'Family', [msg('m1', 'hello', 'Ana', 1)]),
		]);
		await state.submitQuery('hello');

		expect(state.status).toBe('disabled');
		expect(state.results).toEqual([]);
		expect(state.coverage).toEqual([]);
	});
});

describe('GH-67 global search state — entry without a selected chat', () => {
	it('runs a query with no loaded chats and returns zero results', async () => {
		const { state } = createState();
		state.setLoadedChats([]);

		await state.submitQuery('hello');

		expect(state.status).toBe('complete');
		expect(state.results).toEqual([]);
		expect(state.totalMatches).toBe(0);
	});
});

describe('GH-67 global search state — identity and navigation', () => {
	it('navigates by canonical (archiveId, ordinal, messageId) despite title and message-id collisions', async () => {
		const { state } = createState();
		const first = chat('archive-a', 'Family', [
			msg('m1', 'hello world', 'Ana', 100),
		]);
		const second = chat('archive-b', 'Family', [
			msg('m1', 'hello world', 'Ana', 200),
		]);
		expect(first.title).toBe(second.title);
		state.setLoadedChats([first, second]);

		await state.submitQuery('hello');

		expect(state.results).toHaveLength(2);
		const byArchive = new Map(state.results.map((r) => [r.archiveId, r]));
		const outcomeA = state.openResult(byArchive.get('archive-a')!);
		const outcomeB = state.openResult(byArchive.get('archive-b')!);

		expect(outcomeA).toEqual({
			kind: 'navigate',
			archiveId: 'archive-a',
			ordinal: 0,
			messageId: 'm1',
		});
		expect(outcomeB).toEqual({
			kind: 'navigate',
			archiveId: 'archive-b',
			ordinal: 0,
			messageId: 'm1',
		});
	});

	it('returns requires-source for a remembered archive that is not loaded', async () => {
		const { state } = createState();
		state.setRememberedArchives([
			{ archiveId: 'archive-remembered', chatTitle: 'Remembered' },
		]);
		state.setLoadedChats([]);

		// Build a ready manifest for the remembered archive by indexing it first,
		// then simulate it being closed.
		state.setLoadedChats([
			chat('archive-remembered', 'Remembered', [
				msg('m9', 'needle', 'Ana', 300),
			]),
		]);
		await state.setConsentChoice('archive-remembered', 'keep-locally');

		// Close the chat (session only) — the index remains.
		state.setLoadedChats([]);

		await state.submitQuery('needle');
		expect(state.results).toHaveLength(1);

		const outcome = state.openResult(state.results[0]);
		expect(outcome).toEqual({
			kind: 'requires-source',
			archiveId: 'archive-remembered',
		});
		expect(state.sourceMissingArchiveId).toBe('archive-remembered');
	});

	it('preserves query and filters when the source is missing', async () => {
		const { state } = createState();
		state.setRememberedArchives([
			{ archiveId: 'archive-remembered', chatTitle: 'Remembered' },
		]);
		state.setLoadedChats([
			chat('archive-remembered', 'Remembered', [
				msg('m9', 'needle', 'Ana', 300),
			]),
		]);
		await state.setConsentChoice('archive-remembered', 'keep-locally');
		state.setLoadedChats([]);

		state.setFilters({ senders: ['Ana'] });
		await state.submitQuery('needle');
		state.openResult(state.results[0]);

		expect(state.query).toBe('needle');
		expect(state.filters).toEqual({ senders: ['Ana'] });
	});
});

describe('GH-67 global search state — empty query exposes coverage', () => {
	it('shows session-only coverage and no messages for an empty query', async () => {
		const { state } = createState();
		state.setLoadedChats([
			chat('a1', 'Family', [msg('m1', 'hello', 'Ana', 1)]),
		]);

		await state.submitQuery('   ');

		expect(state.status).toBe('idle');
		expect(state.results).toEqual([]);
		expect(state.totalMatches).toBe(0);
		expect(state.coverage).toEqual([
			{ archiveId: 'a1', chatTitle: 'Family', status: 'session-only' },
		]);
	});
});

describe('GH-67 global search state — 50-result paging', () => {
	it('pages deterministically at 50 items', async () => {
		const { state } = createState();
		const messages = Array.from({ length: 51 }, (_, index) =>
			msg(`m-${index}`, `match ${index}`, 'Ana', 1_000 + index),
		);
		state.setLoadedChats([chat('a1', 'Big', messages)]);

		await state.submitQuery('match');

		expect(state.results).toHaveLength(51);
		expect(state.totalPages).toBe(2);
		expect(state.pageSize).toBe(50);
		expect(state.pagedResults).toHaveLength(50);

		state.nextPage();
		expect(state.page).toBe(1);
		expect(state.pagedResults).toHaveLength(1);
		expect(state.canGoNext).toBe(false);
		expect(state.canGoPrev).toBe(true);
	});
});

describe('GH-67 global search state — consent and removal distinctions', () => {
	it('keep-locally indexes; session-only removes the index; close-chat keeps it', async () => {
		const { state } = createState();
		const archive = chat('a1', 'Family', [msg('m1', 'hello', 'Ana', 1)]);
		state.setLoadedChats([archive]);

		await state.setConsentChoice('a1', 'keep-locally');
		expect(state.isKeepingLocally('a1')).toBe(true);
		expect(state.coverage).toEqual([
			{ archiveId: 'a1', chatTitle: 'Family', status: 'ready' },
		]);

		// Close-chat (session removal only) must NOT drop the ready index.
		state.setLoadedChats([]);
		expect(state.coverage).toEqual([
			{ archiveId: 'a1', chatTitle: 'Family', status: 'ready' },
		]);

		state.setLoadedChats([archive]);
		await state.setConsentChoice('a1', 'session-only');
		expect(state.isKeepingLocally('a1')).toBe(false);
		expect(state.coverage).toEqual([
			{ archiveId: 'a1', chatTitle: 'Family', status: 'session-only' },
		]);
	});

	it('remove-from-library drops the archive entirely', async () => {
		const { state } = createState();
		const archive = chat('a1', 'Family', [msg('m1', 'hello', 'Ana', 1)]);
		state.setLoadedChats([archive]);
		state.setRememberedArchives([{ archiveId: 'a1', chatTitle: 'Family' }]);
		await state.setConsentChoice('a1', 'keep-locally');

		// Close the chat first (remove-from-library is a separate action that
		// also removes the persisted index + consent).
		state.setLoadedChats([]);

		const report = await state.removeFromLibrary('a1');
		expect(report.complete).toBe(true);
		expect(state.isKeepingLocally('a1')).toBe(false);

		// Still remembered → requires-file, not ready.
		expect(state.coverage).toEqual([
			{ archiveId: 'a1', chatTitle: 'Family', status: 'requires-file' },
		]);
	});

	it('delete-all-local-indices removes only the global-search namespace and acknowledges', async () => {
		const { state, storage } = createState();
		const archive = chat('a1', 'Family', [msg('m1', 'hello', 'Ana', 1)]);
		state.setLoadedChats([archive]);
		await state.setConsentChoice('a1', 'keep-locally');

		const report = await state.deleteAllLocalIndices();
		expect(report.complete).toBe(true);
		expect(report.remaining).toBe(0);
		expect(state.deleteAllAcknowledged).toBe(true);
		expect(state.coverage).toEqual([
			{ archiveId: 'a1', chatTitle: 'Family', status: 'session-only' },
		]);

		const remainingKeys = await storage.keys();
		expect(remainingKeys).toEqual([]);
	});
});

describe('GH-67 global search state — cancellation and focus', () => {
	it('cancels an in-flight query and requests input focus', async () => {
		const { state } = createState();
		const messages = Array.from({ length: 5_000 }, (_, index) =>
			msg(`m-${index}`, `match ${index}`, 'Ana', index),
		);
		state.setLoadedChats([chat('big', 'Big', messages)]);

		const run = state.submitQuery('match');
		state.cancel();
		await run;

		expect(state.status).toBe('cancelled');
		expect(state.results).toEqual([]);
		expect(state.focusTarget).toBe('input');
	});
});

describe('GH-67 global search state — local-search shortcut isolation', () => {
	it('does not touch the local (in-chat) search state', async () => {
		const app = createAppState();
		const { state } = createState();
		state.setLoadedChats([
			chat('a1', 'Family', [msg('m1', 'hello', 'Ana', 1)]),
		]);

		app.setSearchQuery('local-needle');
		await state.submitQuery('global-needle');

		// The local search query and results are untouched by global search.
		expect(app.searchQuery).toBe('local-needle');
		expect(app.searchResultIds).toEqual([]);
		expect(state.query).toBe('global-needle');
	});
});

import { describe, expect, it } from 'vitest';
import { type ChatData, createAppState } from '$lib/state.svelte';
import { createArchivePageState } from './archive-page-state.svelte';

function createChat(archiveId: string): ChatData {
	return {
		archiveId,
		title: 'Family Group',
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

// MUTATION GUARD (RED): these tests exercise the real `createArchivePageState`
// factory consumed by `+page.svelte`. If any per-archive map is re-keyed on
// `chat.title` instead of `archiveId`, the two archives below share the title
// 'Family Group', so every independence assertion here collapses and the test
// fails — proving that title-keyed storage is a regression.
describe('archive page state is keyed by archiveId, not title', () => {
	it('keeps language, perspective, auto-load, remembered and file refs independent for equal-titled archives', () => {
		const state = createArchivePageState();
		const first = createChat('first-archive');
		const second = createChat('second-archive');
		expect(first.title).toBe(second.title);

		state.setLanguage(first.archiveId, 'portuguese');
		state.setLanguage(second.archiveId, 'english');
		state.setPerspective(first.archiveId, 'Ana');
		state.setPerspective(second.archiveId, 'Bruno');
		state.setAutoLoadMedia(first.archiveId, true);
		state.setAutoLoadMedia(second.archiveId, false);
		state.addRemembered(first.archiveId);
		state.setFileReference(first.archiveId, {
			file: null,
			persistedId: first.archiveId,
		});
		state.setFileReference(second.archiveId, {
			file: null,
			persistedId: second.archiveId,
		});

		expect(state.getLanguage(first.archiveId)).toBe('portuguese');
		expect(state.getLanguage(second.archiveId)).toBe('english');
		expect(state.getPerspective(first.archiveId)).toBe('Ana');
		expect(state.getPerspective(second.archiveId)).toBe('Bruno');
		expect(state.getAutoLoadMedia(first.archiveId)).toBe(true);
		expect(state.getAutoLoadMedia(second.archiveId)).toBe(false);
		expect(state.isRemembered(first.archiveId)).toBe(true);
		expect(state.isRemembered(second.archiveId)).toBe(false);
		expect(state.getFileReference(first.archiveId)).toEqual({
			file: null,
			persistedId: first.archiveId,
		});
		expect(state.getFileReference(second.archiveId)).toEqual({
			file: null,
			persistedId: second.archiveId,
		});
	});

	it('removes exactly one archive, leaving the other intact', () => {
		const state = createArchivePageState();
		const first = createChat('first-archive');
		const second = createChat('second-archive');
		expect(first.title).toBe(second.title);

		state.setLanguage(first.archiveId, 'english');
		state.setLanguage(second.archiveId, 'spanish');
		state.setPerspective(first.archiveId, 'Ana');
		state.setPerspective(second.archiveId, 'Bruno');
		state.setAutoLoadMedia(first.archiveId, true);
		state.setAutoLoadMedia(second.archiveId, true);
		state.addRemembered(first.archiveId);
		state.addRemembered(second.archiveId);
		state.setFileReference(first.archiveId, {
			file: null,
			persistedId: first.archiveId,
		});
		state.setFileReference(second.archiveId, {
			file: null,
			persistedId: second.archiveId,
		});

		state.removeArchive(first.archiveId);

		// First archive falls back to defaults.
		expect(state.getLanguage(first.archiveId)).toBe('portuguese');
		expect(state.getPerspective(first.archiveId)).toBeNull();
		expect(state.getAutoLoadMedia(first.archiveId)).toBe(false);
		expect(state.isRemembered(first.archiveId)).toBe(false);
		expect(state.getFileReference(first.archiveId)).toBeUndefined();

		// Second archive is untouched.
		expect(state.getLanguage(second.archiveId)).toBe('spanish');
		expect(state.getPerspective(second.archiveId)).toBe('Bruno');
		expect(state.getAutoLoadMedia(second.archiveId)).toBe(true);
		expect(state.isRemembered(second.archiveId)).toBe(true);
		expect(state.getFileReference(second.archiveId)).toEqual({
			file: null,
			persistedId: second.archiveId,
		});
	});

	it('updates and removes exactly one archive in app state when titles collide', () => {
		const state = createAppState();
		const first = createChat('first-archive');
		const second = createChat('second-archive');
		state.addChat(first);
		state.addChat(second);

		state.updateChatMessageIndex(
			second.archiveId,
			new Map([['shared-message', 2]]),
		);
		state.updateChatMessageIndex(
			first.archiveId,
			new Map([['shared-message', 1]]),
		);

		expect(state.chats[0].messageIndex?.get('shared-message')).toBe(1);
		expect(state.chats[1].messageIndex?.get('shared-message')).toBe(2);
		expect(state.indexedArchiveIds).toEqual(
			new Set([first.archiveId, second.archiveId]),
		);

		state.removeChat(0);

		expect(state.chats).toHaveLength(1);
		expect(state.chats[0].archiveId).toBe(second.archiveId);
		expect(state.indexedArchiveIds).toEqual(new Set([second.archiveId]));
	});
});

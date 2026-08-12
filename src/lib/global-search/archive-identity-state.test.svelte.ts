import { describe, expect, it } from 'vitest';
import { type ChatData, createAppState } from '$lib/state.svelte';

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

describe('archive-indexed runtime state', () => {
	it('updates and removes exactly one archive when titles collide', () => {
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

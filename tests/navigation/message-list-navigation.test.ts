import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { getNextMessageIndex } from '../../src/lib/helpers/message-list-navigation.ts';

type Item = { type: 'date' | 'message'; id?: string };

function itemsOf(types: Array<'date' | 'message'>): Item[] {
	return types.map((type, i) => (type === 'message' ? { type, id: `m${i}` } : { type }));
}

describe('getNextMessageIndex', () => {
	it('returns -1 when the list has no message items', () => {
		assert.equal(getNextMessageIndex([{ type: 'date' }], -1, 'down'), -1);
		assert.equal(getNextMessageIndex([], -1, 'down'), -1);
		assert.equal(getNextMessageIndex([], -1, 'up'), -1);
	});

	it('starts at the first message when nothing is focused and moving down', () => {
		const items = itemsOf(['date', 'message', 'message', 'date', 'message']);
		assert.equal(getNextMessageIndex(items, -1, 'down'), 1);
	});

	it('starts at the last message when nothing is focused and moving up', () => {
		const items = itemsOf(['date', 'message', 'message', 'date', 'message']);
		assert.equal(getNextMessageIndex(items, -1, 'up'), 4);
	});

	it('moves to the next message, skipping date separators', () => {
		const items = itemsOf(['message', 'date', 'message', 'date', 'message']);
		assert.equal(getNextMessageIndex(items, 0, 'down'), 2);
		assert.equal(getNextMessageIndex(items, 2, 'down'), 4);
	});

	it('moves to the previous message, skipping date separators', () => {
		const items = itemsOf(['message', 'date', 'message', 'date', 'message']);
		assert.equal(getNextMessageIndex(items, 4, 'up'), 2);
		assert.equal(getNextMessageIndex(items, 2, 'up'), 0);
	});

	it('stays on the current message at the boundaries', () => {
		const items = itemsOf(['message', 'message']);
		assert.equal(getNextMessageIndex(items, 0, 'up'), 0);
		assert.equal(getNextMessageIndex(items, 1, 'down'), 1);
	});

	it('stays on a single message regardless of direction', () => {
		const items = itemsOf(['date', 'message', 'date']);
		assert.equal(getNextMessageIndex(items, 1, 'down'), 1);
		assert.equal(getNextMessageIndex(items, 1, 'up'), 1);
	});
});

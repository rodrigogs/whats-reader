import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { resolveLightboxItem } from '../../src/lib/helpers/lightbox.ts';

interface Item {
	path: string;
	label: string;
}

function itemsOf(paths: string[]): Item[] {
	return paths.map((path) => ({ path, label: `label-${path}` }));
}

describe('resolveLightboxItem', () => {
	it('returns null when the path is null', () => {
		const items = itemsOf(['a.jpg', 'b.jpg']);
		assert.equal(resolveLightboxItem(items, null), null);
	});

	it('returns the matching item when the path is present', () => {
		const items = itemsOf(['a.jpg', 'b.jpg', 'c.jpg']);
		const result = resolveLightboxItem(items, 'b.jpg');
		assert.deepEqual(result, { path: 'b.jpg', label: 'label-b.jpg' });
	});

	it('returns null when the path is not present in items', () => {
		const items = itemsOf(['a.jpg', 'b.jpg']);
		assert.equal(resolveLightboxItem(items, 'missing.jpg'), null);
	});

	it('resolves a path filtered out of a narrower list when given the unfiltered list (GH-92)', () => {
		// Simulates the gallery's filtered `items` (participant/type filter active)
		// vs. the unfiltered `allItems`. A bubble click must resolve against the
		// unfiltered list even while a filter is active in the gallery panel.
		const allItems = itemsOf(['a.jpg', 'b.jpg', 'c.jpg']);
		const filteredItems = allItems.filter((item) => item.path !== 'b.jpg');

		assert.equal(resolveLightboxItem(filteredItems, 'b.jpg'), null);
		assert.deepEqual(resolveLightboxItem(allItems, 'b.jpg'), {
			path: 'b.jpg',
			label: 'label-b.jpg',
		});
	});

	it('returns null on an empty items list', () => {
		assert.equal(resolveLightboxItem([], 'a.jpg'), null);
	});
});

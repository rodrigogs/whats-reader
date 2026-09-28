import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { snapshotDroppedFiles } from '../../src/lib/helpers/drop-files';

/**
 * Simulate Chromium's DataTransfer behavior: the `.files` getter returns
 * the actual files synchronously, but after the first async yield it returns
 * an empty FileList (because the DataTransfer access policy becomes kNumb).
 */
class FakeDataTransfer implements Partial<DataTransfer> {
	private hasAwaitedYet = false;
	private realFiles: File[];

	constructor(files: File[]) {
		this.realFiles = files;
	}

	get files(): FileList {
		// Simulate Chromium: files only accessible until the first await
		if (this.hasAwaitedYet) {
			return {
				length: 0,
				item: () => null,
				[Symbol.iterator]: function* () {
					// empty
				},
			} as unknown as FileList;
		}

		// Convert real files to FileList-like object
		const fileList = {
			length: this.realFiles.length,
			item: (index: number) => this.realFiles[index] || null,
			[Symbol.iterator]: function* (this: typeof fileList) {
				for (let i = 0; i < this.length; i++) {
					yield this.item(i);
				}
			},
		} as unknown as FileList;

		return fileList;
	}

	get items(): DataTransferItemList {
		// For this test, we simulate items that produce file handles
		// (they also get invalidated after await)
		const items = {
			length: this.realFiles.length,
			add: () => {
				/* noop */
			},
			clear: () => {
				/* noop */
			},
			remove: () => {
				/* noop */
			},
			[Symbol.iterator]: function* (this: typeof items) {
				for (let i = 0; i < this.length; i++) {
					yield this[i as never];
				}
			},
		} as unknown as DataTransferItemList;
		return items;
	}

	/**
	 * Call this to simulate the async boundary where Chromium invalidates the DataTransfer.
	 * After this is called, .files will return an empty list.
	 */
	async _simulateAsyncBoundary() {
		this.hasAwaitedYet = true;
		await Promise.resolve();
	}
}

describe('snapshotDroppedFiles', () => {
	it('captures files BEFORE they become invalid across async boundaries', async () => {
		const testFile = new File(['test'], 'test.zip', { type: 'application/zip' });
		const dt = new FakeDataTransfer([testFile]) as unknown as DataTransfer;

		// The helper should capture the files synchronously
		const snapshot = snapshotDroppedFiles(dt);

		// Verify the snapshot has the file
		assert.equal(snapshot.files.length, 1);
		assert.equal(snapshot.files[0].name, 'test.zip');

		// Now simulate the async boundary (which happens in the real handleDrop)
		await (dt as unknown as FakeDataTransfer)._simulateAsyncBoundary();

		// After the async boundary, the DataTransfer is invalid in real Chromium
		// But our snapshot should still have the file
		assert.equal(dt.files.length, 0, 'DataTransfer should be empty after async');
		assert.equal(snapshot.files.length, 1, 'Snapshot should still have the file');
		assert.equal(snapshot.files[0].name, 'test.zip');
	});

	it('returns an array of files (not a FileList) for immutability', () => {
		const testFile = new File(['test'], 'test.zip', { type: 'application/zip' });
		const dt = new FakeDataTransfer([testFile]) as unknown as DataTransfer;

		const snapshot = snapshotDroppedFiles(dt);

		// Should be an array, not a FileList
		assert(Array.isArray(snapshot.files));
		assert.equal(snapshot.files[0].name, 'test.zip');
	});

	it('handles multiple dropped files', () => {
		const file1 = new File(['a'], 'a.zip', { type: 'application/zip' });
		const file2 = new File(['b'], 'b.zip', { type: 'application/zip' });
		const dt = new FakeDataTransfer([file1, file2]) as unknown as DataTransfer;

		const snapshot = snapshotDroppedFiles(dt);

		assert.equal(snapshot.files.length, 2);
		assert.equal(snapshot.files[0].name, 'a.zip');
		assert.equal(snapshot.files[1].name, 'b.zip');
	});

	it('handles empty drop', () => {
		const dt = new FakeDataTransfer([]) as unknown as DataTransfer;

		const snapshot = snapshotDroppedFiles(dt);

		assert.equal(snapshot.files.length, 0);
	});
});

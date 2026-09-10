/**
 * Snapshot dropped files and handle promises synchronously.
 *
 * CRITICAL: This must be called BEFORE any await in the drop handler.
 * In Chromium, the DataTransfer object becomes invalid after the first async yield,
 * and .files will return an empty list. This captures both before that happens.
 *
 * @param dt The DataTransfer object from a drop event
 * @returns Object with arrays of files and handle promises
 */
export function snapshotDroppedFiles(dt: DataTransfer): {
	files: File[];
	handlePromises: Promise<FileSystemFileHandle | null>[];
} {
	// Snapshot files immediately (before any await)
	const files = Array.from(dt.files);

	// Start all handle promises immediately (synchronously)
	// These also become invalid after the first await, so we capture them as promises
	const handlePromises: Promise<FileSystemFileHandle | null>[] = [];
	if (
		dt.items &&
		typeof globalThis.DataTransferItem !== 'undefined' &&
		'getAsFileSystemHandle' in globalThis.DataTransferItem.prototype
	) {
		for (const item of Array.from(dt.items)) {
			try {
				handlePromises.push(
					item.getAsFileSystemHandle() as Promise<FileSystemFileHandle | null>,
				);
			} catch {
				handlePromises.push(Promise.resolve(null));
			}
		}
	}

	return { files, handlePromises };
}

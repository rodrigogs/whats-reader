/**
 * Thumbnail generation for the media gallery.
 *
 * Creates small image thumbnails without using the full-media cache.
 * This avoids keeping many large blobs in memory just to render a grid.
 */

import type { MediaFile } from './parser/zip-parser';

const DEFAULT_MAX_SIZE = 256;
const DEFAULT_QUALITY = 0.82;
const MAX_THUMBNAILS = 300;
const MAX_CONCURRENT_THUMBNAILS = 2;

const thumbnailUrlCache = new Map<string, string>();
const thumbnailPromiseCache = new Map<string, Promise<string | null>>();

let inFlight = 0;
const queue: Array<() => void> = [];

function runLimited<T>(fn: () => Promise<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		const run = () => {
			inFlight++;
			fn()
				.then(resolve, reject)
				.finally(() => {
					inFlight--;
					queue.shift()?.();
				});
		};

		if (inFlight < MAX_CONCURRENT_THUMBNAILS) {
			run();
		} else {
			queue.push(run);
		}
	});
}

function evictOldestThumbnails(): void {
	if (thumbnailUrlCache.size <= MAX_THUMBNAILS) return;

	const overflow = thumbnailUrlCache.size - MAX_THUMBNAILS;
	const keysToRemove: string[] = [];

	let i = 0;
	for (const key of thumbnailUrlCache.keys()) {
		keysToRemove.push(key);
		i++;
		if (i >= overflow) break;
	}

	for (const key of keysToRemove) {
		const url = thumbnailUrlCache.get(key);
		if (url) URL.revokeObjectURL(url);
		thumbnailUrlCache.delete(key);
	}
}

function getImageMimeType(filename: string): string {
	const ext = filename.toLowerCase().split('.').pop() || '';
	if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
	if (ext === 'png') return 'image/png';
	if (ext === 'gif') return 'image/gif';
	if (ext === 'webp') return 'image/webp';
	if (ext === 'bmp') return 'image/bmp';
	if (ext === 'svg') return 'image/svg+xml';
	return 'application/octet-stream';
}

async function canvasToBlob(
	canvas: HTMLCanvasElement | OffscreenCanvas,
	type: string,
	quality: number,
): Promise<Blob> {
	if ('convertToBlob' in canvas) {
		return (canvas as OffscreenCanvas).convertToBlob({ type, quality });
	}

	return new Promise((resolve, reject) => {
		(canvas as HTMLCanvasElement).toBlob(
			(blob) => {
				if (!blob) {
					reject(new Error('Failed to create thumbnail blob'));
					return;
				}
				resolve(blob);
			},
			type,
			quality,
		);
	});
}

export async function getImageThumbnailUrl(
	media: MediaFile,
	options?: { maxSize?: number; quality?: number },
): Promise<string | null> {
	if (media.type !== 'image') return null;
	if (!media._zipEntry) return null;
	if (typeof createImageBitmap === 'undefined') return null;

	const key = media.path;
	const cached = thumbnailUrlCache.get(key);
	if (cached) return cached;

	const pending = thumbnailPromiseCache.get(key);
	if (pending) return pending;

	const promise = runLimited(async () => {
		try {
			const maxSize = options?.maxSize ?? DEFAULT_MAX_SIZE;
			const quality = options?.quality ?? DEFAULT_QUALITY;

			const arrayBuffer = await media._zipEntry?.async('arraybuffer');
			if (!arrayBuffer) return null;

			const blob = new Blob([arrayBuffer], {
				type: getImageMimeType(media.name),
			});

			// Decode and downscale using ImageBitmap resize options.
			const bitmap = await createImageBitmap(blob);
			const scale = Math.min(
				1,
				maxSize / Math.max(bitmap.width || 1, bitmap.height || 1),
			);
			const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
			const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

			let resized: ImageBitmap;
			try {
				resized = await createImageBitmap(blob, {
					resizeWidth: targetWidth,
					resizeHeight: targetHeight,
					resizeQuality: 'high',
				});
			} catch {
				// Fallback to original if resize options are not supported.
				resized = bitmap;
			}

			const canvas: HTMLCanvasElement | OffscreenCanvas =
				typeof OffscreenCanvas !== 'undefined'
					? new OffscreenCanvas(targetWidth, targetHeight)
					: Object.assign(document.createElement('canvas'), {
							width: targetWidth,
							height: targetHeight,
						});

			let ctx:
				| CanvasRenderingContext2D
				| OffscreenCanvasRenderingContext2D
				| null = null;
			if (
				typeof OffscreenCanvas !== 'undefined' &&
				canvas instanceof OffscreenCanvas
			) {
				ctx = canvas.getContext('2d');
			} else {
				ctx = (canvas as HTMLCanvasElement).getContext('2d');
			}
			if (!ctx) return null;

			ctx.drawImage(resized, 0, 0, targetWidth, targetHeight);

			const outBlob = await canvasToBlob(canvas, 'image/webp', quality);
			const url = URL.createObjectURL(outBlob);

			thumbnailUrlCache.set(key, url);
			evictOldestThumbnails();

			return url;
		} finally {
			thumbnailPromiseCache.delete(key);
		}
	});

	thumbnailPromiseCache.set(key, promise);
	return promise;
}

export function cleanupThumbnailUrls(): void {
	for (const url of thumbnailUrlCache.values()) {
		URL.revokeObjectURL(url);
	}
	thumbnailUrlCache.clear();
	thumbnailPromiseCache.clear();
}

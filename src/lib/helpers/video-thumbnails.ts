/**
 * Video thumbnail generation utilities
 * Extracts frames from video files for hover preview functionality
 */

export interface VideoFrameCache {
	frames: string[];
	duration: number;
	frameCount: number;
}

const frameCache = new Map<string, VideoFrameCache>();

/**
 * Extract multiple frames from a video blob for scrubbing preview
 * @param videoBlob The video file as a Blob
 * @param videoId Unique identifier for caching
 * @param frameCount Number of frames to extract across video duration
 * @returns Promise with array of data URLs for each frame
 */
export async function extractVideoFrames(
	videoBlob: Blob,
	videoId: string,
	frameCount = 10,
): Promise<VideoFrameCache> {
	// Check cache first
	const cached = frameCache.get(videoId);
	if (cached) {
		return cached;
	}

	return new Promise((resolve, reject) => {
		const video = document.createElement('video');
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');

		if (!ctx) {
			reject(new Error('Could not get canvas context'));
			return;
		}

		const objectUrl = URL.createObjectURL(videoBlob);
		video.src = objectUrl;
		video.muted = true;
		video.preload = 'metadata';

		const frames: string[] = [];
		let currentFrameIndex = 0;
		let duration = 0;

		video.addEventListener('loadedmetadata', () => {
			duration = video.duration;

			// Set canvas size to video dimensions (scaled down for performance)
			const scale = 0.5; // Scale down to 50% for smaller data URLs
			canvas.width = video.videoWidth * scale;
			canvas.height = video.videoHeight * scale;

			// Start extracting frames
			extractNextFrame();
		});

		video.addEventListener('error', () => {
			URL.revokeObjectURL(objectUrl);
			reject(new Error('Failed to load video'));
		});

		function extractNextFrame() {
			if (currentFrameIndex >= frameCount) {
				// All frames extracted
				URL.revokeObjectURL(objectUrl);
				const cache: VideoFrameCache = { frames, duration, frameCount };
				frameCache.set(videoId, cache);
				resolve(cache);
				return;
			}

			// Calculate timestamp for this frame
			const timestamp = (duration / (frameCount - 1)) * currentFrameIndex;

			video.currentTime = timestamp;
		}

		video.addEventListener('seeked', function onSeeked() {
			try {
				// Draw current video frame to canvas
				ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);

				// Convert to data URL
				const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
				frames.push(dataUrl);

				currentFrameIndex++;
				extractNextFrame();
			} catch (err) {
				URL.revokeObjectURL(objectUrl);
				reject(err);
			}
		});

		video.load();
	});
}

/**
 * Get frame index based on mouse position over thumbnail
 * @param mouseX Mouse X position relative to thumbnail
 * @param thumbnailWidth Width of the thumbnail element
 * @param frameCount Total number of frames available
 * @returns Frame index to display
 */
export function getFrameIndexFromPosition(
	mouseX: number,
	thumbnailWidth: number,
	frameCount: number,
): number {
	const percentage = Math.max(0, Math.min(1, mouseX / thumbnailWidth));
	const index = Math.floor(percentage * frameCount);
	return Math.min(index, frameCount - 1);
}

/**
 * Clear cached frames for a specific video
 * @param videoId Video identifier
 */
export function clearFrameCache(videoId: string): void {
	frameCache.delete(videoId);
}

/**
 * Clear all cached frames
 */
export function clearAllFrameCaches(): void {
	frameCache.clear();
}

/**
 * Get cache size for monitoring
 */
export function getCacheSize(): number {
	return frameCache.size;
}

/**
 * Extract a single thumbnail frame from video (for static preview)
 * @param videoBlob The video file as a Blob
 * @param timestamp Optional timestamp to extract (defaults to 10% into video)
 * @returns Promise with data URL for the frame
 */
export async function extractVideoThumbnail(
	videoBlob: Blob,
	timestamp?: number,
): Promise<string> {
	return new Promise((resolve, reject) => {
		const video = document.createElement('video');
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');

		if (!ctx) {
			reject(new Error('Could not get canvas context'));
			return;
		}

		const objectUrl = URL.createObjectURL(videoBlob);
		video.src = objectUrl;
		video.muted = true;
		video.preload = 'metadata';

		video.addEventListener('loadedmetadata', () => {
			// Set canvas size (scaled down for performance)
			const scale = 0.5;
			canvas.width = video.videoWidth * scale;
			canvas.height = video.videoHeight * scale;

			// Use provided timestamp or default to 10% into the video
			const targetTime = timestamp ?? video.duration * 0.1;
			video.currentTime = targetTime;
		});

		video.addEventListener('error', () => {
			URL.revokeObjectURL(objectUrl);
			reject(new Error('Failed to load video'));
		});

		video.addEventListener('seeked', function onSeeked() {
			try {
				ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
				const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
				URL.revokeObjectURL(objectUrl);
				resolve(dataUrl);
			} catch (err) {
				URL.revokeObjectURL(objectUrl);
				reject(err);
			}
		});

		video.load();
	});
}

/**
 * Extract audio duration
 * @param audioBlob The audio file as a Blob
 * @returns Promise with duration in seconds
 */
export async function extractAudioDuration(audioBlob: Blob): Promise<number> {
	return new Promise((resolve, reject) => {
		const audio = document.createElement('audio');
		const objectUrl = URL.createObjectURL(audioBlob);

		audio.src = objectUrl;
		audio.preload = 'metadata';

		audio.addEventListener('loadedmetadata', () => {
			URL.revokeObjectURL(objectUrl);
			resolve(audio.duration);
		});

		audio.addEventListener('error', () => {
			URL.revokeObjectURL(objectUrl);
			reject(new Error('Failed to load audio'));
		});

		audio.load();
	});
}

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 * @param seconds Duration in seconds
 * @returns Formatted string
 */
export function formatDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return '0:00';

	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}

	return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

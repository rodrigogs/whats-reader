/**
 * ZIP File Parser for WhatsApp exports
 *
 * Handles ZIP files that contain chat exports with media attachments
 * Optimized for large backups with lazy loading of media files
 */

import JSZip from 'jszip';
import { type ChatMessage, type ParsedChat, parseChat } from './chat-parser';

export interface MediaFile {
	name: string;
	path: string;
	type: 'image' | 'video' | 'audio' | 'document' | 'other';
	size: number;
	blob?: Blob;
	url?: string;
	// For lazy loading
	_zipEntry?: JSZip.JSZipObject;
	_loaded?: boolean;
}

export interface ParsedZipChat extends ParsedChat {
	mediaFiles: MediaFile[];
	hasMedia: boolean;
	// Reference to zip for lazy loading
	_zip?: JSZip;
}

// Keep track of loaded media to manage memory
const loadedMediaCache = new Map<string, { url: string; refCount: number }>();
const MAX_CACHED_MEDIA = 50; // Maximum number of media files to keep in memory

function getMediaType(filename: string): MediaFile['type'] {
	const ext = filename.toLowerCase().split('.').pop() || '';

	const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
	const videoExts = ['mp4', 'mov', 'avi', 'mkv', '3gp', 'webm'];
	const audioExts = ['opus', 'mp3', 'wav', 'aac', 'm4a', 'ogg'];
	const docExts = [
		'pdf',
		'doc',
		'docx',
		'xls',
		'xlsx',
		'ppt',
		'pptx',
		'txt',
		'vcf',
		'xml',
	];

	if (imageExts.includes(ext)) return 'image';
	if (videoExts.includes(ext)) return 'video';
	if (audioExts.includes(ext)) return 'audio';
	if (docExts.includes(ext)) return 'document';

	return 'other';
}

export interface ParseProgress {
	stage: 'reading' | 'extracting' | 'parsing';
	progress: number; // 0-100
}

/**
 * Parse a WhatsApp ZIP export file
 * Uses lazy loading for media files to handle large backups efficiently
 */
export async function parseZipFile(
	file: File | ArrayBuffer,
	onProgress?: (progress: ParseProgress) => void,
): Promise<ParsedZipChat> {
	const zip = new JSZip();

	onProgress?.({ stage: 'extracting', progress: 0 });

	// Load ZIP (JSZip doesn't support progress callback for loadAsync)
	const contents = await zip.loadAsync(file);

	onProgress?.({ stage: 'extracting', progress: 30 });

	let chatContent = '';
	let chatFilename = 'WhatsApp Chat';
	const mediaFiles: MediaFile[] = [];

	// Get all file entries for progress tracking
	const fileEntries = Object.entries(contents.files).filter(
		([, entry]) => !entry.dir,
	);
	const totalFiles = fileEntries.length;
	let processedFiles = 0;

	// First pass: find the chat text file and catalog media files (without loading them)
	for (const [path, zipEntry] of fileEntries) {
		const filename = path.split('/').pop() || path;

		if (filename.endsWith('.txt') && !filename.startsWith('.')) {
			// This is likely the chat file - load it immediately (it's small)
			chatContent = await zipEntry.async('string');
			chatFilename = filename;
		} else {
			// This is a media file - catalog it but don't load yet
			const mediaType = getMediaType(filename);

			if (mediaType !== 'other' || !filename.startsWith('.')) {
				mediaFiles.push({
					name: filename,
					path,
					type: mediaType,
					size: 0, // Will be set when loaded
					_zipEntry: zipEntry,
					_loaded: false,
				});
			}
		}

		processedFiles++;
		// Report progress: 30-80% for file enumeration
		const enumerationProgress = 30 + (processedFiles / totalFiles) * 50;
		onProgress?.({ stage: 'extracting', progress: enumerationProgress });
	}

	if (!chatContent) {
		throw new Error('No chat file found in ZIP archive');
	}

	onProgress?.({ stage: 'parsing', progress: 0 });

	// Parse the chat content
	const parsedChat = parseChat(chatContent, chatFilename);

	onProgress?.({ stage: 'parsing', progress: 50 });

	// Try to match media files with messages (just references, no loading)
	const enhancedMessages = matchMediaToMessages(
		parsedChat.messages,
		mediaFiles,
	);

	onProgress?.({ stage: 'parsing', progress: 100 });

	return {
		...parsedChat,
		messages: enhancedMessages,
		mediaFiles,
		hasMedia: mediaFiles.length > 0,
		_zip: zip,
	};
}

/**
 * Try to match media files with their corresponding messages
 */
function matchMediaToMessages(
	messages: ChatMessage[],
	mediaFiles: MediaFile[],
): ChatMessage[] {
	// Create a map of media files by name for quick lookup
	const mediaMap = new Map<string, MediaFile>();
	for (const media of mediaFiles) {
		mediaMap.set(media.name.toLowerCase(), media);
		// Also add without extension for partial matching
		const nameWithoutExt = media.name.toLowerCase().replace(/\.[^.]+$/, '');
		mediaMap.set(nameWithoutExt, media);
	}

	return messages.map((message) => {
		if (!message.isMediaMessage) return message;

		// Try to find a matching media file
		const content = message.content.toLowerCase();

		for (const [key, media] of mediaMap) {
			if (content.includes(key) || content.includes(media.name.toLowerCase())) {
				return {
					...message,
					mediaFile: media,
				} as ChatMessage & { mediaFile: MediaFile };
			}
		}

		return message;
	});
}

/**
 * Read a file as ArrayBuffer with progress callback
 */
export function readFileAsArrayBuffer(
	file: File,
	onProgress?: (progress: number) => void,
): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as ArrayBuffer);
		reader.onerror = () => reject(reader.error);
		if (onProgress) {
			reader.onprogress = (event) => {
				if (event.lengthComputable) {
					onProgress((event.loaded / event.total) * 100);
				}
			};
		}
		reader.readAsArrayBuffer(file);
	});
}

/**
 * Get MIME type from filename extension
 */
function getMimeType(filename: string): string {
	const ext = filename.toLowerCase().split('.').pop() || '';
	const mimeTypes: Record<string, string> = {
		// Images
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		png: 'image/png',
		gif: 'image/gif',
		webp: 'image/webp',
		bmp: 'image/bmp',
		svg: 'image/svg+xml',
		// Videos
		mp4: 'video/mp4',
		mov: 'video/quicktime',
		avi: 'video/x-msvideo',
		mkv: 'video/x-matroska',
		'3gp': 'video/3gpp',
		webm: 'video/webm',
		// Audio
		opus: 'audio/opus',
		mp3: 'audio/mpeg',
		wav: 'audio/wav',
		aac: 'audio/aac',
		m4a: 'audio/mp4',
		ogg: 'audio/ogg',
		// Documents
		pdf: 'application/pdf',
		txt: 'text/plain',
		xml: 'application/xml',
		vcf: 'text/vcard',
	};
	return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Load a media file on demand (lazy loading)
 * Returns the blob URL for the media file
 */
export async function loadMediaFile(media: MediaFile): Promise<string> {
	// Already loaded and cached
	if (media.url && media._loaded) {
		return media.url;
	}

	// Check if in cache
	const cached = loadedMediaCache.get(media.path);
	if (cached) {
		cached.refCount++;
		media.url = cached.url;
		media._loaded = true;
		return cached.url;
	}

	// Need to load from zip
	if (!media._zipEntry) {
		throw new Error(
			`Cannot load media file: ${media.name} - no zip entry reference`,
		);
	}

	// Evict old entries if cache is full
	if (loadedMediaCache.size >= MAX_CACHED_MEDIA) {
		evictOldestFromCache();
	}

	// Load the blob with correct MIME type
	const arrayBuffer = await media._zipEntry.async('arraybuffer');
	const mimeType = getMimeType(media.name);
	const blob = new Blob([arrayBuffer], { type: mimeType });
	const url = URL.createObjectURL(blob);

	// Cache it
	loadedMediaCache.set(media.path, { url, refCount: 1 });

	// Update media object
	media.blob = blob;
	media.url = url;
	media.size = blob.size;
	media._loaded = true;

	return url;
}

/**
 * Evict the oldest/least used entries from cache
 */
function evictOldestFromCache(): void {
	// Simple strategy: remove entries with lowest refCount
	const entries = Array.from(loadedMediaCache.entries());
	entries.sort((a, b) => a[1].refCount - b[1].refCount);

	// Remove bottom 20%
	const toRemove = Math.max(1, Math.floor(entries.length * 0.2));
	for (let i = 0; i < toRemove; i++) {
		const [path, { url }] = entries[i];
		URL.revokeObjectURL(url);
		loadedMediaCache.delete(path);
	}
}

/**
 * Clean up media URLs when done
 */
export function cleanupMediaUrls(mediaFiles: MediaFile[]): void {
	for (const media of mediaFiles) {
		if (media.url) {
			URL.revokeObjectURL(media.url);
			media.url = undefined;
			media.blob = undefined;
			media._loaded = false;
		}
	}
	// Clear the cache
	for (const { url } of loadedMediaCache.values()) {
		URL.revokeObjectURL(url);
	}
	loadedMediaCache.clear();
}

/**
 * Preload visible media files (for smooth scrolling)
 * Call this with the media files that are about to be visible
 */
export async function preloadMedia(mediaFiles: MediaFile[]): Promise<void> {
	// Limit concurrent loads to avoid overwhelming the browser
	const BATCH_SIZE = 5;

	for (let i = 0; i < mediaFiles.length; i += BATCH_SIZE) {
		const batch = mediaFiles.slice(i, i + BATCH_SIZE);
		await Promise.all(
			batch
				.filter((m) => !m._loaded && m._zipEntry)
				.map((m) => loadMediaFile(m).catch(() => {})), // Ignore individual failures
		);
	}
}

/**
 * Get file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
	const units = ['B', 'KB', 'MB', 'GB'];
	let size = bytes;
	let unitIndex = 0;

	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}

	return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Persistent Conversation Storage
 * Allows users to save chat sessions across app restarts without storing large ZIP files.
 *
 * Storage Strategy (Hybrid Approach):
 * - Electron: Store absolute file path, read from disk on restore
 * - Web (Chromium): Store FileSystemFileHandle in IndexedDB
 * - Web (Firefox/Safari): Store metadata only, prompt to re-select file
 *
 * What Gets Stored (Always Small ~1MB):
 * - Chat metadata (title, filename, timestamps, message count)
 * - Bookmarks array
 * - Transcriptions map
 * - Settings (language, autoLoadMedia, perspective)
 * - File reference (path/handle/reselect-required marker)
 *
 * The actual ZIP file content is NEVER stored in the browser.
 */

import { browser } from '$app/environment';
import { get, set, del, keys } from 'idb-keyval';
import type { Bookmark } from './bookmarks.svelte';
import type { ChatData } from './state.svelte';

export interface PersistedChatMetadata {
	id: string; // Unique ID (crypto.randomUUID)
	fileName: string; // Original filename
	chatTitle: string; // Parsed chat title (for display)
	messageCount: number; // For validation
	firstMessageTimestamp: string; // ISO string - for validation
	lastMessageTimestamp: string; // ISO string - for validation
	firstMessageIds: string[]; // First 5 message IDs (backup validation for iOS)
	savedAt: string; // ISO timestamp
	updatedAt: string; // ISO timestamp (for sorting)

	// File reference (varies by platform)
	fileReference:
		| { type: 'electron-path'; filePath: string }
		| { type: 'file-handle'; handleId: string } // Handle stored separately
		| { type: 'reselect-required' };

	// Persisted data (always stored - small)
	bookmarks: Bookmark[];
	transcriptions: Record<string, string>;
	settings: {
		language: string;
		autoLoadMedia: boolean;
		perspective: string | null;
	};
}

export interface ValidationResult {
	valid: boolean;
	confidence: 'high' | 'medium' | 'low';
	reasons: string[];
}

const PERSISTENCE_PREFIX = 'whatsapp-persisted-chat-';
const HANDLE_PREFIX = 'whatsapp-file-handle-';
const DONT_SHOW_KEY = 'whatsapp-dont-show-restore-modal';

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported(): boolean {
	if (!browser) return false;
	return 'showOpenFilePicker' in window;
}

/**
 * Request persistent storage to prevent eviction
 */
export async function requestPersistentStorage(): Promise<boolean> {
	if (!browser || !navigator.storage?.persist) return false;
	try {
		const granted = await navigator.storage.persist();
		return granted;
	} catch (e) {
		console.error('Failed to request persistent storage:', e);
		return false;
	}
}

/**
 * Save a persisted chat
 */
export async function savePersistedChat(
	chat: ChatData,
	file: File | null,
	bookmarks: Bookmark[],
	transcriptions: Record<string, string>,
	settings: {
		language: string;
		autoLoadMedia: boolean;
		perspective: string | null;
	},
	filePath?: string, // For Electron
): Promise<string> {
	if (!browser) throw new Error('Persistence only available in browser');

	// Generate unique ID
	const id = crypto.randomUUID();

	// Extract first 5 message IDs for validation
	const firstMessageIds = chat.messages
		.slice(0, 5)
		.map((msg) => msg.id)
		.filter(Boolean);

	// Determine file reference based on platform
	let fileReference: PersistedChatMetadata['fileReference'];

	// Check if running in Electron
	const isElectron = window.electronAPI?.isElectron;

	if (isElectron && filePath) {
		// Electron: store absolute file path
		fileReference = { type: 'electron-path', filePath };
	} else if (isFileSystemAccessSupported() && file) {
		// Web (Chromium): try to get file handle
		try {
			// Modern browsers allow getting a handle from a File object
			// We need to prompt the user to select the file again to get a handle we can store
			// For now, mark as reselect-required since we can't get a handle from drag-drop
			fileReference = { type: 'reselect-required' };
		} catch (e) {
			fileReference = { type: 'reselect-required' };
		}
	} else {
		// Firefox/Safari or no file: require reselect
		fileReference = { type: 'reselect-required' };
	}

	const metadata: PersistedChatMetadata = {
		id,
		fileName: file?.name || chat.title,
		chatTitle: chat.title,
		messageCount: chat.messages.length,
		firstMessageTimestamp:
			chat.messages[0]?.timestamp.toISOString() || new Date().toISOString(),
		lastMessageTimestamp:
			chat.messages[chat.messages.length - 1]?.timestamp.toISOString() ||
			new Date().toISOString(),
		firstMessageIds,
		savedAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		fileReference,
		bookmarks,
		transcriptions,
		settings,
	};

	// Save metadata
	await set(`${PERSISTENCE_PREFIX}${id}`, metadata);

	// Request persistent storage
	await requestPersistentStorage();

	return id;
}

/**
 * Get all persisted chats (sorted by updatedAt)
 */
export async function getPersistedChats(): Promise<PersistedChatMetadata[]> {
	if (!browser) return [];

	try {
		const allKeys = await keys();
		const chatKeys = allKeys.filter(
			(key) => typeof key === 'string' && key.startsWith(PERSISTENCE_PREFIX),
		);

		const chats: PersistedChatMetadata[] = [];
		for (const key of chatKeys) {
			const metadata = await get<PersistedChatMetadata>(key as string);
			if (metadata) {
				chats.push(metadata);
			}
		}

		// Sort by updatedAt (most recent first)
		return chats.sort(
			(a, b) =>
				new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
		);
	} catch (e) {
		console.error('Failed to get persisted chats:', e);
		return [];
	}
}

/**
 * Remove a persisted chat
 */
export async function removePersistedChat(id: string): Promise<void> {
	if (!browser) return;

	try {
		await del(`${PERSISTENCE_PREFIX}${id}`);
		// Also remove file handle if exists
		await del(`${HANDLE_PREFIX}${id}`);
	} catch (e) {
		console.error('Failed to remove persisted chat:', e);
	}
}

/**
 * Update a persisted chat (for updating bookmarks/transcriptions)
 */
export async function updatePersistedChat(
	id: string,
	updates: Partial<PersistedChatMetadata>,
): Promise<void> {
	if (!browser) return;

	try {
		const metadata = await get<PersistedChatMetadata>(
			`${PERSISTENCE_PREFIX}${id}`,
		);
		if (!metadata) throw new Error('Chat not found');

		const updated: PersistedChatMetadata = {
			...metadata,
			...updates,
			updatedAt: new Date().toISOString(),
		};

		await set(`${PERSISTENCE_PREFIX}${id}`, updated);
	} catch (e) {
		console.error('Failed to update persisted chat:', e);
		throw e;
	}
}

/**
 * Get persisted chat by ID
 */
export async function getPersistedChat(
	id: string,
): Promise<PersistedChatMetadata | null> {
	if (!browser) return null;

	try {
		return (await get<PersistedChatMetadata>(`${PERSISTENCE_PREFIX}${id}`)) || null;
	} catch (e) {
		console.error('Failed to get persisted chat:', e);
		return null;
	}
}

/**
 * Validate a restored file against saved metadata
 */
export function validateRestoredFile(
	parsed: ChatData,
	saved: PersistedChatMetadata,
): ValidationResult {
	const reasons: string[] = [];
	let matchCount = 0;

	// Check message count
	const messageCountMatch = parsed.messages.length === saved.messageCount;
	if (messageCountMatch) {
		matchCount++;
	} else {
		reasons.push(
			`Message count mismatch: expected ${saved.messageCount}, got ${parsed.messages.length}`,
		);
	}

	// Check first message timestamp
	const firstMessageMatch =
		parsed.messages[0]?.timestamp.toISOString() ===
		saved.firstMessageTimestamp;
	if (firstMessageMatch) {
		matchCount++;
	} else {
		reasons.push('First message timestamp mismatch');
	}

	// Check last message timestamp
	const lastMessageMatch =
		parsed.messages[parsed.messages.length - 1]?.timestamp.toISOString() ===
		saved.lastMessageTimestamp;
	if (lastMessageMatch) {
		matchCount++;
	} else {
		reasons.push('Last message timestamp mismatch');
	}

	// Check first message IDs
	const parsedFirstIds = parsed.messages
		.slice(0, 5)
		.map((msg) => msg.id)
		.filter(Boolean);
	const firstIdsMatch =
		parsedFirstIds.length === saved.firstMessageIds.length &&
		parsedFirstIds.every((id, idx) => id === saved.firstMessageIds[idx]);
	if (firstIdsMatch) {
		matchCount++;
	} else {
		reasons.push('First message IDs mismatch');
	}

	// Determine confidence level
	let confidence: 'high' | 'medium' | 'low';
	if (messageCountMatch && firstMessageMatch && lastMessageMatch) {
		confidence = 'high';
	} else if (matchCount >= 2) {
		confidence = 'medium';
	} else {
		confidence = 'low';
	}

	return {
		valid: matchCount >= 2, // At least 2 signals must match
		confidence,
		reasons,
	};
}

/**
 * Restore a chat from file (Electron path or reselected file)
 */
export async function restoreChat(
	persistedChat: PersistedChatMetadata,
	file?: File,
): Promise<{
	success: boolean;
	data?: {
		buffer: ArrayBuffer;
		name: string;
		metadata: PersistedChatMetadata;
	};
	error?: string;
	needsReselect?: boolean;
}> {
	if (!browser)
		return { success: false, error: 'Restoration only available in browser' };

	const { fileReference } = persistedChat;

	try {
		// Electron path
		if (fileReference.type === 'electron-path') {
			const isElectron = window.electronAPI?.isElectron;
			if (!isElectron) {
				return { success: false, needsReselect: true };
			}

			// Check if file exists
			const exists = await window.electronAPI.fileExists(
				fileReference.filePath,
			);
			if (!exists) {
				return {
					success: false,
					error: 'File not found at saved path',
					needsReselect: true,
				};
			}

			// Read file from path
			const result = await window.electronAPI.readFileFromPath(
				fileReference.filePath,
			);
			if (!result.success || !result.buffer) {
				return {
					success: false,
					error: result.error || 'Failed to read file',
					needsReselect: true,
				};
			}

			return {
				success: true,
				data: {
					buffer: result.buffer,
					name: result.name || persistedChat.fileName,
					metadata: persistedChat,
				},
			};
		}

		// File handle (not implemented yet - requires user permission flow)
		if (fileReference.type === 'file-handle') {
			// For now, treat as reselect-required
			return { success: false, needsReselect: true };
		}

		// Reselect required
		if (fileReference.type === 'reselect-required') {
			if (!file) {
				return { success: false, needsReselect: true };
			}

			// User provided file - use it
			const buffer = await file.arrayBuffer();
			return {
				success: true,
				data: {
					buffer,
					name: file.name,
					metadata: persistedChat,
				},
			};
		}

		return { success: false, error: 'Unknown file reference type' };
	} catch (e) {
		console.error('Failed to restore chat:', e);
		return {
			success: false,
			error: e instanceof Error ? e.message : 'Unknown error',
		};
	}
}

/**
 * Get "don't show again" preference
 */
export async function getDontShowRestoreModal(): Promise<boolean> {
	if (!browser) return false;
	try {
		return (await get<boolean>(DONT_SHOW_KEY)) || false;
	} catch (e) {
		return false;
	}
}

/**
 * Set "don't show again" preference
 */
export async function setDontShowRestoreModal(value: boolean): Promise<void> {
	if (!browser) return;
	try {
		await set(DONT_SHOW_KEY, value);
	} catch (e) {
		console.error('Failed to set dont show preference:', e);
	}
}

/**
 * Find persisted chat by chat title
 */
export async function findPersistedChatByTitle(
	chatTitle: string,
): Promise<PersistedChatMetadata | null> {
	if (!browser) return null;

	try {
		const chats = await getPersistedChats();
		return chats.find((chat) => chat.chatTitle === chatTitle) || null;
	} catch (e) {
		console.error('Failed to find persisted chat:', e);
		return null;
	}
}

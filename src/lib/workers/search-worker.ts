/**
 * Web Worker for searching chat messages
 *
 * Uses simple string.includes() for fast substring search.
 *
 * Architecture:
 * - Messages are loaded ONCE per chat (via load-data)
 * - Subsequent searches only send the query string (minimal postMessage cost)
 * - Results are returned using a transferable bitmap for O(1) lookup performance
 */

// Stored state - loaded once per chat
let messages: Array<{ id: string; content: string; sender: string }> = [];
let messageIdToIndex: Map<string, number> = new Map();
let currentSearchId = 0;

interface LoadDataInput {
	type: 'load-data';
	// Simple message data - just what we need for search
	messages: Array<{ id: string; content: string; sender: string }>;
}

interface SearchInput {
	type: 'search';
	searchId: number;
	query: string;
	transcriptions?: Record<string, string>;
}

interface CancelInput {
	type: 'cancel';
}

type SearchWorkerInput = LoadDataInput | SearchInput | CancelInput;

interface SearchWorkerOutput {
	type: 'progress' | 'complete' | 'ready' | 'cancelled';
	searchId?: number;
	matchingIds?: string[];
	matchBitmap?: ArrayBuffer;
	totalMatches?: number;
	query?: string;
	progress?: number;
}

/**
 * Load message data from main thread.
 * This is called ONCE per chat, subsequent searches only send the query.
 */
function loadData(input: LoadDataInput): void {
	messages = input.messages;

	// Build index map for O(1) lookup of message position
	messageIdToIndex = new Map();
	for (let i = 0; i < messages.length; i++) {
		messageIdToIndex.set(messages[i].id, i);
	}

	self.postMessage({ type: 'ready' } as SearchWorkerOutput);
}

/**
 * Perform search using simple string.includes()
 * Returns results as a transferable bitmap for performance.
 */
function performSearch(input: SearchInput): void {
	const { searchId, query, transcriptions = {} } = input;
	currentSearchId = searchId;

	const messageCount = messages.length;

	if (!query.trim()) {
		const emptyBitmap = new Uint8Array(messageCount);
		self.postMessage(
			{
				type: 'complete',
				searchId,
				matchingIds: [],
				matchBitmap: emptyBitmap.buffer,
				totalMatches: 0,
				query,
				progress: 100,
			} as SearchWorkerOutput,
			{ transfer: [emptyBitmap.buffer] },
		);
		return;
	}

	const lowerQuery = query.toLowerCase();
	const matchBitmap = new Uint8Array(messageCount);
	let totalMatches = 0;

	// Report start
	self.postMessage({
		type: 'progress',
		searchId,
		query,
		progress: 5,
	} as SearchWorkerOutput);

	// Process in chunks to allow cancellation and progress updates
	const CHUNK_SIZE = 2000;

	for (let i = 0; i < messageCount; i += CHUNK_SIZE) {
		// Check cancellation
		if (currentSearchId !== searchId) {
			self.postMessage({ type: 'cancelled', searchId } as SearchWorkerOutput);
			return;
		}

		const end = Math.min(i + CHUNK_SIZE, messageCount);

		for (let j = i; j < end; j++) {
			const msg = messages[j];
			if (
				msg.content.toLowerCase().includes(lowerQuery) ||
				msg.sender.toLowerCase().includes(lowerQuery)
			) {
				matchBitmap[j] = 1;
				totalMatches++;
			}
		}

		const progress = Math.round((end / messageCount) * 70) + 5; // 5-75%
		self.postMessage({
			type: 'progress',
			searchId,
			query,
			progress,
		} as SearchWorkerOutput);
	}

	// Check cancellation before transcription search
	if (currentSearchId !== searchId) {
		self.postMessage({ type: 'cancelled', searchId } as SearchWorkerOutput);
		return;
	}

	// Search transcriptions (for audio messages)
	self.postMessage({
		type: 'progress',
		searchId,
		query,
		progress: 80,
	} as SearchWorkerOutput);

	for (const [msgId, transcription] of Object.entries(transcriptions)) {
		const idx = messageIdToIndex.get(msgId);
		if (
			idx !== undefined &&
			matchBitmap[idx] === 0 &&
			transcription.toLowerCase().includes(lowerQuery)
		) {
			matchBitmap[idx] = 1;
			totalMatches++;
		}
	}

	// Check cancellation
	if (currentSearchId !== searchId) {
		self.postMessage({ type: 'cancelled', searchId } as SearchWorkerOutput);
		return;
	}

	// Collect first N matching IDs for navigation (in chronological order)
	const MAX_NAV_RESULTS = 1000;
	const matchingIds: string[] = [];
	for (
		let i = 0;
		i < messageCount && matchingIds.length < MAX_NAV_RESULTS;
		i++
	) {
		if (matchBitmap[i] === 1) {
			matchingIds.push(messages[i].id);
		}
	}

	// Transfer the bitmap buffer for zero-copy performance
	self.postMessage(
		{
			type: 'complete',
			searchId,
			matchingIds,
			matchBitmap: matchBitmap.buffer,
			totalMatches,
			query,
			progress: 100,
		} as SearchWorkerOutput,
		{ transfer: [matchBitmap.buffer] },
	);
}

self.onmessage = (event: MessageEvent<SearchWorkerInput>) => {
	const input = event.data;

	switch (input.type) {
		case 'load-data':
			loadData(input);
			break;
		case 'search':
			performSearch(input);
			break;
		case 'cancel':
			currentSearchId++;
			break;
	}
};

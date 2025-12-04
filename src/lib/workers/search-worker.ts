/**
 * Web Worker for searching chat messages
 * This runs in a separate thread to prevent UI blocking on large chats
 */

// Time to yield to main thread between chunks (~1 frame at 60fps)
const FRAME_TIME_MS = 16;

interface SearchMessage {
	id: string;
	timestamp: string;
	sender: string;
	content: string;
	isSystemMessage: boolean;
	isMediaMessage: boolean;
	mediaType?: string;
	rawLine: string;
}

interface SearchWorkerInput {
	messages: SearchMessage[];
	query: string;
}

interface SearchWorkerOutput {
	type: 'progress' | 'complete';
	matchingIds?: string[];
	query: string;
	progress?: number; // 0-100
}

// Process search in chunks to allow progress updates to be sent
async function processSearch(messages: SearchMessage[], query: string) {
	const lowerQuery = query.toLowerCase();
	const matchingIds: string[] = [];
	const total = messages.length;
	
	// Process in chunks to yield control and send progress updates
	// Use smaller chunks for better progress visibility
	const NUM_CHUNKS = 10; // ~10 progress updates
	const CHUNK_SIZE = Math.max(50, Math.ceil(total / NUM_CHUNKS));
	
	// Send initial progress
	self.postMessage({
		type: 'progress',
		query,
		progress: 0
	} as SearchWorkerOutput);

	for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
		const chunkEnd = Math.min(i + CHUNK_SIZE, messages.length);
		
		// Process this chunk
		for (let j = i; j < chunkEnd; j++) {
			const message = messages[j];
			if (
				message.content.toLowerCase().includes(lowerQuery) ||
				message.sender.toLowerCase().includes(lowerQuery)
			) {
				matchingIds.push(message.id);
			}
		}
		
		// Report progress after each chunk
		const currentProgress = Math.round((chunkEnd / total) * 100);
		self.postMessage({
			type: 'progress',
			query,
			progress: currentProgress
		} as SearchWorkerOutput);
		
		// Give main thread time to process and render
		await new Promise(resolve => setTimeout(resolve, FRAME_TIME_MS));
	}

	return matchingIds;
}

self.onmessage = async (event: MessageEvent<SearchWorkerInput>) => {
	const { messages, query } = event.data;

	if (!query.trim()) {
		// Empty query - return empty results (don't highlight anything)
		const result: SearchWorkerOutput = {
			type: 'complete',
			matchingIds: [],
			query
		};
		self.postMessage(result);
		return;
	}

	const matchingIds = await processSearch(messages, query);

	const result: SearchWorkerOutput = {
		type: 'complete',
		matchingIds,
		query,
		progress: 100
	};

	self.postMessage(result);
};

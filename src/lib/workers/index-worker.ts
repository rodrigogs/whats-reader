/**
 * Web Worker for building message index and flat items list
 *
 * This worker builds:
 * 1. A map of messageId -> flatIndex for efficient bookmark navigation
 * 2. The flat items list with date separators for rendering
 * 3. Pre-serialized messages for search worker
 *
 * All operations are performed in a single worker pass for efficiency.
 */

/**
 * Serialized message format used for both input and output.
 * This structure matches SerializedSearchMessage in zip-parser.ts
 * (duplicated here because workers can't easily import from main bundle)
 */
interface SerializedMessage {
	id: string;
	timestamp: string; // ISO string
	sender: string;
	content: string;
	isSystemMessage: boolean;
	isMediaMessage: boolean;
	mediaType?: string;
	rawLine: string;
}

interface IndexWorkerInput {
	messages: SerializedMessage[];
	chatTitle: string;
}

/**
 * Serializable flat item types for rendering.
 * These match DateFlatItem/MessageFlatItem in zip-parser.ts
 * (duplicated here because workers can't easily import from main bundle)
 */
interface DateItem {
	type: 'date';
	date: string;
}

interface MessageItem {
	type: 'message';
	messageId: string;
}

type FlatItem = DateItem | MessageItem;

interface IndexWorkerOutput {
	chatTitle: string;
	indexEntries: [string, number][];
	flatItems: FlatItem[];
	// Pre-serialized messages for search worker (avoids re-serialization on every search)
	serializedMessages: SerializedMessage[];
}

self.onmessage = (event: MessageEvent<IndexWorkerInput>) => {
	const { messages, chatTitle } = event.data;

	// Group messages by date (same logic as groupMessagesByDate in chat-parser.ts)
	const groups = new Map<string, SerializedMessage[]>();

	for (const message of messages) {
		const timestamp = new Date(message.timestamp);
		const dateKey = timestamp.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});

		const existing = groups.get(dateKey) || [];
		existing.push(message);
		groups.set(dateKey, existing);
	}

	// Build the flat items list and index simultaneously
	const indexEntries: [string, number][] = [];
	const flatItems: FlatItem[] = [];
	let flatIndex = 0;

	for (const [date, dayMessages] of groups.entries()) {
		flatItems.push({ type: 'date', date });
		flatIndex++;

		for (const message of dayMessages) {
			indexEntries.push([message.id, flatIndex]);
			flatItems.push({ type: 'message', messageId: message.id });
			flatIndex++;
		}
	}

	// Pre-serialize messages for search worker (avoids re-serialization on every search)
	// Note: messages are already in SerializedMessage format, so we just pass them through
	const output: IndexWorkerOutput = {
		chatTitle,
		indexEntries,
		flatItems,
		serializedMessages: messages,
	};
	self.postMessage(output);
};

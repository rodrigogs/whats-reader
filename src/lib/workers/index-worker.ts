/**
 * Web Worker for building message index and flat items list
 *
 * This worker builds:
 * 1. A map of messageId -> flatIndex for efficient bookmark navigation
 * 2. The flat items list with date separators for rendering
 *
 * Both operations account for date separators in the flat list structure used by ChatView.
 */

interface IndexWorkerMessage {
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
	messages: IndexWorkerMessage[];
	chatTitle: string;
}

// Serializable flat item types
interface DateItem {
	type: 'date';
	date: string;
}

interface MessageItem {
	type: 'message';
	messageId: string;
}

type SerializedFlatItem = DateItem | MessageItem;

interface IndexWorkerOutput {
	chatTitle: string;
	indexEntries: [string, number][];
	flatItems: SerializedFlatItem[];
}

self.onmessage = (event: MessageEvent<IndexWorkerInput>) => {
	const { messages, chatTitle } = event.data;

	// Group messages by date (same logic as groupMessagesByDate in chat-parser.ts)
	const groups = new Map<string, IndexWorkerMessage[]>();

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
	const flatItems: SerializedFlatItem[] = [];
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

	const output: IndexWorkerOutput = { chatTitle, indexEntries, flatItems };
	self.postMessage(output);
};

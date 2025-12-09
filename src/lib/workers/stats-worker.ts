/**
 * Web Worker for computing chat statistics
 * This runs in a separate thread to prevent UI blocking
 */

interface ChatMessage {
	timestamp: string; // Serialized as ISO string since Date doesn't survive postMessage
	sender: string;
	isSystemMessage: boolean;
}

interface StatsWorkerInput {
	messages: ChatMessage[];
	messageCount: number;
	startDate: string | null;
	endDate: string | null;
}

interface WorkerOutput {
	messagesByParticipant: Record<string, number>;
	messagesByDate: Record<string, number>;
	messagesByHour: number[];
	mostActiveParticipant: string;
	mostActiveHour: number;
	avgMessagesPerDay: number;
	totalDays: number;
}

self.onmessage = (event: MessageEvent<StatsWorkerInput>) => {
	const { messages, messageCount, startDate, endDate } = event.data;

	const messagesByParticipant = new Map<string, number>();
	const messagesByDate = new Map<string, number>();
	const messagesByHour = new Array(24).fill(0);

	for (const message of messages) {
		if (!message.isSystemMessage) {
			// Count by participant
			const count = messagesByParticipant.get(message.sender) || 0;
			messagesByParticipant.set(message.sender, count + 1);

			// Parse date from ISO string
			const timestamp = new Date(message.timestamp);

			// Count by date
			const dateKey = timestamp.toISOString().split('T')[0];
			const dateCount = messagesByDate.get(dateKey) || 0;
			messagesByDate.set(dateKey, dateCount + 1);

			// Count by hour
			messagesByHour[timestamp.getHours()]++;
		}
	}

	// Find most active participant
	let mostActiveParticipant = '';
	let maxMessages = 0;
	for (const [participant, count] of messagesByParticipant) {
		if (count > maxMessages) {
			maxMessages = count;
			mostActiveParticipant = participant;
		}
	}

	// Find most active hour
	const mostActiveHour = messagesByHour.indexOf(Math.max(...messagesByHour));

	// Calculate average messages per day
	const start = startDate ? new Date(startDate) : null;
	const end = endDate ? new Date(endDate) : null;
	const daysDiff =
		start && end
			? Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) ||
				1
			: 1;
	const avgMessagesPerDay = Math.round(messageCount / daysDiff);

	const result: WorkerOutput = {
		messagesByParticipant: Object.fromEntries(messagesByParticipant),
		messagesByDate: Object.fromEntries(messagesByDate),
		messagesByHour,
		mostActiveParticipant,
		mostActiveHour,
		avgMessagesPerDay,
		totalDays: daysDiff,
	};

	self.postMessage(result);
};

/**
 * WhatsApp Chat Parser
 *
 * Parses WhatsApp chat export files (.txt) and extracts messages
 * Supports multiple date formats (US, European, ISO) and message patterns
 */

export interface ChatMessage {
	id: string;
	timestamp: Date;
	sender: string;
	content: string;
	isSystemMessage: boolean;
	isMediaMessage: boolean;
	mediaType?: 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'contact' | 'location';
	rawLine: string;
}

export interface ParsedChat {
	messages: ChatMessage[];
	participants: string[];
	startDate: Date | null;
	endDate: Date | null;
	title: string;
	messageCount: number;
	mediaCount: number;
}

// Media indicators used by WhatsApp
const MEDIA_INDICATORS = [
	'<Media omitted>',
	'<Mídia oculta>',
	'<Médias omis>',
	'<Medien ausgelassen>',
	'<Medien weggelaten>',
	'<Archivo omitido>',
	'(file attached)',
	'(arquivo anexado)',
	'image omitted',
	'video omitted',
	'audio omitted',
	'sticker omitted',
	'GIF omitted',
	'document omitted',
	'Contact card omitted',
	'.jpg (file attached)',
	'.png (file attached)',
	'.mp4 (file attached)',
	'.opus (file attached)',
	'.pdf (file attached)',
	'.webp (file attached)',
	'.jpg (arquivo anexado)',
	'.png (arquivo anexado)',
	'.mp4 (arquivo anexado)',
	'.opus (arquivo anexado)',
	'.pdf (arquivo anexado)',
	'.webp (arquivo anexado)',
	'.vcf (arquivo anexado)'
];

// System message indicators
const SYSTEM_INDICATORS = [
	"joined using this group's invite link",
	'created group',
	'added',
	'removed',
	'left',
	'changed the subject',
	"changed this group's icon",
	'changed the group description',
	'deleted this group',
	'Messages and calls are end-to-end encrypted',
	'You created group',
	'security code changed',
	'turned on disappearing messages',
	'turned off disappearing messages',
	// Portuguese
	'As mensagens e ligações são protegidas com a criptografia',
	'Você criou este grupo',
	'criou este grupo',
	'adicionou',
	'saiu',
	'foi removido',
	'mudou a imagem deste grupo',
	'mudou o assunto',
	'entrou usando o link'
];

/**
 * Date format patterns for WhatsApp exports
 * Different locales use different formats
 */
const DATE_PATTERNS = [
	// MM/DD/YY, HH:MM - US format (12h)
	{
		regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?\s*-\s*/i,
		parse: (match: RegExpMatchArray) => {
			const [, month, day, year, hours, minutes, seconds, ampm] = match;
			return parseDateTime(
				parseInt(day),
				parseInt(month),
				normalizeYear(parseInt(year)),
				parseInt(hours),
				parseInt(minutes),
				seconds ? parseInt(seconds) : 0,
				ampm
			);
		}
	},
	// DD/MM/YY, HH:MM - European format (24h)
	{
		regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*/,
		parse: (match: RegExpMatchArray) => {
			const [, day, month, year, hours, minutes, seconds] = match;
			return parseDateTime(
				parseInt(day),
				parseInt(month),
				normalizeYear(parseInt(year)),
				parseInt(hours),
				parseInt(minutes),
				seconds ? parseInt(seconds) : 0
			);
		}
	},
	// YYYY-MM-DD, HH:MM - ISO format
	{
		regex: /^(\d{4})-(\d{1,2})-(\d{1,2}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*/,
		parse: (match: RegExpMatchArray) => {
			const [, year, month, day, hours, minutes, seconds] = match;
			return parseDateTime(
				parseInt(day),
				parseInt(month),
				parseInt(year),
				parseInt(hours),
				parseInt(minutes),
				seconds ? parseInt(seconds) : 0
			);
		}
	},
	// DD.MM.YY, HH:MM - German format
	{
		regex: /^(\d{1,2})\.(\d{1,2})\.(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*/,
		parse: (match: RegExpMatchArray) => {
			const [, day, month, year, hours, minutes, seconds] = match;
			return parseDateTime(
				parseInt(day),
				parseInt(month),
				normalizeYear(parseInt(year)),
				parseInt(hours),
				parseInt(minutes),
				seconds ? parseInt(seconds) : 0
			);
		}
	},
	// [DD/MM/YY, HH:MM:SS] - Bracketed format
	{
		regex: /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\]\s*/,
		parse: (match: RegExpMatchArray) => {
			const [, day, month, year, hours, minutes, seconds] = match;
			return parseDateTime(
				parseInt(day),
				parseInt(month),
				normalizeYear(parseInt(year)),
				parseInt(hours),
				parseInt(minutes),
				parseInt(seconds)
			);
		}
	}
];

function normalizeYear(year: number): number {
	if (year < 100) {
		return year + (year > 50 ? 1900 : 2000);
	}
	return year;
}

function parseDateTime(
	day: number,
	month: number,
	year: number,
	hours: number,
	minutes: number,
	seconds: number = 0,
	ampm?: string
): Date {
	let adjustedHours = hours;

	if (ampm) {
		const isPM = ampm.toUpperCase() === 'PM';
		if (isPM && hours !== 12) {
			adjustedHours = hours + 12;
		} else if (!isPM && hours === 12) {
			adjustedHours = 0;
		}
	}

	return new Date(year, month - 1, day, adjustedHours, minutes, seconds);
}

function detectMediaType(
	content: string
): 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'contact' | 'location' | undefined {
	const lower = content.toLowerCase();

	if (lower.includes('.jpg') || lower.includes('.png') || lower.includes('.jpeg')) {
		return 'image';
	}
	if (lower.includes('.mp4') || lower.includes('.mov') || lower.includes('video')) {
		return 'video';
	}
	if (lower.includes('.opus') || lower.includes('.mp3') || lower.includes('audio') || lower.includes('ptt-') || lower.includes('aud-')) {
		return 'audio';
	}
	if (lower.includes('.webp') || lower.includes('sticker') || lower.includes('stk-')) {
		return 'sticker';
	}
	if (lower.includes('contact card') || lower.includes('.vcf')) {
		return 'contact';
	}
	if (lower.includes('location:') || lower.includes('live location')) {
		return 'location';
	}
	if (lower.includes('.pdf') || lower.includes('.doc') || lower.includes('.xml') || lower.includes('.svg') || lower.includes('document')) {
		return 'document';
	}

	return undefined;
}

function isMediaMessage(content: string): boolean {
	const lower = content.toLowerCase();
	return MEDIA_INDICATORS.some((indicator) => lower.includes(indicator.toLowerCase()));
}

function isSystemMessage(content: string): boolean {
	const lower = content.toLowerCase();
	return SYSTEM_INDICATORS.some((indicator) => lower.includes(indicator.toLowerCase()));
}

function parseLine(
	line: string
): { timestamp: Date; sender: string; content: string; pattern: RegExp } | null {
	for (const { regex, parse } of DATE_PATTERNS) {
		const match = line.match(regex);
		if (match) {
			const timestamp = parse(match);
			const remainder = line.substring(match[0].length);

			// Try to extract sender and content
			// Format is usually: "Sender Name: message content"
			const colonIndex = remainder.indexOf(':');
			if (colonIndex > 0 && colonIndex < 50) {
				// Reasonable sender name length
				const sender = remainder.substring(0, colonIndex).trim();
				const content = remainder.substring(colonIndex + 1).trim();
				return { timestamp, sender, content, pattern: regex };
			}

			// No sender found - might be a system message
			return { timestamp, sender: '', content: remainder.trim(), pattern: regex };
		}
	}

	return null;
}

function generateId(): string {
	return Math.random().toString(36).substring(2, 11);
}

/**
 * Parse a WhatsApp chat export text content
 */
export function parseChat(content: string, filename: string = 'WhatsApp Chat'): ParsedChat {
	const lines = content.split(/\r?\n/);
	const messages: ChatMessage[] = [];
	const participantsSet = new Set<string>();

	let currentMessage: ChatMessage | null = null;

	for (const line of lines) {
		if (!line.trim()) continue;

		const parsed = parseLine(line);

		if (parsed) {
			// This is a new message
			if (currentMessage) {
				messages.push(currentMessage);
			}

			const isMedia = isMediaMessage(parsed.content);
			const isSystem = !parsed.sender || isSystemMessage(parsed.content);

			currentMessage = {
				id: generateId(),
				timestamp: parsed.timestamp,
				sender: parsed.sender,
				content: parsed.content,
				isSystemMessage: isSystem,
				isMediaMessage: isMedia,
				mediaType: isMedia ? detectMediaType(parsed.content) : undefined,
				rawLine: line
			};

			if (parsed.sender && !isSystem) {
				participantsSet.add(parsed.sender);
			}
		} else if (currentMessage) {
			// This is a continuation of the previous message (multiline)
			currentMessage.content += '\n' + line;
			currentMessage.rawLine += '\n' + line;
		}
	}

	// Don't forget the last message
	if (currentMessage) {
		messages.push(currentMessage);
	}

	const participants = Array.from(participantsSet).sort();
	const mediaCount = messages.filter((m) => m.isMediaMessage).length;

	// Try to extract chat title from filename
	let title = filename
		.replace(/\.txt$/i, '')
		.replace(/^WhatsApp Chat with /i, '')
		.replace(/^WhatsApp Chat - /i, '')
		.replace(/^Conversa do WhatsApp com /i, '')
		.replace(/^Chat do WhatsApp com /i, '')
		.trim();

	// If title is still generic, use participants
	if (title.toLowerCase() === 'whatsapp chat' && participants.length > 0) {
		title = participants.slice(0, 3).join(', ');
		if (participants.length > 3) {
			title += ` +${participants.length - 3}`;
		}
	}

	return {
		messages,
		participants,
		startDate: messages.length > 0 ? messages[0].timestamp : null,
		endDate: messages.length > 0 ? messages[messages.length - 1].timestamp : null,
		title,
		messageCount: messages.length,
		mediaCount
	};
}

/**
 * Group messages by date for display
 */
export function groupMessagesByDate(messages: ChatMessage[]): Map<string, ChatMessage[]> {
	const groups = new Map<string, ChatMessage[]>();

	for (const message of messages) {
		const dateKey = message.timestamp.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});

		const existing = groups.get(dateKey) || [];
		existing.push(message);
		groups.set(dateKey, existing);
	}

	return groups;
}

/**
 * Format timestamp for display
 */
export function formatTime(date: Date): string {
	return date.toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: true
	});
}

/**
 * Get statistics about the chat
 */
export function getChatStats(chat: ParsedChat) {
	const messagesByParticipant = new Map<string, number>();
	const messagesByDate = new Map<string, number>();
	const messagesByHour = new Array(24).fill(0);

	for (const message of chat.messages) {
		if (!message.isSystemMessage) {
			// Count by participant
			const count = messagesByParticipant.get(message.sender) || 0;
			messagesByParticipant.set(message.sender, count + 1);

			// Count by date
			const dateKey = message.timestamp.toISOString().split('T')[0];
			const dateCount = messagesByDate.get(dateKey) || 0;
			messagesByDate.set(dateKey, dateCount + 1);

			// Count by hour
			messagesByHour[message.timestamp.getHours()]++;
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
	const daysDiff = chat.startDate && chat.endDate
		? Math.ceil((chat.endDate.getTime() - chat.startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1
		: 1;
	const avgMessagesPerDay = Math.round(chat.messageCount / daysDiff);

	return {
		messagesByParticipant: Object.fromEntries(messagesByParticipant),
		messagesByDate: Object.fromEntries(messagesByDate),
		messagesByHour,
		mostActiveParticipant,
		mostActiveHour,
		avgMessagesPerDay,
		totalDays: daysDiff
	};
}

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
	mediaType?:
		| 'image'
		| 'video'
		| 'audio'
		| 'document'
		| 'sticker'
		| 'contact'
		| 'location';
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
	'<Media eliminati>',
	'<メディアなし>',
	'<媒体省略>',
	'<미디어 생략>',
	'<Медиа пропущены>',
	'(file attached)',
	'(arquivo anexado)',
	'(fichier joint)',
	'(Datei angehängt)',
	'(archivo adjunto)',
	'(file allegato)',
	'(bestand bijgevoegd)',
	'(ファイル添付)',
	'(附件)',
	'(файл прикреплен)',
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
	'.vcf (arquivo anexado)',
	'.jpg (fichier joint)',
	'.png (fichier joint)',
	'.jpg (Datei angehängt)',
	'.png (Datei angehängt)',
	'.jpg (archivo adjunto)',
	'.png (archivo adjunto)',
];

// System message indicators
const SYSTEM_INDICATORS = [
	// English
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
	'entrou usando o link',
	// Spanish
	'se unió usando el enlace de invitación',
	'creó el grupo',
	'agregó',
	'eliminó',
	'salió',
	'cambió el asunto',
	'cambió la foto del grupo',
	'eliminó la foto del grupo',
	'Los mensajes y las llamadas están cifrados',
	// French
	'a rejoint en utilisant le lien',
	'a créé le groupe',
	'a ajouté',
	'a retiré',
	'a quitté',
	'a modifié le sujet',
	'a changé la photo du groupe',
	'Les messages et les appels sont protégés',
	// German
	'ist über Einladungslink beigetreten',
	'hat die Gruppe erstellt',
	'hinzugefügt',
	'entfernt',
	'hat die Gruppe verlassen',
	'hat den Betreff geändert',
	'hat das Gruppenbild geändert',
	'Nachrichten und Anrufe sind Ende-zu-Ende-verschlüsselt',
	// Italian
	'si è unito tramite link di invito',
	'ha creato il gruppo',
	'ha aggiunto',
	'ha rimosso',
	'ha abbandonato',
	'ha modificato l\'oggetto',
	'ha cambiato l\'immagine del gruppo',
	'I messaggi e le chiamate sono crittografati',
	// Dutch
	'heeft deelgenomen via uitnodigingslink',
	'heeft groep gemaakt',
	'heeft toegevoegd',
	'heeft verwijderd',
	'heeft de groep verlaten',
	'heeft het onderwerp gewijzigd',
	'heeft de groepsfoto gewijzigd',
	'Berichten en oproepen zijn end-to-end versleuteld',
];

/**
 * Date format patterns for WhatsApp exports
 * Different locales use different formats
 *
 * IMPORTANT: The order matters! More specific patterns should come first.
 * US format (with AM/PM) is checked first, then European/Brazilian (24h).
 */
const DATE_PATTERNS = [
	// MM/DD/YY, HH:MM AM/PM - US format (12h) - MUST have AM/PM to be identified as US
	{
		regex:
			/^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)\s*-\s*/i,
		parse: (match: RegExpMatchArray) => {
			const [, month, day, year, hours, minutes, seconds, ampm] = match;
			return parseDateTime(
				parseInt(day, 10),
				parseInt(month, 10),
				normalizeYear(parseInt(year, 10)),
				parseInt(hours, 10),
				parseInt(minutes, 10),
				seconds ? parseInt(seconds, 10) : 0,
				ampm,
			);
		},
	},
	// DD/MM/YY, HH:MM - European/Brazilian format (24h) - No AM/PM means it's not US format
	{
		regex:
			/^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*/,
		parse: (match: RegExpMatchArray) => {
			const [, day, month, year, hours, minutes, seconds] = match;
			return parseDateTime(
				parseInt(day, 10),
				parseInt(month, 10),
				normalizeYear(parseInt(year, 10)),
				parseInt(hours, 10),
				parseInt(minutes, 10),
				seconds ? parseInt(seconds, 10) : 0,
			);
		},
	},
	// YYYY-MM-DD, HH:MM - ISO format
	{
		regex:
			/^(\d{4})-(\d{1,2})-(\d{1,2}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*/,
		parse: (match: RegExpMatchArray) => {
			const [, year, month, day, hours, minutes, seconds] = match;
			return parseDateTime(
				parseInt(day, 10),
				parseInt(month, 10),
				parseInt(year, 10),
				parseInt(hours, 10),
				parseInt(minutes, 10),
				seconds ? parseInt(seconds, 10) : 0,
			);
		},
	},
	// DD.MM.YY, HH:MM - German format
	{
		regex:
			/^(\d{1,2})\.(\d{1,2})\.(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*/,
		parse: (match: RegExpMatchArray) => {
			const [, day, month, year, hours, minutes, seconds] = match;
			return parseDateTime(
				parseInt(day, 10),
				parseInt(month, 10),
				normalizeYear(parseInt(year, 10)),
				parseInt(hours, 10),
				parseInt(minutes, 10),
				seconds ? parseInt(seconds, 10) : 0,
			);
		},
	},
	// DD-MM-YY, HH:MM - Alternative European format with dashes
	{
		regex:
			/^(\d{1,2})-(\d{1,2})-(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*/,
		parse: (match: RegExpMatchArray) => {
			const [, day, month, year, hours, minutes, seconds] = match;
			return parseDateTime(
				parseInt(day, 10),
				parseInt(month, 10),
				normalizeYear(parseInt(year, 10)),
				parseInt(hours, 10),
				parseInt(minutes, 10),
				seconds ? parseInt(seconds, 10) : 0,
			);
		},
	},
	// YYYY/MM/DD, HH:MM - Asian format
	{
		regex:
			/^(\d{4})\/(\d{1,2})\/(\d{1,2}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*/,
		parse: (match: RegExpMatchArray) => {
			const [, year, month, day, hours, minutes, seconds] = match;
			return parseDateTime(
				parseInt(day, 10),
				parseInt(month, 10),
				parseInt(year, 10),
				parseInt(hours, 10),
				parseInt(minutes, 10),
				seconds ? parseInt(seconds, 10) : 0,
			);
		},
	},
	// [DD/MM/YY, HH:MM:SS] - Bracketed format
	{
		regex:
			/^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\]\s*/,
		parse: (match: RegExpMatchArray) => {
			const [, day, month, year, hours, minutes, seconds] = match;
			return parseDateTime(
				parseInt(day, 10),
				parseInt(month, 10),
				normalizeYear(parseInt(year, 10)),
				parseInt(hours, 10),
				parseInt(minutes, 10),
				parseInt(seconds, 10),
			);
		},
	},
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
	ampm?: string,
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
	content: string,
):
	| 'image'
	| 'video'
	| 'audio'
	| 'document'
	| 'sticker'
	| 'contact'
	| 'location'
	| undefined {
	const lower = content.toLowerCase();

	if (
		lower.includes('.jpg') ||
		lower.includes('.png') ||
		lower.includes('.jpeg')
	) {
		return 'image';
	}
	if (
		lower.includes('.mp4') ||
		lower.includes('.mov') ||
		lower.includes('video')
	) {
		return 'video';
	}
	if (
		lower.includes('.opus') ||
		lower.includes('.mp3') ||
		lower.includes('audio') ||
		lower.includes('ptt-') ||
		lower.includes('aud-')
	) {
		return 'audio';
	}
	if (
		lower.includes('.webp') ||
		lower.includes('sticker') ||
		lower.includes('stk-')
	) {
		return 'sticker';
	}
	if (lower.includes('contact card') || lower.includes('.vcf')) {
		return 'contact';
	}
	if (lower.includes('location:') || lower.includes('live location')) {
		return 'location';
	}
	if (
		lower.includes('.pdf') ||
		lower.includes('.doc') ||
		lower.includes('.xml') ||
		lower.includes('.svg') ||
		lower.includes('document')
	) {
		return 'document';
	}

	return undefined;
}

function isMediaMessage(content: string): boolean {
	const lower = content.toLowerCase();
	return MEDIA_INDICATORS.some((indicator) =>
		lower.includes(indicator.toLowerCase()),
	);
}

function isSystemMessage(content: string): boolean {
	const lower = content.toLowerCase();
	return SYSTEM_INDICATORS.some((indicator) =>
		lower.includes(indicator.toLowerCase()),
	);
}

function parseLine(line: string): {
	timestamp: Date;
	sender: string;
	content: string;
	pattern: RegExp;
} | null {
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
			return {
				timestamp,
				sender: '',
				content: remainder.trim(),
				pattern: regex,
			};
		}
	}

	return null;
}

/**
 * Generate a deterministic ID based on message content.
 * This ensures the same message always gets the same ID across parses,
 * which is essential for bookmark navigation to work after import.
 *
 * Uses a collision resolution strategy: if two messages would have the same hash,
 * a counter suffix is added to make them unique while still being deterministic.
 */
function generateDeterministicId(
	timestamp: Date,
	sender: string | null,
	content: string,
	existingIds: Set<string>,
): string {
	// Create a string combining timestamp, sender, and full content
	const baseString = `${timestamp.toISOString()}|${sender ?? ''}|${content}`;

	// Simple hash function (djb2)
	let hash = 5381;
	for (let i = 0; i < baseString.length; i++) {
		hash = ((hash << 5) + hash) ^ baseString.charCodeAt(i);
	}

	// Convert to base36 string and ensure positive
	const id = Math.abs(hash).toString(36);

	// Handle collisions by adding a suffix
	let counter = 0;
	let uniqueId = id;
	while (existingIds.has(uniqueId)) {
		counter++;
		uniqueId = `${id}_${counter}`;
	}

	return uniqueId;
}

/**
 * Parse a WhatsApp chat export text content
 */
export function parseChat(
	content: string,
	filename: string = 'WhatsApp Chat',
): ParsedChat {
	const lines = content.split(/\r?\n/);
	const messages: ChatMessage[] = [];
	const participantsSet = new Set<string>();
	const usedIds = new Set<string>(); // Track used IDs to handle collisions

	let currentMessage: ChatMessage | null = null;

	// Helper to finalize and push current message with deterministic ID
	const pushCurrentMessage = () => {
		if (currentMessage) {
			// Generate deterministic ID based on final content
			currentMessage.id = generateDeterministicId(
				currentMessage.timestamp,
				currentMessage.sender,
				currentMessage.content,
				usedIds,
			);
			usedIds.add(currentMessage.id);
			messages.push(currentMessage);
		}
	};

	for (const line of lines) {
		if (!line.trim()) continue;

		const parsed = parseLine(line);

		if (parsed) {
			// This is a new message - push previous one first
			pushCurrentMessage();

			const isMedia = isMediaMessage(parsed.content);
			const isSystem = !parsed.sender || isSystemMessage(parsed.content);

			currentMessage = {
				id: '', // Will be set when pushed
				timestamp: parsed.timestamp,
				sender: parsed.sender,
				content: parsed.content,
				isSystemMessage: isSystem,
				isMediaMessage: isMedia,
				mediaType: isMedia ? detectMediaType(parsed.content) : undefined,
				rawLine: line,
			};

			if (parsed.sender && !isSystem) {
				participantsSet.add(parsed.sender);
			}
		} else if (currentMessage) {
			// This is a continuation of the previous message (multiline)
			currentMessage.content += `\n${line}`;
			currentMessage.rawLine += `\n${line}`;
		}
	}

	// Don't forget the last message
	pushCurrentMessage();

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
		endDate:
			messages.length > 0 ? messages[messages.length - 1].timestamp : null,
		title,
		messageCount: messages.length,
		mediaCount,
	};
}

/**
 * Group messages by date for display
 */
export function groupMessagesByDate(
	messages: ChatMessage[],
): Map<string, ChatMessage[]> {
	const groups = new Map<string, ChatMessage[]>();

	for (const message of messages) {
		const dateKey = message.timestamp.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});

		const existing = groups.get(dateKey) || [];
		existing.push(message);
		groups.set(dateKey, existing);
	}

	return groups;
}

/**
 * Format timestamp for display (full date and time)
 */
export function formatTime(date: Date): string {
	return date.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: true,
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
	const daysDiff =
		chat.startDate && chat.endDate
			? Math.ceil(
					(chat.endDate.getTime() - chat.startDate.getTime()) /
						(1000 * 60 * 60 * 24),
				) || 1
			: 1;
	const avgMessagesPerDay = Math.round(chat.messageCount / daysDiff);

	return {
		messagesByParticipant: Object.fromEntries(messagesByParticipant),
		messagesByDate: Object.fromEntries(messagesByDate),
		messagesByHour,
		mostActiveParticipant,
		mostActiveHour,
		avgMessagesPerDay,
		totalDays: daysDiff,
	};
}

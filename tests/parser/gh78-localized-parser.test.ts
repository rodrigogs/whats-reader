import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { parseChat } from '../../src/lib/parser/chat-parser.ts';
import { parseZipFile } from '../../src/lib/parser/zip-parser.ts';

const OPUS_FILENAME = '00000004-AUDIO-2026-06-26-20-31-14.opus';

// Exact original lines from the GH-78 fixtures (Unicode escapes keep the
// invisible characters explicit so rawLine preservation is verifiable).
const IOS_GERMAN_LINES = [
	'[26.06.26, 15:30:00] Alex: Hallo! Wie geht es dir?',
	'[26.06.26, 3:00:00 PM] Sara: Mir geht es gut, danke!',
	'[27.06.26, 9:15:00\u202fAM] Alex: Bis später!',
	'\u200e[27.06.26, 10:30:00\u00a0PM] Sara: Gute Nacht!',
];

const ANDROID_SPANISH_LINES = [
	'28/3/2025 9:29 p. m. - Sara: Hola, ¿cómo estás?',
	'29/3/2025 8:05 a. m. - Alex: Muy bien, gracias',
	'29/3/2025 12:30 p. m. - Sara: Nos vemos luego',
	'30/3/2025 12:05 a. m. - Alex: Buenas noches',
];

function chatLine(content: string, timestamp = '[26/06/2026, 3:00:00 PM]'): string {
	return `${timestamp} Alex: ${content}`;
}

function assertTimestamp(
	date: Date,
	year: number,
	month: number,
	day: number,
	hours: number,
	minutes: number,
	seconds = 0,
) {
	assert.equal(date.getFullYear(), year);
	assert.equal(date.getMonth(), month - 1);
	assert.equal(date.getDate(), day);
	assert.equal(date.getHours(), hours);
	assert.equal(date.getMinutes(), minutes);
	assert.equal(date.getSeconds(), seconds);
}

function fixturePath(name: string): string {
	return join(process.cwd(), 'examples/parser-tests', name);
}

async function readFixture(name: string): Promise<string> {
	return readFile(fixturePath(name), 'utf8');
}

async function parseZipWithChat(chatContent: string) {
	const zip = new JSZip();
	zip.file('_chat.txt', chatContent);
	zip.file(OPUS_FILENAME, new Uint8Array([0, 1, 2, 3]));
	const buffer = await zip.generateAsync({ type: 'arraybuffer' });
	return parseZipFile(buffer);
}

function assertAudioMessageShape(parsed: Awaited<ReturnType<typeof parseZipFile>>) {
	assert.equal(parsed.mediaCount, 1);
	assert.equal(parsed.hasMedia, true);
	assert.equal(parsed.mediaFiles.length, 1);

	const [message] = parsed.messages;
	const [media] = parsed.mediaFiles;
	assert.equal(message.isMediaMessage, true);
	assert.equal(message.mediaType, 'audio');
	assert.equal(media.name, OPUS_FILENAME);
	assert.equal(media.type, 'audio');
	assert.equal(media.messageId, message.id);
	assert.equal(media.messageTimestamp, message.timestamp.toISOString());
	assert.equal(media.messageSender, 'Alex');

	const messageWithMedia = message as typeof message & { mediaFile?: typeof media };
	assert.equal(messageWithMedia.mediaFile, media);
	assert.equal(messageWithMedia.mediaFile?.type, 'audio');
	assert.ok(messageWithMedia.mediaFile?._zipEntry);
}

describe('GH-78 localized WhatsApp exports', () => {
	describe('iOS German bracketed dd.MM.yy', () => {
		it('parses 24h timestamps', () => {
			const parsed = parseChat(IOS_GERMAN_LINES[0]);

			assert.equal(parsed.messageCount, 1);
			const [message] = parsed.messages;
			assertTimestamp(message.timestamp, 2026, 6, 26, 15, 30, 0);
			assert.equal(message.sender, 'Alex');
			assert.equal(message.content, 'Hallo! Wie geht es dir?');
		});

		it('parses 12h PM timestamps', () => {
			const parsed = parseChat(IOS_GERMAN_LINES[1]);

			assert.equal(parsed.messageCount, 1);
			const [message] = parsed.messages;
			assertTimestamp(message.timestamp, 2026, 6, 26, 15, 0, 0);
			assert.equal(message.sender, 'Sara');
		});

		it('accepts NNBSP (U+202F) and NBSP (U+00A0) before AM/PM', () => {
			const parsed = parseChat([IOS_GERMAN_LINES[2], IOS_GERMAN_LINES[3]].join('\n'));

			assert.equal(parsed.messageCount, 2);
			const [morning, night] = parsed.messages;
			assertTimestamp(morning.timestamp, 2026, 6, 27, 9, 15, 0);
			assertTimestamp(night.timestamp, 2026, 6, 27, 22, 30, 0);
		});

		it('strips invisible Unicode prefixes for recognition but preserves rawLine', () => {
			const parsed = parseChat(IOS_GERMAN_LINES[3]);

			assert.equal(parsed.messageCount, 1);
			const [message] = parsed.messages;
			assertTimestamp(message.timestamp, 2026, 6, 27, 22, 30, 0);
			assert.equal(message.content, 'Gute Nacht!');
			assert.equal(message.rawLine, IOS_GERMAN_LINES[3]);
			assert.ok(message.rawLine.startsWith('\u200e'));
		});

		it('parses the full anonymized fixture preserving rawLine and content', async () => {
			const parsed = parseChat(await readFixture('gh78-ios-german-dot-ampm-unicode-test.txt'));

			assert.equal(parsed.messageCount, IOS_GERMAN_LINES.length);
			parsed.messages.forEach((message, index) => {
				assert.equal(message.rawLine, IOS_GERMAN_LINES[index]);
			});
			assertTimestamp(parsed.messages[0].timestamp, 2026, 6, 26, 15, 30, 0);
			assertTimestamp(parsed.messages[1].timestamp, 2026, 6, 26, 15, 0, 0);
			assertTimestamp(parsed.messages[2].timestamp, 2026, 6, 27, 9, 15, 0);
			assertTimestamp(parsed.messages[3].timestamp, 2026, 6, 27, 22, 30, 0);
			assert.equal(parsed.messages[3].content, 'Gute Nacht!');
			assert.equal(parsed.messages[2].sender, 'Alex');
			assert.equal(parsed.messages[3].sender, 'Sara');
		});
	});

	describe('Android Spanish day-first with localized AM/PM', () => {
		it('parses p. m. as PM (evening)', () => {
			const parsed = parseChat(ANDROID_SPANISH_LINES[0]);

			assert.equal(parsed.messageCount, 1);
			const [message] = parsed.messages;
			assertTimestamp(message.timestamp, 2025, 3, 28, 21, 29, 0);
			assert.equal(message.sender, 'Sara');
			assert.equal(message.content, 'Hola, ¿cómo estás?');
		});

		it('parses a. m. as AM (morning)', () => {
			const parsed = parseChat(ANDROID_SPANISH_LINES[1]);

			assert.equal(parsed.messageCount, 1);
			const [message] = parsed.messages;
			assertTimestamp(message.timestamp, 2025, 3, 29, 8, 5, 0);
		});

		it('keeps 12:30 p. m. as noon and 12:05 a. m. as midnight', () => {
			const parsed = parseChat([ANDROID_SPANISH_LINES[2], ANDROID_SPANISH_LINES[3]].join('\n'));

			assert.equal(parsed.messageCount, 2);
			assertTimestamp(parsed.messages[0].timestamp, 2025, 3, 29, 12, 30, 0);
			assertTimestamp(parsed.messages[1].timestamp, 2025, 3, 30, 0, 5, 0);
		});

		it('parses the full anonymized fixture preserving rawLine', async () => {
			const parsed = parseChat(await readFixture('gh78-android-spanish-localized-ampm-test.txt'));

			assert.equal(parsed.messageCount, ANDROID_SPANISH_LINES.length);
			parsed.messages.forEach((message, index) => {
				assert.equal(message.rawLine, ANDROID_SPANISH_LINES[index]);
			});
			assertTimestamp(parsed.messages[0].timestamp, 2025, 3, 28, 21, 29, 0);
			assertTimestamp(parsed.messages[3].timestamp, 2025, 3, 30, 0, 5, 0);
		});
	});

	describe('US vs day-first discrimination', () => {
		it('keeps US MM/DD priority when both interpretations are valid', () => {
			const parsed = parseChat('03/04/24 9:30 PM - John: hey');

			assert.equal(parsed.messageCount, 1);
			assertTimestamp(parsed.messages[0].timestamp, 2024, 3, 4, 21, 30, 0);
		});

		it('falls back to day-first when the US interpretation is invalid', () => {
			const parsed = parseChat('13/12/24 3:00 PM - John: hey');

			assert.equal(parsed.messageCount, 1);
			assertTimestamp(parsed.messages[0].timestamp, 2024, 12, 13, 15, 0, 0);
		});

		it('parses existing European AM/PM variants without rollover', () => {
			const lines = [
				'23/06/2018, 1:55 p.m. - Loris: one',
				'23/06/2018, 1:56 p. m. - Luke: two',
				'23/06/2018, 1:57 PM - Loris: three',
				'23/06/2018, 1:58 am - Luke: four',
			];
			const parsed = parseChat(lines.join('\n'));

			assert.equal(parsed.messageCount, 4);
			assertTimestamp(parsed.messages[0].timestamp, 2018, 6, 23, 13, 55, 0);
			assertTimestamp(parsed.messages[1].timestamp, 2018, 6, 23, 13, 56, 0);
			assertTimestamp(parsed.messages[2].timestamp, 2018, 6, 23, 13, 57, 0);
			assertTimestamp(parsed.messages[3].timestamp, 2018, 6, 23, 1, 58, 0);
		});
	});

	describe('date validation prevents invalid rollover', () => {
		const invalidLines = [
			'32/13/99, 10:30 - John: invalid day and month',
			'29/02/23, 10:30 - John: Feb 29 in a non-leap year',
			'31/04/2024, 10:30 - John: April 31',
			'25/04/24, 25:30 - John: hour 25',
			'[29/02/2023, 3:00:00 PM] John: bracketed non-leap Feb 29',
			'[25/04/24, 13:99:00 PM] John: invalid minutes',
		];

		for (const line of invalidLines) {
			it(`rejects "${line.split(',')[0].trim()}" without creating a rolled-over message`, () => {
				const parsed = parseChat(line);

				assert.equal(parsed.messageCount, 0);
			});
		}

		it('accepts Feb 29 in a leap year', () => {
			const parsed = parseChat('29/02/2024, 10:30 - John: leap day');

			assert.equal(parsed.messageCount, 1);
			assertTimestamp(parsed.messages[0].timestamp, 2024, 2, 29, 10, 30, 0);
		});

		it('does not corrupt surrounding messages when a line has an invalid date', () => {
			const parsed = parseChat(
				'[26/06/2026, 3:00:00 PM] Alex: first\n32/13/99, 10:30 - John: bogus\n[26/06/2026, 3:01:00 PM] Sara: third',
			);

			assert.equal(parsed.messageCount, 2);
			assert.equal(parsed.messages[0].content, 'first\n32/13/99, 10:30 - John: bogus');
			assertTimestamp(parsed.messages[0].timestamp, 2026, 6, 26, 15, 0, 0);
			assert.equal(parsed.messages[1].content, 'third');
			assertTimestamp(parsed.messages[1].timestamp, 2026, 6, 26, 15, 1, 0);
		});
	});

	describe('localized media markers and ZIP association', () => {
		it('detects the Spanish iOS marker <adjunto: ...opus> as audio media', () => {
			const parsed = parseChat(chatLine(`<adjunto: ${OPUS_FILENAME}>`));

			assert.equal(parsed.mediaCount, 1);
			const [message] = parsed.messages;
			assert.equal(message.isMediaMessage, true);
			assert.equal(message.mediaType, 'audio');
		});

		it('associates a localized-marked OPUS with the sibling file in a ZIP', async () => {
			const parsed = await parseZipWithChat(chatLine(`<adjunto: ${OPUS_FILENAME}>`));

			assertAudioMessageShape(parsed);
		});

		it('detects German bracketed dot timestamps in a chat file without .txt extension', async () => {
			// Exercises looksLikeChatContent: the entry is named like a chat
			// file but has no .txt extension, so the heuristic must recognize
			// the bracketed dd.MM.yy timestamps (with an invisible prefix).
			const zip = new JSZip();
			zip.file(
				'_chat',
				IOS_GERMAN_LINES.slice(0, 3).join('\n'),
			);
			zip.file(OPUS_FILENAME, new Uint8Array([0, 1, 2, 3]));
			const buffer = await zip.generateAsync({ type: 'arraybuffer' });
			const parsed = await parseZipFile(buffer);

			assert.equal(parsed.messageCount, 3);
			assertTimestamp(parsed.messages[2].timestamp, 2026, 6, 27, 9, 15, 0);
		});

		it('parses the anonymized localized media fixture', async () => {
			const parsed = parseChat(await readFixture('gh78-ios-localized-attached-media-test.txt'));

			assert.equal(parsed.messageCount, 2);
			assert.equal(parsed.mediaCount, 1);
			const [media, plain] = parsed.messages;
			assert.equal(media.isMediaMessage, true);
			assert.equal(media.mediaType, 'audio');
			assert.equal(plain.isMediaMessage, false);
			assert.equal(plain.content, '¡Qué buena canción!');
		});
	});

	describe('existing formats keep working', () => {
		const cases: Array<[string, number, number, number, number, number]> = [
			// US AM/PM
			['12/25/24, 2:30 PM - John: hi', 2024, 12, 25, 14, 30],
			// European/Brazilian 24h
			['25/12/24, 14:30 - John: hi', 2024, 12, 25, 14, 30],
			// ISO
			['2024-12-25, 14:30 - John: hi', 2024, 12, 25, 14, 30],
			// German dot 24h
			['25.12.24, 14:30 - John: hi', 2024, 12, 25, 14, 30],
			// Dash
			['25-12-24, 14:30 - John: hi', 2024, 12, 25, 14, 30],
			// Asian 24h
			['2024/12/25, 14:30 - John: hi', 2024, 12, 25, 14, 30],
			// Asian 12h (lowercase pm, issue #69)
			['2024/12/25, 2:30 pm - John: hi', 2024, 12, 25, 14, 30],
			// Bracketed 24h
			['[25/12/24, 14:30:00] John: hi', 2024, 12, 25, 14, 30],
			// Bracketed 12h (iOS)
			['[25/12/24, 2:30:00 PM] John: hi', 2024, 12, 25, 14, 30],
			// Bracketed 12h with 4-digit year (iOS)
			['[25/12/2024, 2:30:00 PM] John: hi', 2024, 12, 25, 14, 30],
		];

		for (const [line, year, month, day, hours, minutes] of cases) {
			it(`parses ${JSON.stringify(line)}`, () => {
				const parsed = parseChat(line);

				assert.equal(parsed.messageCount, 1);
				assertTimestamp(parsed.messages[0].timestamp, year, month, day, hours, minutes, 0);
				assert.equal(parsed.messages[0].sender, 'John');
				assert.equal(parsed.messages[0].content, 'hi');
				assert.equal(parsed.messages[0].rawLine, line);
			});
		}
	});
});

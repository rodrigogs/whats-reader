import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { parseChat } from '../../src/lib/parser/chat-parser.ts';
import { parseZipFile } from '../../src/lib/parser/zip-parser.ts';

const OPUS_FILENAME = '00000004-AUDIO-2026-06-26-20-31-14.opus';
const IOS_TIMESTAMP = '[26/06/2026, 3:00:00 PM]';

function chatLine(content: string): string {
	return `${IOS_TIMESTAMP} Alex: ${content}`;
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

describe('GH-87 iOS inline OPUS media markers', () => {
	it('marks inline English OPUS attachments as audio media', () => {
		const parsed = parseChat(chatLine(`<attached: ${OPUS_FILENAME}>`));

		assert.equal(parsed.mediaCount, 1);
		const [message] = parsed.messages;
		assert.equal(message.isMediaMessage, true);
		assert.equal(message.mediaType, 'audio');
	});

	it('supports inline Spanish OPUS attachments', () => {
		const parsed = parseChat(chatLine(`<adjunto: ${OPUS_FILENAME}>`));

		assert.equal(parsed.mediaCount, 1);
		const [message] = parsed.messages;
		assert.equal(message.isMediaMessage, true);
		assert.equal(message.mediaType, 'audio');
	});

	it('keeps bare OPUS filenames without a media marker as non-media', () => {
		const parsed = parseChat(chatLine(`Please check this file: ${OPUS_FILENAME}`));

		assert.equal(parsed.mediaCount, 0);
		const [message] = parsed.messages;
		assert.equal(message.isMediaMessage, false);
		assert.equal(message.mediaType, undefined);
	});

	it('links an inline marker to the sibling OPUS file in a canonical ZIP fixture', async () => {
		const fixturePath = join(
			process.cwd(),
			'examples/parser-tests/gh87-ios-inline-opus-repro.zip',
		);
		const fileBuffer = await readFile(fixturePath);
		const arrayBuffer = fileBuffer.buffer.slice(
			fileBuffer.byteOffset,
			fileBuffer.byteOffset + fileBuffer.byteLength,
		);
		const parsed = await parseZipFile(arrayBuffer);

		assertAudioMessageShape(parsed);
	});

	it('strips invisible Unicode (U+200E) before the filename when associating media', async () => {
		const parsed = await parseZipWithChat(
			chatLine(`<attached: \u200e${OPUS_FILENAME}>`),
		);

		assertAudioMessageShape(parsed);
	});

	it('normalizes decomposed NFD localized markers like their NFC counterparts', async () => {
		// French iOS marker with the accent decomposed (e + U+0300) instead of precomposed è
		const nfdMarker = '<pie\u0300ce jointe:';
		const parsed = await parseZipWithChat(
			chatLine(`${nfdMarker} ${OPUS_FILENAME}>`),
		);

		assertAudioMessageShape(parsed);
	});
});

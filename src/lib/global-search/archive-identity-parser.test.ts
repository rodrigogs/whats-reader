import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import { parseZipFile } from '$lib/parser';

async function createChatExport(): Promise<ArrayBuffer> {
	const zip = new JSZip();
	zip.file(
		'WhatsApp Chat with Family Group.txt',
		'1/1/24, 10:00 - Ana: First message\n1/1/24, 10:01 - Bruno: Second message',
	);
	return zip.generateAsync({ type: 'arraybuffer' });
}

describe('ZIP parser archive runtime identity', () => {
	it('assigns a distinct opaque session archive ID to each parsed import', async () => {
		const log = vi.spyOn(console, 'log');
		const warn = vi.spyOn(console, 'warn');
		const error = vi.spyOn(console, 'error');
		const [first, second] = await Promise.all([
			parseZipFile(await createChatExport()),
			parseZipFile(await createChatExport()),
		]);

		expect(first.title).toBe(second.title);
		expect(first.archiveId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
		expect(second.archiveId).not.toBe(first.archiveId);
		expect(log).not.toHaveBeenCalled();
		expect(warn).not.toHaveBeenCalled();
		expect(error).not.toHaveBeenCalled();
	});

	it('preserves the supplied persisted archive ID', async () => {
		const persistedArchiveId = '0a4ad7d6-dc8a-4d4f-b0bf-94889d82806b';
		const parsed = await parseZipFile(
			await createChatExport(),
			undefined,
			persistedArchiveId,
		);

		expect(parsed.archiveId).toBe(persistedArchiveId);
	});
});

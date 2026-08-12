import { describe, expect, it } from 'vitest';
import {
	type ArchiveId,
	createArchiveMessageKey,
	createSessionArchiveId,
} from './archive-identity';

describe('GH-67 archive runtime identity contract', () => {
	it('creates an opaque session archive ID and pairs every message identity with it', () => {
		const archiveId = createSessionArchiveId();
		const key = createArchiveMessageKey(
			archiveId,
			7,
			'message-id-shared-across-chats',
		);

		expect(archiveId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
		expect(archiveId as ArchiveId).not.toContain('Family Group');
		expect(key).toEqual({
			archiveId,
			ordinal: 7,
			messageId: 'message-id-shared-across-chats',
		});
	});
});

export type ArchiveId = string;

export type ArchiveMessageKey = {
	archiveId: ArchiveId;
	ordinal: number;
	messageId: string;
};

export function createSessionArchiveId(): ArchiveId {
	return crypto.randomUUID();
}

export function createArchiveMessageKey(
	archiveId: ArchiveId,
	ordinal: number,
	messageId: string,
): ArchiveMessageKey {
	return { archiveId, ordinal, messageId };
}

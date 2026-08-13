export interface ArchiveAddressable {
	archiveId: string;
}

/** Resolve a loaded archive by canonical identity, never by display title. */
export function findArchiveIndex(
	archives: readonly ArchiveAddressable[],
	archiveId: string,
): number {
	return archives.findIndex((archive) => archive.archiveId === archiveId);
}

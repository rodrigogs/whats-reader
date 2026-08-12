/**
 * Runtime/UI page state keyed by archive identity.
 *
 * Chat titles are user-facing and non-unique — two distinct archives can share
 * the same title. Every per-archive runtime value (transcription language,
 * viewing perspective, auto-load media preference, the "remembered" flag, and
 * the file reference used for persistence) must therefore be stored and looked
 * up exclusively by `archiveId`, never by title.
 *
 * MUTATION GUARD (RED): re-keying any of these maps on `chat.title` instead of
 * `archiveId` collides for equal-titled archives and makes the behavioural test
 * in `archive-identity-state.test.svelte.ts` fail.
 */

export interface ArchiveFileReference {
	file: File | null;
	filePath?: string;
	fileHandle?: FileSystemFileHandle;
	persistedId?: string;
}

export interface ArchivePageState {
	getLanguage(archiveId: string): string;
	setLanguage(archiveId: string, language: string): void;
	getPerspective(archiveId: string): string | null;
	setPerspective(archiveId: string, perspective: string | null): void;
	getAutoLoadMedia(archiveId: string): boolean;
	setAutoLoadMedia(archiveId: string, enabled: boolean): void;
	isRemembered(archiveId: string): boolean;
	addRemembered(archiveId: string): void;
	removeRemembered(archiveId: string): void;
	getFileReference(archiveId: string): ArchiveFileReference | undefined;
	setFileReference(archiveId: string, reference: ArchiveFileReference): void;
	removeFileReference(archiveId: string): void;
	/** Drop every per-archive value for one archive, leaving others intact. */
	removeArchive(archiveId: string): void;

	// Raw reactive collections, exposed read-only for components that consume
	// the maps/set directly (e.g. ChatList props).
	readonly languageByArchive: Map<string, string>;
	readonly perspectiveByArchive: Map<string, string | null>;
	readonly autoLoadMediaByArchive: Map<string, boolean>;
	readonly rememberedArchiveIds: Set<string>;
	readonly fileReferencesByArchive: Map<string, ArchiveFileReference>;
}

const DEFAULT_LANGUAGE = 'portuguese';

export function createArchivePageState(): ArchivePageState {
	let languageByArchive = $state<Map<string, string>>(new Map());
	let perspectiveByArchive = $state<Map<string, string | null>>(new Map());
	let autoLoadMediaByArchive = $state<Map<string, boolean>>(new Map());
	let rememberedArchiveIds = $state<Set<string>>(new Set());
	let fileReferencesByArchive = $state<Map<string, ArchiveFileReference>>(
		new Map(),
	);

	function getLanguage(archiveId: string): string {
		return languageByArchive.get(archiveId) ?? DEFAULT_LANGUAGE;
	}

	function setLanguage(archiveId: string, language: string): void {
		languageByArchive.set(archiveId, language);
		languageByArchive = new Map(languageByArchive);
	}

	function getPerspective(archiveId: string): string | null {
		return perspectiveByArchive.get(archiveId) ?? null;
	}

	function setPerspective(archiveId: string, perspective: string | null): void {
		perspectiveByArchive.set(archiveId, perspective);
		perspectiveByArchive = new Map(perspectiveByArchive);
	}

	function getAutoLoadMedia(archiveId: string): boolean {
		return autoLoadMediaByArchive.get(archiveId) ?? false;
	}

	function setAutoLoadMedia(archiveId: string, enabled: boolean): void {
		autoLoadMediaByArchive.set(archiveId, enabled);
		autoLoadMediaByArchive = new Map(autoLoadMediaByArchive);
	}

	function isRemembered(archiveId: string): boolean {
		return rememberedArchiveIds.has(archiveId);
	}

	function addRemembered(archiveId: string): void {
		rememberedArchiveIds.add(archiveId);
		rememberedArchiveIds = new Set(rememberedArchiveIds);
	}

	function removeRemembered(archiveId: string): void {
		rememberedArchiveIds.delete(archiveId);
		rememberedArchiveIds = new Set(rememberedArchiveIds);
	}

	function getFileReference(
		archiveId: string,
	): ArchiveFileReference | undefined {
		return fileReferencesByArchive.get(archiveId);
	}

	function setFileReference(
		archiveId: string,
		reference: ArchiveFileReference,
	): void {
		fileReferencesByArchive.set(archiveId, reference);
		fileReferencesByArchive = new Map(fileReferencesByArchive);
	}

	function removeFileReference(archiveId: string): void {
		fileReferencesByArchive.delete(archiveId);
		fileReferencesByArchive = new Map(fileReferencesByArchive);
	}

	function removeArchive(archiveId: string): void {
		languageByArchive.delete(archiveId);
		languageByArchive = new Map(languageByArchive);

		perspectiveByArchive.delete(archiveId);
		perspectiveByArchive = new Map(perspectiveByArchive);

		autoLoadMediaByArchive.delete(archiveId);
		autoLoadMediaByArchive = new Map(autoLoadMediaByArchive);

		rememberedArchiveIds.delete(archiveId);
		rememberedArchiveIds = new Set(rememberedArchiveIds);

		fileReferencesByArchive.delete(archiveId);
		fileReferencesByArchive = new Map(fileReferencesByArchive);
	}

	return {
		get languageByArchive() {
			return languageByArchive;
		},
		get perspectiveByArchive() {
			return perspectiveByArchive;
		},
		get autoLoadMediaByArchive() {
			return autoLoadMediaByArchive;
		},
		get rememberedArchiveIds() {
			return rememberedArchiveIds;
		},
		get fileReferencesByArchive() {
			return fileReferencesByArchive;
		},
		getLanguage,
		setLanguage,
		getPerspective,
		setPerspective,
		getAutoLoadMedia,
		setAutoLoadMedia,
		isRemembered,
		addRemembered,
		removeRemembered,
		getFileReference,
		setFileReference,
		removeFileReference,
		removeArchive,
	};
}

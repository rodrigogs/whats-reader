/**
 * GH-67 §5/§10.6 — ONE unified "Remover da biblioteca" cascade.
 *
 * Spec §5: "Remover da biblioteca apaga o metadado, a referência de arquivo e
 * todo índice global daquele `archiveId`; requer confirmação." Both surfaces
 * that remove an archive from the library — the sidebar remember-toggle-off
 * ("forget") and the global-search panel's remove-from-library — must run the
 * SAME full cascade. Before this module each surface ran half of it:
 *
 *  - the sidebar forget path deleted `whatsapp-persisted-chat-{id}` (and its
 *    file handle) but orphaned every global-search key (shards, manifest,
 *    commit pointer, consent) in IndexedDB;
 *  - the panel remove-from-library deleted the global-search keys but left the
 *    persisted metadata and file handle behind.
 *
 * This module composes the two halves into one cascade with a §5 readback:
 * after deletion it re-reads storage and requires that nothing remains for
 * that archiveId in either namespace. A survivor is reported fail-closed
 * (`complete: false`), never silently swallowed.
 *
 * Session-only / no-consent archives cascade as a persistence no-op (there is
 * nothing to delete for them) while the caller still clears in-session state.
 * When the feature gate is false the global-search half stays a no-op —
 * exactly the behaviour `removeArchiveIndex` already implements.
 */

import { type RemovalReadback, removeArchiveIndex } from './removal';
import type { GlobalSearchStorage } from './storage';

/** Metadata adapter over the persisted-chat namespace (injected for tests). */
export type PersistedChatRemovalStore = {
	/** Read the persisted metadata record for an archiveId (undefined if gone). */
	getPersistedChatMetadata(archiveId: string): Promise<
		| {
				fileReference:
					| { type: 'file-handle'; handleId: string }
					| { type: 'electron-path'; filePath: string }
					| { type: 'reselect-required' };
		  }
		| undefined
	>;
	/** Delete the `whatsapp-persisted-chat-{archiveId}` record. */
	deletePersistedChat(archiveId: string): Promise<void>;
	/** Delete the `whatsapp-file-handle-{handleId}` record. */
	deleteFileHandle(handleId: string): Promise<void>;
	/**
	 * §5 readback probe: does the `whatsapp-file-handle-{handleId}` record
	 * still exist? Returns undefined exactly like an idb `get` of a missing
	 * key; the cascade treats any defined value as a survivor.
	 */
	getFileHandle(handleId: string): Promise<unknown>;
};

export type PersistedRemovalReadback = {
	/** Whether a metadata record existed before the cascade ran. */
	metadataExisted: boolean;
	/** Whether a `file-handle` reference was found and its handle deleted. */
	removedFileHandle: boolean;
	/** Readback: 1 when the metadata record survived the delete, else 0. */
	metadataRemaining: 0 | 1;
	/** Readback: 1 when the file-handle record survived, else 0. */
	fileHandleRemaining: 0 | 1;
	complete: boolean;
	/** Enumerated error code; never message text (privacy). */
	errorCode?:
		| 'metadata-delete-failed'
		| 'file-handle-delete-failed'
		| 'readback-failed';
};

/**
 * A store that always reports "nothing persisted" — the correct default when a
 * caller wires no persisted-chat backend (session-only archives). Every read
 * returns undefined and every delete is a no-op, so the cascade reports a
 * clean, complete removal without ever touching a storage namespace it does
 * not own.
 */
export function createNoopPersistedChatRemovalStore(): PersistedChatRemovalStore {
	return {
		async getPersistedChatMetadata() {
			return undefined;
		},
		async deletePersistedChat() {},
		async deleteFileHandle() {},
		async getFileHandle() {
			return undefined;
		},
	};
}

/**
 * Step 1 of the cascade — persisted metadata + file-handle reference — with a
 * readback that fails closed. Deleting the metadata before the handle mirrors
 * `removePersistedChat`: a crash between the two leaves a handle the next
 * save/restore can overwrite, never user data loss.
 */
export async function createVerifiedPersistedChatRemoval(
	archiveId: string,
	store: PersistedChatRemovalStore,
): Promise<PersistedRemovalReadback> {
	const metadata = await store.getPersistedChatMetadata(archiveId);
	const metadataExisted = metadata !== undefined;
	const handleId =
		metadata?.fileReference.type === 'file-handle'
			? metadata.fileReference.handleId
			: null;

	let errorCode: PersistedRemovalReadback['errorCode'];
	let removedFileHandle = false;

	try {
		if (metadataExisted) {
			await store.deletePersistedChat(archiveId);
		}
	} catch {
		errorCode = 'metadata-delete-failed';
	}

	if (handleId !== null) {
		try {
			await store.deleteFileHandle(handleId);
			removedFileHandle = true;
		} catch {
			errorCode ??= 'file-handle-delete-failed';
		}
	}

	// §5 readback: re-read the namespace; survivors mean incomplete.
	const survivor = await store.getPersistedChatMetadata(archiveId);
	const metadataRemaining: 0 | 1 = survivor !== undefined ? 1 : 0;
	const fileHandleRemaining: 0 | 1 =
		handleId !== null && (await store.getFileHandle(handleId)) !== undefined
			? 1
			: 0;

	const readbackOk = metadataRemaining === 0 && fileHandleRemaining === 0;
	if (!readbackOk) {
		errorCode ??= 'readback-failed';
	}

	return {
		metadataExisted,
		removedFileHandle,
		metadataRemaining,
		fileHandleRemaining,
		complete: errorCode === undefined,
		errorCode,
	};
}

export type LibraryRemovalReadback = {
	archiveId: string;
	/** Persisted metadata + file-handle half. */
	persisted: PersistedRemovalReadback;
	/** Global-search namespace half (shards/manifest/commit/consent). */
	globalSearch: RemovalReadback;
	complete: boolean;
};

/**
 * The ONE cascade every "remove from library" path must run (§5):
 *
 *  1. delete the persisted chat metadata and its file-handle reference
 *     (verified by readback, fail-closed);
 *  2. delete ALL global-search persistence for the archiveId — shards,
 *     staging, manifest, commit pointer, consent — with its own readback;
 *  3. combined `complete` requires both halves to verify clean.
 *
 * The caller owns the confirmation dialog (see `removal-confirmation.ts`) and
 * the in-session state cleanup (unloading the chat, remembered flags). The
 * global-search half is a no-op when the gate is false.
 */
export async function removeFromLibraryCascade(
	archiveId: string,
	store: PersistedChatRemovalStore,
	storage: GlobalSearchStorage,
	gate: boolean,
): Promise<LibraryRemovalReadback> {
	const persisted = await createVerifiedPersistedChatRemoval(archiveId, store);
	const globalSearch = await removeArchiveIndex(storage, archiveId, gate);
	return {
		archiveId,
		persisted,
		globalSearch,
		complete: persisted.complete && globalSearch.complete,
	};
}

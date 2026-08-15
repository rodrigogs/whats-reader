/**
 * GH-67 §5 — idb-keyval adapter for the persisted-chat half of the unified
 * "Remover da biblioteca" cascade.
 *
 * The cascade (`removeFromLibraryCascade`) talks to the persisted-chat
 * namespace through `PersistedChatRemovalStore` so the logic is testable
 * without idb-keyval. This module is the production adapter: it reads/deletes
 * exactly the two keys the legacy `removePersistedChat` path used —
 * `whatsapp-persisted-chat-{archiveId}` and `whatsapp-file-handle-{handleId}` —
 * and nothing else.
 */

import { del, get } from 'idb-keyval';
import type { PersistedChatMetadata } from '../persistence.svelte';
import type { PersistedChatRemovalStore } from './library-removal';

const PERSISTENCE_PREFIX = 'whatsapp-persisted-chat-';
const HANDLE_PREFIX = 'whatsapp-file-handle-';

/**
 * Production adapter over idb-keyval. `getPersistedChatMetadata` returns only
 * the metadata record (which carries `fileReference`); the cascade uses that to
 * find the handle id to delete and to drive the §5 readback.
 */
export const idbPersistedChatRemovalStore: PersistedChatRemovalStore = {
	async getPersistedChatMetadata(archiveId) {
		return (
			(await get<PersistedChatMetadata>(`${PERSISTENCE_PREFIX}${archiveId}`)) ??
			undefined
		);
	},
	async deletePersistedChat(archiveId) {
		await del(`${PERSISTENCE_PREFIX}${archiveId}`);
	},
	async deleteFileHandle(handleId) {
		await del(`${HANDLE_PREFIX}${handleId}`);
	},
	async getFileHandle(handleId) {
		return (await get(`${HANDLE_PREFIX}${handleId}`)) ?? undefined;
	},
};

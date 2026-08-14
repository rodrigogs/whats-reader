/**
 * GH-67 §5 — Versioned opt-in consent for persisted global search.
 *
 * Consent is per archiveId, explicit and versioned. Without a valid consent
 * record the lifecycle layer never persists shards, manifests or plaintext.
 * Refusing consent keeps the archive searchable only in-session (no write).
 *
 * Only `content` and `sender` are authorised by V1; `transcriptions` stays
 * false forever in this version and is never migrated implicitly.
 */

import { consentKey } from './manifest';

/**
 * Copy of the consent text presented to the user. Bumping this constant
 * invalidates consent granted under a previous disclosure, requiring a fresh
 * opt-in before the archive can be (re)indexed.
 */
export const GLOBAL_SEARCH_CONSENT_COPY_VERSION = 1;

export type GlobalSearchConsentChoice = 'keep-locally' | 'session-only';

export type GlobalSearchConsent = {
	/** archiveId the consent applies to. */
	archiveId: string;
	/** Copy version the user actually saw when they chose. */
	copyVersion: number;
	choice: GlobalSearchConsentChoice;
	/** Which content fields this consent authorises. V1 is always content+sender. */
	includes: { content: true; sender: true; transcriptions: false };
	grantedAt: number;
};

/**
 * A consent record is valid only when it authorises keeping the archive
 * locally under the *current* copy version. Anything else — session-only,
 * an older copy version, a mismatched archiveId, or transcriptions enabled —
 * is treated as "no consent to persist".
 */
export function isConsentValidForPersistence(
	consent: GlobalSearchConsent | undefined,
	archiveId: string,
	copyVersion = GLOBAL_SEARCH_CONSENT_COPY_VERSION,
): consent is GlobalSearchConsent {
	if (!consent) return false;
	if (consent.archiveId !== archiveId) return false;
	if (consent.choice !== 'keep-locally') return false;
	if (consent.copyVersion !== copyVersion) return false;
	if (consent.includes.transcriptions !== false) return false;
	if (consent.includes.content !== true) return false;
	if (consent.includes.sender !== true) return false;
	return true;
}

export function createConsent(
	archiveId: string,
	choice: GlobalSearchConsentChoice,
	copyVersion = GLOBAL_SEARCH_CONSENT_COPY_VERSION,
): GlobalSearchConsent {
	return {
		archiveId,
		copyVersion,
		choice,
		includes: { content: true, sender: true, transcriptions: false },
		grantedAt: Date.now(),
	};
}

/**
 * Storage adapter — injected so tests run without idb-keyval. The idb-keyval
 * implementation lives in storage.ts.
 */
export interface GlobalSearchConsentStore {
	get(archiveId: string): Promise<GlobalSearchConsent | undefined>;
	set(consent: GlobalSearchConsent): Promise<void>;
	del(archiveId: string): Promise<void>;
}

export async function readConsent(
	store: GlobalSearchConsentStore,
	archiveId: string,
): Promise<GlobalSearchConsent | undefined> {
	return store.get(archiveId);
}

export async function grantConsent(
	store: GlobalSearchConsentStore,
	archiveId: string,
	choice: GlobalSearchConsentChoice,
): Promise<GlobalSearchConsent> {
	const consent = createConsent(archiveId, choice);
	await store.set(consent);
	return consent;
}

export async function revokeConsent(
	store: GlobalSearchConsentStore,
	archiveId: string,
): Promise<void> {
	await store.del(archiveId);
}

/** Key this module uses — exported for the idb adapter and for enumeration. */
export { consentKey };

/**
 * Build the idb-backed consent store from the shared `GlobalSearchStorage`
 * adapter. Keeps the consent record behind the same namespace prefix and lets
 * the rune state (and its tests) inject in-memory storage.
 */
export function createStorageConsentStore(
	storage: import('./storage').GlobalSearchStorage,
): GlobalSearchConsentStore {
	return {
		async get(archiveId) {
			return (
				(await storage.get<GlobalSearchConsent>(consentKey(archiveId))) ??
				undefined
			);
		},
		async set(consent) {
			await storage.set(consentKey(consent.archiveId), consent);
		},
		async del(archiveId) {
			await storage.del(consentKey(archiveId));
		},
	};
}

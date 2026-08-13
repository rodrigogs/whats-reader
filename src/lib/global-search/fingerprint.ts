/**
 * GH-67 §6 — Canonical SHA-256 sourceFingerprint.
 *
 * `sourceFingerprint` is SHA-256 of the searchable fields in canonical order:
 * `ordinal`, `timestamp`, `sender`, `content`. It is computed in the worker
 * during indexing and stored on the manifest. A change to any field produces a
 * new fingerprint, which triggers a fresh generation (the MVP does not attempt
 * append-only updates).
 *
 * The fingerprint must be stable across runs and platforms, so:
 *  - numeric fields are rendered in base 10,
 *  - null timestamp renders as the literal string "null",
 *  - field separators are U+001F (information separator one) which is not a
 *    legal character inside normalised WhatsApp text, preventing ambiguity,
 *  - record separator is U+001E.
 *
 * No rawLine, ZIP bytes, media, paths or transcription text is hashed.
 */

import type { GlobalSearchDocument } from './manifest';

const FIELD_SEP = '\u001F';
const RECORD_SEP = '\u001E';

function field(value: string | number | null): string {
	return value === null ? 'null' : String(value);
}

export function canonicalDocumentRecord(doc: GlobalSearchDocument): string {
	// ordinal, timestamp, sender, content — the spec's canonical order.
	return [
		field(doc.ordinal),
		field(doc.timestamp),
		field(doc.sender),
		field(doc.content),
	].join(FIELD_SEP);
}

export function canonicalSourceBytes(
	docs: readonly GlobalSearchDocument[],
): string {
	return docs.map(canonicalDocumentRecord).join(RECORD_SEP);
}

/**
 * Compute the SHA-256 hex digest of the canonical source bytes. Uses the Web
 * Crypto `crypto.subtle` API, available in workers, browsers and Node 22+.
 */
export async function computeSourceFingerprint(
	docs: readonly GlobalSearchDocument[],
): Promise<string> {
	const text = canonicalSourceBytes(docs);
	const data = new TextEncoder().encode(text);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return bufferToHex(digest);
}

function bufferToHex(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let hex = '';
	for (const byte of bytes) {
		hex += byte.toString(16).padStart(2, '0');
	}
	return hex;
}

/**
 * Synchronous fingerprint for a UTF-8 ArrayBuffer. Used to derive a
 * sourceFingerprint from raw message text when building documents, without
 * re-encoding. Exposed for the shard checksum path that hashes serialised
 * shard bytes directly.
 */
export async function sha256Hex(
	data: ArrayBuffer | Uint8Array,
): Promise<string> {
	const buffer = data instanceof Uint8Array ? data.buffer : data;
	const digest = await crypto.subtle.digest('SHA-256', buffer as ArrayBuffer);
	return bufferToHex(digest);
}

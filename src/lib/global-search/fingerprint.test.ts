import { describe, expect, it } from 'vitest';
import {
	canonicalSourceBytes,
	computeSourceFingerprint,
	sha256Hex,
} from './fingerprint';
import type { GlobalSearchDocument } from './manifest';

function doc(
	ordinal: number,
	content: string,
	sender = 'Ana',
): GlobalSearchDocument {
	return {
		archiveId: 'a1',
		ordinal,
		messageId: `m${ordinal}`,
		timestamp: ordinal,
		sender,
		content,
	};
}

describe('GH-67 source fingerprint contract', () => {
	it('produces a stable SHA-256 hex digest for the same canonical bytes', async () => {
		const docs = [doc(0, 'hello'), doc(1, 'world')];
		const a = await computeSourceFingerprint(docs);
		const b = await computeSourceFingerprint(docs);
		expect(a).toBe(b);
		expect(a).toMatch(/^[0-9a-f]{64}$/);
	});

	it('changes when any searchable field changes', async () => {
		const base = [doc(0, 'hello'), doc(1, 'world')];
		const a = await computeSourceFingerprint(base);

		const changedContent = await computeSourceFingerprint([
			doc(0, 'hello'),
			doc(1, 'WORLD'),
		]);
		const changedSender = await computeSourceFingerprint([
			doc(0, 'hello'),
			doc(1, 'world', 'Bob'),
		]);
		const changedOrdinal = await computeSourceFingerprint([
			doc(0, 'hello'),
			{ ...doc(1, 'world'), ordinal: 2 },
		]);

		expect(changedContent).not.toBe(a);
		expect(changedSender).not.toBe(a);
		expect(changedOrdinal).not.toBe(a);
	});

	it('renders null timestamp as the literal "null" so it is distinguishable from 0', () => {
		const withNull = canonicalSourceBytes([
			{ ...doc(0, 'x'), timestamp: null },
		]);
		const withZero = canonicalSourceBytes([{ ...doc(0, 'x'), timestamp: 0 }]);
		expect(withNull).not.toEqual(withZero);
		expect(withNull).toContain('null');
	});

	it('sha256Hex matches crypto.subtle digest for the same bytes', async () => {
		const text = 'deterministic payload';
		const expected = await crypto.subtle.digest(
			'SHA-256',
			new TextEncoder().encode(text),
		);
		const hex = Array.from(new Uint8Array(expected))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
		expect(await sha256Hex(new TextEncoder().encode(text))).toBe(hex);
	});
});

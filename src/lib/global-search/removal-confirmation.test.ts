import { describe, expect, it } from 'vitest';
import { createRemovalConfirmation } from './removal-confirmation';

describe('GH-67 §5 removal confirmation — destructive removal requires explicit confirmation', () => {
	it('returns the requested archiveId exactly once after a request', () => {
		const confirmation = createRemovalConfirmation();

		confirmation.request('archive-a');
		expect(confirmation.requestedArchiveId).toBe('archive-a');

		expect(confirmation.confirm()).toBe('archive-a');
		// The confirmation is consumed: a second confirm must not execute again.
		expect(confirmation.confirm()).toBe(null);
		expect(confirmation.requestedArchiveId).toBe(null);
	});

	it('refuses to confirm a cancelled request', () => {
		const confirmation = createRemovalConfirmation();

		confirmation.request('archive-a');
		confirmation.cancel();

		expect(confirmation.requestedArchiveId).toBe(null);
		expect(confirmation.confirm()).toBe(null);
	});

	it('refuses to confirm when nothing was requested', () => {
		const confirmation = createRemovalConfirmation();

		expect(confirmation.confirm()).toBe(null);
	});

	it('replaces a pending request with the latest archiveId', () => {
		const confirmation = createRemovalConfirmation();

		confirmation.request('archive-a');
		confirmation.request('archive-b');

		expect(confirmation.confirm()).toBe('archive-b');
	});
});

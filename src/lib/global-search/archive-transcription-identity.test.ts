import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));

const {
	clearTranscriptionCache,
	getAllTranscriptions,
	getCachedTranscription,
	getTranscriptionsForChat,
	setTranscriptionsForChat,
} = await import('$lib/transcription.svelte');

describe('archive-scoped transcription identity', () => {
	beforeEach(() => {
		clearTranscriptionCache();
	});

	it('keeps equal message IDs from separate archives isolated through restore, persistence and local search', () => {
		setTranscriptionsForChat('archive-first', { shared: 'first transcript' });
		setTranscriptionsForChat('archive-second', { shared: 'second transcript' });
		setTranscriptionsForChat('archive', { 'a:b': 'delimiter-first' });
		setTranscriptionsForChat('archive:a', { b: 'delimiter-second' });

		expect(getCachedTranscription('archive-first', 'shared')).toBe(
			'first transcript',
		);
		expect(getCachedTranscription('archive-second', 'shared')).toBe(
			'second transcript',
		);
		expect(getCachedTranscription('archive', 'a:b')).toBe('delimiter-first');
		expect(getCachedTranscription('archive:a', 'b')).toBe('delimiter-second');
		expect(getTranscriptionsForChat('archive-first', ['shared'])).toEqual({
			shared: 'first transcript',
		});
		expect(getTranscriptionsForChat('archive-second', ['shared'])).toEqual({
			shared: 'second transcript',
		});
		expect(getAllTranscriptions('archive-first')).toEqual({
			shared: 'first transcript',
		});
		expect(getAllTranscriptions('archive-second')).toEqual({
			shared: 'second transcript',
		});
	});
});

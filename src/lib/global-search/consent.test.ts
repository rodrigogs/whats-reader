import { describe, expect, it } from 'vitest';
import {
	createConsent,
	GLOBAL_SEARCH_CONSENT_COPY_VERSION,
	type GlobalSearchConsent,
	isConsentValidForPersistence,
} from './consent';

function validConsent(
	archiveId: string,
	overrides: Partial<GlobalSearchConsent> = {},
): GlobalSearchConsent {
	return {
		archiveId,
		copyVersion: GLOBAL_SEARCH_CONSENT_COPY_VERSION,
		choice: 'keep-locally',
		includes: { content: true, sender: true, transcriptions: false },
		grantedAt: 1_700_000_000_000,
		...overrides,
	};
}

describe('GH-67 consent contract', () => {
	it('authorises persistence only for keep-locally under the current copy version', () => {
		expect(isConsentValidForPersistence(validConsent('a1'), 'a1')).toBe(true);
	});

	it('rejects session-only consent', () => {
		expect(
			isConsentValidForPersistence(
				validConsent('a1', { choice: 'session-only' }),
				'a1',
			),
		).toBe(false);
	});

	it('rejects consent granted under an older copy version', () => {
		expect(
			isConsentValidForPersistence(
				validConsent('a1', { copyVersion: 0 }),
				'a1',
			),
		).toBe(false);
	});

	it('rejects consent for a different archiveId', () => {
		expect(isConsentValidForPersistence(validConsent('a1'), 'a2')).toBe(false);
	});

	it('rejects consent that wrongly authorises transcriptions', () => {
		const bad = validConsent('a1', {
			includes: { content: true, sender: true, transcriptions: true as false },
		});
		expect(isConsentValidForPersistence(bad, 'a1')).toBe(false);
	});

	it('rejects undefined consent', () => {
		expect(isConsentValidForPersistence(undefined, 'a1')).toBe(false);
	});

	it('stamps V1 consent with content+sender and never transcriptions', () => {
		const consent = createConsent('a1', 'keep-locally');
		expect(consent.includes).toEqual({
			content: true,
			sender: true,
			transcriptions: false,
		});
		expect(consent.copyVersion).toBe(GLOBAL_SEARCH_CONSENT_COPY_VERSION);
	});
});

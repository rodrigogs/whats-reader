import { describe, expect, it } from 'vitest';
import { runPrivacyChecksAfterIdentity } from './privacy-order';

describe('runPrivacyChecksAfterIdentity', () => {
	it('proves the product identity before constructing or running privacy guards', async () => {
		const steps: string[] = [];

		await runPrivacyChecksAfterIdentity({
			navigate: async () => {
				steps.push('navigate');
			},
			assertIdentity: async () => {
				steps.push('assert identity');
			},
			createPrivacyGuards: () => {
				steps.push('create guards');
				return {
					expectNetworkApisBlocked: async () => {
						steps.push('check network guards');
					},
					expectConsoleLeakDetected: async () => {
						steps.push('check console leaks');
					},
				};
			},
			consoleLeakToken: 'synthetic-token',
		});

		expect(steps).toEqual([
			'navigate',
			'assert identity',
			'create guards',
			'check network guards',
			'check console leaks',
		]);
	});
});

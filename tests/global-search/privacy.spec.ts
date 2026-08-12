import { expect, test } from '@playwright/test';
import { runPrivacyChecksAfterIdentity } from '../../src/lib/global-search/privacy-order';
import { installGlobalSearchPrivacyGuards } from './privacy-guards';

test('GH-67 privacy harness blocks network APIs and synthetic data leaks', async ({ page }) => {
	await runPrivacyChecksAfterIdentity({
		navigate: () => page.goto('/').then(() => undefined),
		assertIdentity: () =>
			expect(
				page.getByRole('heading', { name: 'WhatsApp Backup Reader', level: 1 }),
			).toBeVisible(),
		createPrivacyGuards: () =>
			installGlobalSearchPrivacyGuards(page, {
				forbiddenConsoleTokens: [
					'gh67-v1-query',
					'gh67-v1-snippet',
					'gh67-v1-content',
					'gh67-v1-sender',
					'gh67-v1-message-id',
					'gh67-v1-archive-id',
					'/gh67/synthetic/path',
				],
			}),
		consoleLeakToken: 'gh67-v1-query',
	});
});

import { test } from '@playwright/test';
import { installGlobalSearchPrivacyGuards } from './privacy-guards';

test('GH-67 privacy harness blocks network APIs and synthetic data leaks', async ({ page }) => {
	const privacy = installGlobalSearchPrivacyGuards(page, {
		forbiddenConsoleTokens: [
			'gh67-v1-query',
			'gh67-v1-snippet',
			'gh67-v1-content',
			'gh67-v1-sender',
			'gh67-v1-message-id',
			'gh67-v1-archive-id',
			'/gh67/synthetic/path',
		],
	});

	await privacy.expectNetworkApisBlocked();
	await privacy.expectConsoleLeakDetected('gh67-v1-query');
});

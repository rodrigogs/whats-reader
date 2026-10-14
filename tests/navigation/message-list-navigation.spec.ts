import { expect, test } from '@playwright/test';
import JSZip from 'jszip';

async function makeChatZip(): Promise<Buffer> {
	const zip = new JSZip();
	zip.file(
		'_chat.txt',
		[
			'01/01/2024, 10:00 - Alice: First message',
			'01/01/2024, 10:01 - Bob: Second message',
			'01/01/2024, 10:02 - Alice: Third message',
		].join('\n'),
	);
	return zip.generateAsync({ type: 'nodebuffer' });
}

test('GH-79 ArrowDown continues from an article that receives focus', async ({ page }) => {
	await page.goto('/');
	await expect(
		page.getByRole('heading', { name: 'WhatsApp Backup Reader', level: 1 }),
	).toBeVisible();

	await page.locator('input[type="file"]').first().setInputFiles({
		name: 'keyboard-navigation.zip',
		mimeType: 'application/zip',
		buffer: await makeChatZip(),
	});

	const articles = page.locator('[role="feed"] [role="article"]');
	await expect(articles).toHaveCount(3);
	await articles.first().focus();
	await expect(articles.first()).toBeFocused();

	await page.keyboard.press('ArrowDown');
	await expect(articles.nth(1)).toBeFocused();
	await expect(articles.nth(1)).toHaveAttribute('aria-current', 'true');

	await page.keyboard.press('ArrowUp');
	await expect(articles.first()).toBeFocused();
	await expect(articles.first()).toHaveAttribute('aria-current', 'true');

	const innerButton = articles.nth(1).locator('button').first();
	await expect(innerButton).toBeVisible();
	await innerButton.focus();
	await page.keyboard.press('ArrowDown');
	await expect(innerButton).toBeFocused();
});

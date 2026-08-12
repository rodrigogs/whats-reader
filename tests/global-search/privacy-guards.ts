import { expect, type Page } from '@playwright/test';

type PrivacyGuardOptions = {
	forbiddenConsoleTokens: string[];
};

export function installGlobalSearchPrivacyGuards(
	page: Page,
	options: PrivacyGuardOptions,
) {
	const consoleLeaks: string[] = [];

	page.on('console', (message) => {
		const text = message.text();
		if (options.forbiddenConsoleTokens.some((token) => text.includes(token))) {
			consoleLeaks.push(text);
		}
	});

	async function installApiBlockers() {
		await page.addInitScript(() => {
			const blocked = (apiName: string) => {
				throw new Error(`GH-67 privacy guard blocked ${apiName}`);
			};

			Object.defineProperty(window, 'fetch', {
				configurable: true,
				value: () => blocked('fetch'),
			});

			class BlockedXMLHttpRequest {
				open() {
					blocked('XMLHttpRequest');
				}
			}

			Object.defineProperty(window, 'XMLHttpRequest', {
				configurable: true,
				value: BlockedXMLHttpRequest,
			});

			Object.defineProperty(navigator, 'sendBeacon', {
				configurable: true,
				value: () => blocked('sendBeacon'),
			});

			Object.defineProperty(window, 'WebSocket', {
				configurable: true,
				value: class BlockedWebSocket {
					constructor() {
						blocked('WebSocket');
					}
				},
			});
		});
	}

	return {
		async expectNetworkApisBlocked() {
			await installApiBlockers();
			await page.goto('/');
			const results = await page.evaluate(async () => {
				const call = async (apiName: string, fn: () => unknown | Promise<unknown>) => {
					try {
						await fn();
						return [apiName, 'allowed'];
					} catch (error) {
						return [apiName, error instanceof Error ? error.message : String(error)];
					}
				};

				return Promise.all([
					call('fetch', () => fetch('/gh67-network-leak')),
					call('XMLHttpRequest', () => {
						const request = new XMLHttpRequest();
						request.open('GET', '/gh67-xhr-leak');
					}),
					call('sendBeacon', () => navigator.sendBeacon('/gh67-beacon-leak')),
					call('WebSocket', () => new WebSocket('ws://127.0.0.1:5173/gh67-ws-leak')),
				]);
			});

			expect(Object.fromEntries(results)).toEqual({
				fetch: 'GH-67 privacy guard blocked fetch',
				XMLHttpRequest: 'GH-67 privacy guard blocked XMLHttpRequest',
				sendBeacon: 'GH-67 privacy guard blocked sendBeacon',
				WebSocket: 'GH-67 privacy guard blocked WebSocket',
			});
		},

		async expectConsoleLeakDetected(token: string) {
			await page.evaluate((value) => console.info(value), token);
			expect(consoleLeaks).toEqual([expect.stringContaining(token)]);
		},
	};
}

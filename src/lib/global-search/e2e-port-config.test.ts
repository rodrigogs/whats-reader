import { describe, expect, it } from 'vitest';
import {
	createGlobalSearchE2eServer,
	getGlobalSearchE2ePort,
} from './e2e-port-config';

describe('GH-67 isolated Playwright server configuration', () => {
	it('derives every server endpoint from the dedicated default port', () => {
		const server = createGlobalSearchE2eServer(getGlobalSearchE2ePort({}));

		expect(server).toEqual({
			baseURL: 'http://127.0.0.1:5199',
			command: 'npm run dev -- --host 127.0.0.1 --port 5199 --strictPort',
			url: 'http://127.0.0.1:5199',
		});
	});

	it('accepts only complete TCP port numbers in range', () => {
		expect(getGlobalSearchE2ePort({ GLOBAL_SEARCH_E2E_PORT: '6200' })).toBe(
			6200,
		);
		for (const value of ['0', '65536', '-1', '5199.5', 'abc', '']) {
			expect(() =>
				getGlobalSearchE2ePort({ GLOBAL_SEARCH_E2E_PORT: value }),
			).toThrow(
				'GLOBAL_SEARCH_E2E_PORT must be an integer between 1 and 65535',
			);
		}
	});
});

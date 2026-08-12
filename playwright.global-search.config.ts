import { defineConfig, devices } from '@playwright/test';
import {
	createGlobalSearchE2eServer,
	getGlobalSearchE2ePort,
} from './src/lib/global-search/e2e-port-config';

const globalSearchE2eServer = createGlobalSearchE2eServer(
	getGlobalSearchE2ePort(process.env),
);

export default defineConfig({
	testDir: './tests/global-search',
	testMatch: '**/*.spec.ts',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	use: {
		baseURL: globalSearchE2eServer.baseURL,
		trace: 'retain-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	webServer: {
		command: globalSearchE2eServer.command,
		url: globalSearchE2eServer.url,
		reuseExistingServer: false,
		timeout: 120_000,
		env: {
			VITE_GLOBAL_SEARCH_HARNESS: '1',
		},
	},
});

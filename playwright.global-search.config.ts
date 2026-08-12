import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/global-search',
	testMatch: '**/*.spec.ts',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	use: {
		baseURL: 'http://127.0.0.1:5173',
		trace: 'retain-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	webServer: {
		command: 'npm run dev -- --host 127.0.0.1',
		url: 'http://127.0.0.1:5173',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			VITE_GLOBAL_SEARCH_HARNESS: '1',
		},
	},
});

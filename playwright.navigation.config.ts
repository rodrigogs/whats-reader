import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.NAVIGATION_E2E_PORT ?? 5201);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
	testDir: './tests/navigation',
	testMatch: '**/*.spec.ts',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	use: {
		baseURL,
		trace: 'retain-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	webServer: {
		command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
		url: baseURL,
		reuseExistingServer: false,
		timeout: 120_000,
	},
});

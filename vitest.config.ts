import { defineConfig } from 'vitest/config';

// Regression suite for the issue fixes that live in tests/ (GH-74/78/79/87).
// They only import plain .ts modules from src/lib with relative paths, so the
// SvelteKit plugin is deliberately left out: this suite must run right after
// `npm install`, with no `svelte-kit sync` and no paraglide compile step.
// The global-search unit suite keeps its own config (vitest.global-search.config.ts).
export default defineConfig({
	esbuild: {
		tsconfigRaw: {
			compilerOptions: {
				target: 'ES2022',
			},
		},
	},
	test: {
		include: ['tests/**/*.test.ts'],
		// tests/global-search holds Playwright specs, not vitest ones.
		exclude: ['**/node_modules/**', 'tests/global-search/**'],
		environment: 'node',
		globals: false,
		watch: false,
	},
});

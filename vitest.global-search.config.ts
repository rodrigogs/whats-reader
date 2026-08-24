import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	esbuild: {
		tsconfigRaw: {
			compilerOptions: {
				target: 'ES2022',
			},
		},
	},
	test: {
		include: [
			'src/lib/global-search/**/*.test.ts',
			'src/lib/global-search/**/*.test.svelte.ts',
		],
		environment: 'node',
		globals: false,
		watch: false,
		// GH-67 §9 wall-clock assertions (e.g. shard.test.ts "under 50 ms for
		// the 100k corpus") measure scheduling latency, not algorithmic cost:
		// they flake on loaded machines while the implementation is healthy.
		// Mirror the playwright config (retries: process.env.CI ? 1 : 0) so CI
		// retries load flakes once; local runs keep failing fast.
		retry: process.env.CI ? 1 : 0,
	},
});

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
	},
});

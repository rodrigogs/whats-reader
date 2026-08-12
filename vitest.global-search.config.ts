import { defineConfig } from 'vitest/config';

export default defineConfig({
	esbuild: {
		tsconfigRaw: {
			compilerOptions: {
				target: 'ES2022',
			},
		},
	},
	test: {
		include: ['src/lib/global-search/**/*.test.ts'],
		environment: 'node',
		globals: false,
		watch: false,
	},
});

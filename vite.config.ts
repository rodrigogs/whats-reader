import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			// Use localStorage and cookie for locale persistence (not URL)
			// URL-based locale doesn't work well with GitHub Pages base path
			strategy: ['localStorage', 'cookie', 'baseLocale'],
		}),
		tailwindcss(),
		sveltekit(),
	],
	// Electron needs to use relative paths
	base: './',
});

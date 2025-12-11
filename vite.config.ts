import { readFileSync } from 'node:fs';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Read version from package.json at build time
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
	// Inject version at build time
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version),
	},
	plugins: [
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			// Use localStorage and cookie for locale persistence (not URL)
			// URL-based locale doesn't work well with GitHub Pages base path
			// preferredLanguage uses browser's navigator.language as fallback
			strategy: ['localStorage', 'cookie', 'preferredLanguage', 'baseLocale'],
		}),
		tailwindcss(),
		sveltekit(),
	],
	// Electron needs to use relative paths
	base: './',
	build: {
		// Performance optimizations
		target: 'esnext',
		minify: 'esbuild',
		cssMinify: true,
	},
});

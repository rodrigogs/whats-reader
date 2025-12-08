import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Use base path for GitHub Pages, empty for Electron
const isGitHubPages = process.env.GITHUB_PAGES === 'true';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: true,
		}),
		paths: {
			base: isGitHubPages ? '/whats-reader' : '',
			relative: !isGitHubPages,
		},
	},
};

export default config;

import { once } from 'node:events';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

async function main() {
	const marker = 'GH-67 dedicated-port sentinel';
	let sentinel: ReturnType<typeof createServer> | undefined;

	try {
		sentinel = createServer((_request, response) => {
			response.writeHead(200, { 'content-type': 'text/plain' });
			response.end(marker);
		});

		await once(sentinel.listen(0, '127.0.0.1'), 'listening');
		const address = sentinel.address();
		if (!address || typeof address === 'string') {
			throw new Error('GH-67 collision sentinel did not receive a TCP port');
		}

		const port = address.port;
		const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
		const playwright = spawn(npx, ['playwright', 'test', '--config', 'playwright.global-search.config.ts'], {
			cwd: process.cwd(),
			env: { ...process.env, GLOBAL_SEARCH_E2E_PORT: String(port) },
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		let output = '';
		playwright.stdout.on('data', (chunk) => {
			output += chunk;
		});
		playwright.stderr.on('data', (chunk) => {
			output += chunk;
		});

		const [exitCode] = (await once(playwright, 'close')) as [number | null];
		if (exitCode === 0) {
			throw new Error('GH-67 Playwright reused the dedicated-port sentinel');
		}
		if (!output.includes('is already used') || !output.includes('reuseExistingServer:true')) {
			throw new Error(`GH-67 collision did not reject the occupied dedicated port:\n${output}`);
		}

		const response = await fetch(`http://127.0.0.1:${port}`);
		if ((await response.text()) !== marker) {
			throw new Error('GH-67 collision sentinel was not preserved');
		}

		console.log(`GH-67 strictPort collision passed on dedicated port ${port}`);
	} finally {
		if (sentinel?.listening) {
			await new Promise<void>((resolve, reject) => {
				sentinel.close((error) => (error ? reject(error) : resolve()));
			});
		}
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});

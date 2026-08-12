type Environment = Record<string, string | undefined>;

const DEFAULT_GLOBAL_SEARCH_E2E_PORT = 5199;

export function getGlobalSearchE2ePort(env: Environment): number {
	const value = env.GLOBAL_SEARCH_E2E_PORT;
	if (value === undefined) return DEFAULT_GLOBAL_SEARCH_E2E_PORT;

	if (!/^\d+$/.test(value)) {
		throw new Error(
			'GLOBAL_SEARCH_E2E_PORT must be an integer between 1 and 65535',
		);
	}

	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65_535) {
		throw new Error(
			'GLOBAL_SEARCH_E2E_PORT must be an integer between 1 and 65535',
		);
	}

	return port;
}

export function createGlobalSearchE2eServer(port: number) {
	const url = `http://127.0.0.1:${port}`;
	return {
		baseURL: url,
		command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
		url,
	};
}

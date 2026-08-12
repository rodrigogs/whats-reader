import {
	GLOBAL_SEARCH_SYNTHETIC_SEED,
	isGlobalSearchSyntheticSize,
} from './synthetic-generator';

export type GlobalSearchBenchmarkTarget = 'web' | 'electron';
export type GlobalSearchBenchmarkProfile = 'desktop' | 'low-end';

export type GlobalSearchBenchmarkOptions = {
	target: GlobalSearchBenchmarkTarget;
	profile: GlobalSearchBenchmarkProfile;
	size: 10_000 | 100_000 | 250_000 | 1_000_000;
	report: string;
	assert: boolean;
};

export type GlobalSearchBenchmarkEnvironment = {
	commit: string;
	nodeVersion: string;
	platform: string;
	logicalCpus: number;
	totalRamBytes: number;
	browserVersion?: string;
	electronVersion?: string;
};

export type GlobalSearchBenchmarkReport = {
	version: 1;
	command: string[];
	commit: string;
	seed: typeof GLOBAL_SEARCH_SYNTHETIC_SEED;
	target: GlobalSearchBenchmarkTarget;
	profile: GlobalSearchBenchmarkProfile;
	environment: GlobalSearchBenchmarkEnvironment;
	size: GlobalSearchBenchmarkOptions['size'];
	scenario: {
		status: 'unavailable';
		reason: string;
	};
	samples: [];
	p95: 'unavailable';
	longTasks: 'unavailable';
	cancellation: 'unavailable';
	memory: 'unavailable';
	gates: Record<string, { passed: boolean; reason: string }>;
};

const DEFAULT_REPORT = 'artifacts/gh67/global-search-benchmark.json';

export function parseGlobalSearchBenchmarkArgs(
	args: string[],
): GlobalSearchBenchmarkOptions {
	const options: GlobalSearchBenchmarkOptions = {
		target: 'web',
		profile: 'desktop',
		size: 100_000,
		report: DEFAULT_REPORT,
		assert: false,
	};

	for (const arg of args) {
		if (arg === '--assert') {
			options.assert = true;
			continue;
		}

		const [name, value] = arg.split('=', 2);
		if (!name.startsWith('--') || value === undefined) {
			throw new Error(`Invalid benchmark argument: ${arg}`);
		}

		switch (name) {
			case '--target':
				if (value !== 'web' && value !== 'electron') {
					throw new Error(`Invalid target: ${value}`);
				}
				options.target = value;
				break;
			case '--profile':
				if (value !== 'desktop' && value !== 'low-end') {
					throw new Error(`Invalid profile: ${value}`);
				}
				options.profile = value;
				break;
			case '--size': {
				const size = Number(value);
				if (!isGlobalSearchSyntheticSize(size)) {
					throw new Error(`Invalid size: ${value}`);
				}
				options.size = size;
				break;
			}
			case '--report':
				if (value.trim() === '') {
					throw new Error('Invalid report path: empty');
				}
				options.report = value;
				break;
			default:
				throw new Error(`Unknown benchmark argument: ${name}`);
		}
	}

	return options;
}

export function createUnavailableGlobalSearchBenchmarkReport(
	options: GlobalSearchBenchmarkOptions,
	environment: GlobalSearchBenchmarkEnvironment,
	command = process.argv,
): GlobalSearchBenchmarkReport {
	return {
		version: 1,
		command,
		commit: environment.commit,
		seed: GLOBAL_SEARCH_SYNTHETIC_SEED,
		target: options.target,
		profile: options.profile,
		environment,
		size: options.size,
		scenario: {
			status: 'unavailable',
			reason:
				'GH-67 production global-search scenario is not implemented in this harness card.',
		},
		samples: [],
		p95: 'unavailable',
		longTasks: 'unavailable',
		cancellation: 'unavailable',
		memory: 'unavailable',
		gates: {
			scenarioExecuted: {
				passed: false,
				reason: 'No app scenario was executed; --assert must fail closed.',
			},
		},
	};
}

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
	osRelease?: string;
	browserVersion?: string;
	electronVersion?: string;
};

/** Real throttling applied to the browser, never simulated. */
export type GlobalSearchBenchmarkThrottle = {
	/** CPU throttle rate: 1 = none, 4 = low-end 4x via DevTools CDP. */
	cpuRate: number;
	/** V8 heap cap in bytes: null = none, 512 MiB for low-end. */
	heapCapBytes: number | null;
};

export type GlobalSearchBenchmarkSample = {
	/** 0-based sample index after the warmup run. */
	index: number;
	/**
	 * Main-thread corpus prep: query submit → first `shard` posted to the
	 * worker (buildSessionDocuments + splitDocuments + feed-loop start).
	 * The §10.11 "indexar" row gates this phase (5 s desktop / 15 s low-end).
	 */
	indexingMs: number;
	/**
	 * Worker first response: first `shard` posted → first worker `progress`
	 * message (the earliest moment any search feedback exists).
	 */
	firstPageMs: number;
	/**
	 * Query phase only: first `shard` posted → terminal `complete` message
	 * from the worker. The §10.11 "total" row gates this phase (300 ms
	 * desktop / 800 ms low-end); the separately-budgeted indexing prep is
	 * NOT part of it, otherwise the 300 ms row could never be met on a
	 * corpus whose prep alone exceeds it.
	 */
	totalMs: number;
	/** True when this sample was a cancellation observation run. */
	cancelled: boolean;
	/** cancel requested → worker `cancelled` terminal; null for full runs. */
	cancellationMs: number | null;
};

export type GlobalSearchBenchmarkMemory = {
	available: boolean;
	/** measureUserAgentSpecificMemory().bytes when the API exists. */
	measureUasBytes: number | null;
	/** performance.memory.usedJSHeapSize when the API exists. */
	jsHeapUsedBytes: number | null;
	/** null when available; must name the absent API otherwise. */
	reason: string | null;
};

export type GlobalSearchBenchmarkGateResult = {
	passed: boolean;
	reason: string;
};

export type GlobalSearchBenchmarkUnavailableReport = {
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
	gates: Record<string, GlobalSearchBenchmarkGateResult>;
};

export type GlobalSearchBenchmarkExecutedReport = {
	version: 1;
	command: string[];
	commit: string;
	seed: typeof GLOBAL_SEARCH_SYNTHETIC_SEED;
	target: GlobalSearchBenchmarkTarget;
	profile: GlobalSearchBenchmarkProfile;
	environment: GlobalSearchBenchmarkEnvironment & {
		throttle: GlobalSearchBenchmarkThrottle;
	};
	size: GlobalSearchBenchmarkOptions['size'];
	/** The deterministic query executed against the gh67-v1 corpus. */
	query: string;
	warmupSamples: number;
	scenario: {
		status: 'executed';
	};
	samples: GlobalSearchBenchmarkSample[];
	p95: {
		firstPageMs: number;
		totalMs: number;
		indexingMs: number;
	};
	longTasks: {
		maxMs: number;
		observed: boolean;
		available: boolean;
		reason: string | null;
	};
	cancellation: { observed: boolean; ms: number };
	memory: GlobalSearchBenchmarkMemory;
	network: { requests: number; nonLocalRequests: number };
	worker: { used: boolean; url: string | null };
	gates: Record<string, GlobalSearchBenchmarkGateResult>;
};

export type GlobalSearchBenchmarkReport =
	| GlobalSearchBenchmarkUnavailableReport
	| GlobalSearchBenchmarkExecutedReport;

/**
 * §10.11 warm targets for 100k messages. `low-end` relaxes the latency and
 * indexing rows; the Electron profile uses the desktop row. Cancellation and
 * main-thread long-task ceilings are identical across profiles.
 */
export const GLOBAL_SEARCH_BENCHMARK_TARGETS = {
	desktop: {
		firstPageP95Ms: 150,
		totalP95Ms: 300,
		indexingP95Ms: 5_000,
		longTaskMaxMs: 50,
		cancellationMs: 500,
	},
	'low-end': {
		firstPageP95Ms: 400,
		totalP95Ms: 800,
		indexingP95Ms: 15_000,
		longTaskMaxMs: 50,
		cancellationMs: 500,
	},
} as const;

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
): GlobalSearchBenchmarkUnavailableReport {
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

export type GlobalSearchBenchmarkMeasurements = {
	query: string;
	warmupSamples: number;
	samples: GlobalSearchBenchmarkSample[];
	longTaskMaxMs: number;
	longTasksObserved: boolean;
	/**
	 * PerformanceObserver registered (may be true with zero long tasks —
	 * zero long tasks during indexing is compliance, not a failed metric).
	 */
	longTaskObserverAvailable: boolean;
	/** Names the absent API when the observer could not register. */
	longTaskUnavailableReason: string | null;
	cancellation: { observed: boolean; ms: number };
	memory: GlobalSearchBenchmarkMemory;
	network: { requests: number; nonLocalRequests: number };
	worker: { used: boolean; url: string | null };
	throttle: GlobalSearchBenchmarkThrottle;
};

/**
 * Build the executed report from real measurements. The p95 values are
 * recomputed from the samples here so a caller cannot inject a p95 that does
 * not correspond to the measured runs; gates are evaluated last.
 */
export function createExecutedGlobalSearchBenchmarkReport(
	options: GlobalSearchBenchmarkOptions,
	environment: GlobalSearchBenchmarkEnvironment,
	measurements: GlobalSearchBenchmarkMeasurements,
	command = process.argv,
): GlobalSearchBenchmarkExecutedReport {
	const report: GlobalSearchBenchmarkExecutedReport = {
		version: 1,
		command,
		commit: environment.commit,
		seed: GLOBAL_SEARCH_SYNTHETIC_SEED,
		target: options.target,
		profile: options.profile,
		environment: { ...environment, throttle: measurements.throttle },
		size: options.size,
		query: measurements.query,
		warmupSamples: measurements.warmupSamples,
		scenario: { status: 'executed' },
		samples: measurements.samples,
		p95: {
			firstPageMs:
				computeGlobalSearchBenchmarkP95(
					measurements.samples.map((sample) => sample.firstPageMs),
				) ?? 0,
			totalMs:
				computeGlobalSearchBenchmarkP95(
					measurements.samples.map((sample) => sample.totalMs),
				) ?? 0,
			indexingMs:
				computeGlobalSearchBenchmarkP95(
					measurements.samples.map((sample) => sample.indexingMs),
				) ?? 0,
		},
		longTasks: {
			maxMs: measurements.longTaskMaxMs,
			observed: measurements.longTasksObserved,
			available: measurements.longTaskObserverAvailable,
			reason: measurements.longTaskUnavailableReason,
		},
		cancellation: measurements.cancellation,
		memory: measurements.memory,
		network: measurements.network,
		worker: measurements.worker,
		gates: {},
	};
	report.gates = evaluateGlobalSearchBenchmarkGates(report).gates;
	return report;
}

/**
 * p95 over the sorted samples (nearest-rank, ceil(0.95·n) − 1). Returns null
 * when there are no samples: a report with no samples can never claim a p95.
 */
export function computeGlobalSearchBenchmarkP95(
	values: readonly number[],
): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const rank = Math.max(0, Math.ceil(0.95 * sorted.length) - 1);
	return sorted[Math.min(rank, sorted.length - 1)];
}

/**
 * Evaluate every §10.11 gate over a report. For the unavailable report the
 * only gate is scenarioExecuted (false), so --assert always fails closed.
 * Never sets passed:true for an unobserved metric.
 */
export function evaluateGlobalSearchBenchmarkGates(
	report: GlobalSearchBenchmarkReport,
): {
	assertPasses: boolean;
	gates: Record<string, GlobalSearchBenchmarkGateResult>;
} {
	if (report.scenario.status !== 'executed') {
		const gates: Record<string, GlobalSearchBenchmarkGateResult> = {
			scenarioExecuted: {
				passed: false,
				reason: report.scenario.reason,
			},
		};
		return { assertPasses: false, gates };
	}

	const executed = report as GlobalSearchBenchmarkExecutedReport;
	const targets = GLOBAL_SEARCH_BENCHMARK_TARGETS[executed.profile];
	const gate = (
		passed: boolean,
		reason: string,
	): GlobalSearchBenchmarkGateResult => ({ passed, reason });

	const gates: Record<string, GlobalSearchBenchmarkGateResult> = {
		scenarioExecuted: gate(true, 'Real app scenario executed.'),
		sampleCount: gate(
			executed.samples.length === 10,
			`Exactly 10 measured samples after one warmup required; got ${executed.samples.length}.`,
		),
		firstPageP95: gate(
			executed.p95.firstPageMs <= targets.firstPageP95Ms,
			`first-page p95 ${executed.p95.firstPageMs}ms <= ${targets.firstPageP95Ms}ms (${executed.profile}).`,
		),
		totalP95: gate(
			executed.p95.totalMs <= targets.totalP95Ms,
			`total-query p95 ${executed.p95.totalMs}ms <= ${targets.totalP95Ms}ms (${executed.profile}).`,
		),
		indexingP95: gate(
			executed.p95.indexingMs <= targets.indexingP95Ms,
			`indexing p95 ${executed.p95.indexingMs}ms <= ${targets.indexingP95Ms}ms (${executed.profile}).`,
		),
		longTasks: gate(
			executed.longTasks.available &&
				executed.longTasks.maxMs <= targets.longTaskMaxMs,
			!executed.longTasks.available
				? 'Long-task observer could not be registered — the required metric is unavailable (never faked as compliance).'
				: executed.longTasks.observed
					? `max main-thread long task ${executed.longTasks.maxMs}ms <= ${targets.longTaskMaxMs}ms.`
					: `No long task observed during indexing (max ${executed.longTasks.maxMs}ms <= ${targets.longTaskMaxMs}ms) — compliant.`,
		),
		cancellation: gate(
			executed.cancellation.observed &&
				executed.cancellation.ms <= targets.cancellationMs,
			executed.cancellation.observed
				? `cancellation observed in ${executed.cancellation.ms}ms <= ${targets.cancellationMs}ms.`
				: 'Cancellation was never observed — the required metric is missing.',
		),
		// Memory is the ONLY optional metric: it gates only when available.
		// Absence is marked unavailable (never invented), and must name the
		// absent UAS API so a fabricated "unavailable" cannot pass.
		memory: gate(
			true,
			executed.memory.available
				? `UAS memory measured: ${executed.memory.measureUasBytes ?? 'n/a'} bytes.`
				: `UAS API absent — memory marked unavailable (${executed.memory.reason ?? 'no reason'}), not invented.`,
		),
		offline: gate(
			executed.network.nonLocalRequests === 0,
			`${executed.network.nonLocalRequests} non-local request(s) observed out of ${executed.network.requests} total; only the local app origin is allowed.`,
		),
		realWorker: gate(
			executed.worker.used,
			executed.worker.used
				? `Real dedicated worker observed${executed.worker.url ? ` (${executed.worker.url})` : ''}.`
				: 'No dedicated Worker was observed — loopback/mock substitution detected.',
		),
	};

	const validationErrors = validateGlobalSearchBenchmarkReport(report);
	gates.reportValid = gate(
		validationErrors.length === 0,
		validationErrors.length === 0
			? 'Report is internally consistent.'
			: `Report validation failed: ${validationErrors.join('; ')}`,
	);

	const assertPasses = Object.values(gates).every((entry) => entry.passed);
	return { assertPasses, gates };
}

/**
 * Internal-consistency checks that catch fabricated fixtures: p95 values that
 * do not match the samples, impossible phase orderings, missing cancellation
 * samples, wrong sample counts, and memory "unavailable" claims that do not
 * name the absent API. Returns a list of problems (empty = valid).
 */
export function validateGlobalSearchBenchmarkReport(
	report: GlobalSearchBenchmarkReport,
): string[] {
	if (report.scenario.status !== 'executed') return [];

	const executed = report as GlobalSearchBenchmarkExecutedReport;
	const errors: string[] = [];
	const { samples } = executed;

	if (samples.length !== 10) {
		errors.push(`expected exactly 10 samples, got ${samples.length}`);
	}

	const firstPageValues = samples.map((sample) => sample.firstPageMs);
	const totalValues = samples.map((sample) => sample.totalMs);
	const indexingValues = samples.map((sample) => sample.indexingMs);
	const recomputed = {
		firstPageMs: computeGlobalSearchBenchmarkP95(firstPageValues),
		totalMs: computeGlobalSearchBenchmarkP95(totalValues),
		indexingMs: computeGlobalSearchBenchmarkP95(indexingValues),
	};

	for (const key of ['firstPageMs', 'totalMs', 'indexingMs'] as const) {
		const reported = executed.p95[key];
		const expected = recomputed[key];
		if (expected === null || Math.abs(reported - expected) > 0.001) {
			errors.push(
				`p95.${key} (${reported}) does not match the measured samples (${expected})`,
			);
		}
	}

	for (let index = 0; index < samples.length; index += 1) {
		const sample = samples[index];
		if (sample.index !== index) {
			errors.push(`sample ${index} has an out-of-order index ${sample.index}`);
		}
		if (!Number.isFinite(sample.totalMs) || sample.totalMs <= 0) {
			errors.push(`sample ${index} totalMs is not a positive measurement`);
		}
		if (
			!Number.isFinite(sample.firstPageMs) ||
			!Number.isFinite(sample.indexingMs) ||
			sample.firstPageMs < 0 ||
			sample.indexingMs < 0
		) {
			errors.push(`sample ${index} has invalid phase timings`);
			continue;
		}
		// The total row measures the query phase only (first shard → terminal).
		// It must at least contain the first-page response; the indexing prep
		// is a separate, independently-gated phase.
		if (sample.totalMs < sample.firstPageMs - 1) {
			errors.push(
				`sample ${index} totalMs ${sample.totalMs} is smaller than firstPageMs ${sample.firstPageMs} — fabricated`,
			);
		}
		if (sample.cancelled) {
			if (sample.cancellationMs === null || sample.cancellationMs < 0) {
				errors.push(
					`sample ${index} is cancelled but has no valid cancellationMs — fabricated`,
				);
			}
		} else if (sample.cancellationMs !== null) {
			errors.push(
				`sample ${index} is not cancelled but carries a cancellationMs — fabricated`,
			);
		}
	}

	if (executed.cancellation.observed) {
		const cancelledSamples = samples.filter((sample) => sample.cancelled);
		if (cancelledSamples.length === 0) {
			errors.push(
				'cancellation observed but no sample is marked cancelled — fabricated',
			);
		} else if (
			!cancelledSamples.some(
				(sample) =>
					sample.cancellationMs !== null &&
					Math.abs(sample.cancellationMs - executed.cancellation.ms) <= 0.001,
			)
		) {
			errors.push(
				'cancellation observed but no cancelled sample matches the reported cancellation ms — fabricated',
			);
		}
	} else if (samples.some((sample) => sample.cancelled)) {
		errors.push(
			'cancellation not observed but a sample is marked cancelled — fabricated',
		);
	}

	if (!executed.longTasks.available) {
		if (!executed.longTasks.reason?.includes('PerformanceObserver')) {
			errors.push(
				'long-task observer unavailable must name the absent PerformanceObserver API',
			);
		}
		if (executed.longTasks.observed || executed.longTasks.maxMs !== 0) {
			errors.push(
				'long-task unavailable must not carry invented observation values',
			);
		}
	} else if (executed.longTasks.maxMs < 0) {
		errors.push('long-task max is negative — fabricated');
	}

	if (!executed.memory.available) {
		if (!executed.memory.reason?.includes('measureUserAgentSpecificMemory')) {
			errors.push(
				'memory unavailable must name the absent measureUserAgentSpecificMemory API',
			);
		}
		if (
			executed.memory.measureUasBytes !== null ||
			executed.memory.jsHeapUsedBytes !== null
		) {
			errors.push('memory unavailable must not carry invented byte values');
		}
	}

	return errors;
}

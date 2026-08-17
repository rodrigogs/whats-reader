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
	 * message (the earliest moment any search feedback exists). null when the
	 * worker never produced a progress message — an unmeasured first page is
	 * NEVER fabricated as a constant (0 or otherwise); the p95 becomes null
	 * and the gate rejects it (§10.11 fail-closed).
	 */
	firstPageMs: number | null;
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
	/** Honest launch-attempt evidence (electron); absent when never attempted. */
	attempt?: {
		command: string[];
		exitCode: number | null;
		log: string;
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
		/**
		 * null when ANY sample's first page was unmeasured — a partially
		 * unmeasured p95 is never fabricated as a constant (0 or otherwise).
		 */
		firstPageMs: number | null;
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

export type GlobalSearchBenchmarkAttempt = {
	command: string[];
	exitCode: number | null;
	log: string;
};

/**
 * A real Electron version is a semver-triple string (e.g. "39.8.6") recorded
 * from the actual run. Anything else — undefined, "fake-version", "unknown" —
 * is not a recorded version and must never pass the electronVersion gate.
 */
export function isGlobalSearchBenchmarkRealElectronVersion(
	version: string | undefined,
): boolean {
	return typeof version === 'string' && /^\d+\.\d+\.\d+/.test(version);
}

/**
 * A real dedicated-worker URL is INDEPENDENTLY OBSERVED via
 * `page.on('worker')` (or `page.workers()` on Electron) by the runner — it is
 * NOT the transport's self-declared `kind` marker, which a loopback can forge.
 * The URL must be a real worker asset of the target's own origin: the web
 * harness build is served from the loopback (`http://127.0.0.1:<port>/`), and
 * Electron serves the same build through the custom `app://` scheme.
 */
export function isGlobalSearchBenchmarkRealWorkerUrl(
	url: string | null,
	target: GlobalSearchBenchmarkTarget,
): boolean {
	if (url === null) return false;
	const isWorkerAsset =
		url.includes('global-search-worker') && url.endsWith('.js');
	if (target === 'electron') {
		return url.startsWith('app://') && isWorkerAsset;
	}
	return url.startsWith('http://127.0.0.1:') && isWorkerAsset;
}

export function createUnavailableGlobalSearchBenchmarkReport(
	options: GlobalSearchBenchmarkOptions,
	environment: GlobalSearchBenchmarkEnvironment,
	command = process.argv,
	attempt?: GlobalSearchBenchmarkAttempt,
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
		...(attempt ? { attempt } : {}),
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
			// firstPageMs propagates null: a partially/fully unmeasured first
			// page must never be fabricated as 0 (§10.11 fail-closed — the
			// gate rejects the null, and the constant-0 mutation now fails).
			firstPageMs: computeGlobalSearchBenchmarkP95(
				measurements.samples.map((sample) => sample.firstPageMs),
			),
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
 * when there are no samples or when ANY sample is null (unmeasured): a p95
 * over partially-unmeasured data would silently hide the missing measurement,
 * so an unmeasured value poisons the whole percentile. Never fabricates a
 * constant.
 */
export function computeGlobalSearchBenchmarkP95(
	values: readonly (number | null)[],
): number | null {
	if (values.length === 0) return null;
	if (values.some((value) => value === null)) return null;
	const sorted = [...values] as number[];
	sorted.sort((a, b) => a - b);
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
	// §10.11: the Electron profile uses the SAME desktop warm targets, with a
	// separate report — the low-end row does not apply to the Electron target.
	const targets =
		executed.target === 'electron'
			? GLOBAL_SEARCH_BENCHMARK_TARGETS.desktop
			: GLOBAL_SEARCH_BENCHMARK_TARGETS[executed.profile];
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
			executed.p95.firstPageMs !== null &&
				executed.p95.firstPageMs > 0 &&
				executed.p95.firstPageMs <= targets.firstPageP95Ms,
			executed.p95.firstPageMs === null
				? 'first-page p95 is unmeasured (no worker progress observed) — unmeasured required metrics never pass.'
				: executed.p95.firstPageMs <= 0
					? `first-page p95 ${executed.p95.firstPageMs}ms is not a real measurement (constant-0/unmeasured) — never passes.`
					: `first-page p95 ${executed.p95.firstPageMs}ms <= ${targets.firstPageP95Ms}ms (${executed.profile}).`,
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
			executed.worker.used &&
				isGlobalSearchBenchmarkRealWorkerUrl(
					executed.worker.url,
					executed.target,
				),
			!executed.worker.used
				? 'No dedicated Worker was observed — loopback/mock substitution detected.'
				: isGlobalSearchBenchmarkRealWorkerUrl(
							executed.worker.url,
							executed.target,
						)
					? `Real dedicated worker observed (${executed.worker.url}).`
					: `worker.used is self-reported but no real observed ${executed.target} worker URL was recorded (${executed.worker.url ?? 'none'}) — loopback/mock substitution detected.`,
		),
	};

	const validationErrors = validateGlobalSearchBenchmarkReport(report);
	gates.reportValid = gate(
		validationErrors.length === 0,
		validationErrors.length === 0
			? 'Report is internally consistent.'
			: `Report validation failed: ${validationErrors.join('; ')}`,
	);

	// The electronVersion gate exists ONLY for the electron target: an
	// executed electron report without a real recorded Electron version
	// (unavailable or fake) must fail --assert. Web reports keep the exact
	// D2a gate set, byte-compatible.
	if (executed.target === 'electron') {
		const recorded = executed.environment.electronVersion;
		gates.electronVersion = gate(
			isGlobalSearchBenchmarkRealElectronVersion(recorded),
			isGlobalSearchBenchmarkRealElectronVersion(recorded)
				? `Electron ${recorded} recorded from the actual run.`
				: `Electron version missing or not a real recorded version (${recorded ?? 'none'}) — unavailable-or-fake never passes.`,
		);
	}

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
		if (expected === null || reported === null) {
			// null==null (unmeasured) is internally consistent — the GATE
			// rejects the unmeasured metric; a null/number mismatch is not.
			if (expected !== reported) {
				errors.push(
					`p95.${key} (${reported}) does not match the measured samples (${expected})`,
				);
			}
		} else if (Math.abs(reported - expected) > 0.001) {
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
			(sample.firstPageMs !== null &&
				(!Number.isFinite(sample.firstPageMs) || sample.firstPageMs < 0)) ||
			!Number.isFinite(sample.indexingMs) ||
			sample.indexingMs < 0
		) {
			errors.push(`sample ${index} has invalid phase timings`);
			continue;
		}
		// Exactly 0 is never a real first-page latency (a real worker
		// round-trip takes > 0 ms): the honest unmeasured marker is null
		// (gate-rejected), so a constant 0 is a fabrication signature.
		if (sample.firstPageMs === 0) {
			errors.push(
				`sample ${index} firstPageMs 0 is not a real measurement — fabricated constant`,
			);
		}
		// The total row measures the query phase only (first shard → terminal).
		// It must at least contain the first-page response; the indexing prep
		// is a separate, independently-gated phase. A null firstPageMs is the
		// honest unmeasured marker (gate-rejected), so it never orders here.
		if (
			sample.firstPageMs !== null &&
			sample.totalMs < sample.firstPageMs - 1
		) {
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

	if (executed.target === 'electron') {
		if (
			!isGlobalSearchBenchmarkRealElectronVersion(
				executed.environment.electronVersion,
			)
		) {
			errors.push(
				'electron target requires a real recorded electronVersion (unavailable-or-fake is rejected)',
			);
		}
	}

	// worker.used is a SELF-REPORT (the transport's `kind` marker), which an
	// in-process loopback can forge. A real report must also carry the
	// independently observed worker URL (page.on('worker') / page.workers()),
	// so used-without-a-real-URL is the loopback substitution signature.
	if (
		executed.worker.used &&
		!isGlobalSearchBenchmarkRealWorkerUrl(executed.worker.url, executed.target)
	) {
		errors.push(
			`worker.used is true but no observed ${executed.target} worker URL was recorded (${executed.worker.url ?? 'none'}) — loopback/mock substitution`,
		);
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

import { describe, expect, it } from 'vitest';
import {
	computeGlobalSearchBenchmarkP95,
	createExecutedGlobalSearchBenchmarkReport,
	createUnavailableGlobalSearchBenchmarkReport,
	evaluateGlobalSearchBenchmarkGates,
	GLOBAL_SEARCH_BENCHMARK_TARGETS,
	type GlobalSearchBenchmarkEnvironment,
	type GlobalSearchBenchmarkExecutedReport,
	type GlobalSearchBenchmarkOptions,
	type GlobalSearchBenchmarkSample,
	validateGlobalSearchBenchmarkReport,
} from './benchmark-contract';

const OPTIONS: GlobalSearchBenchmarkOptions = {
	target: 'web',
	profile: 'desktop',
	size: 100_000,
	report: 'artifacts/gh67/report.json',
	assert: true,
};

const ENVIRONMENT: GlobalSearchBenchmarkEnvironment = {
	commit: 'abc123',
	nodeVersion: 'v24.0.0',
	platform: 'linux-x64',
	logicalCpus: 8,
	totalRamBytes: 8 * 1024 ** 3,
	browserVersion: 'chromium-1234',
};

function realSamples(): GlobalSearchBenchmarkSample[] {
	// Sample 9 is the cancellation observation run; the rest are full runs.
	// All values are internally consistent: totalMs (query phase) is never
	// smaller than firstPageMs, and cancellationMs matches the report.
	return Array.from({ length: 10 }, (_, index) => ({
		index,
		indexingMs: 100 + index * 10,
		firstPageMs: 30 + index * 2,
		totalMs: 200 + index * 5,
		cancelled: index === 9,
		cancellationMs: index === 9 ? 120 : null,
	}));
}

function executedReport(
	overrides: Partial<GlobalSearchBenchmarkExecutedReport> = {},
): GlobalSearchBenchmarkExecutedReport {
	return {
		...createExecutedGlobalSearchBenchmarkReport(OPTIONS, ENVIRONMENT, {
			query: 'gh67-v1-query',
			warmupSamples: 1,
			samples: realSamples(),
			longTaskMaxMs: 30,
			longTasksObserved: true,
			longTaskObserverAvailable: true,
			longTaskUnavailableReason: null,
			cancellation: { observed: true, ms: 120 },
			memory: {
				available: false,
				measureUasBytes: null,
				jsHeapUsedBytes: null,
				reason:
					'measureUserAgentSpecificMemory API absent — marked unavailable',
			},
			network: { requests: 42, nonLocalRequests: 0 },
			worker: { used: true, url: 'global-search-worker.ts' },
			throttle: { cpuRate: 1, heapCapBytes: null },
		}),
		...overrides,
	};
}

describe('GH-67 benchmark p95 contract', () => {
	it('computes p95 as the 95th percentile of the sorted samples', () => {
		expect(
			computeGlobalSearchBenchmarkP95([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
		).toBe(10);
		expect(
			computeGlobalSearchBenchmarkP95([10, 1, 5, 3, 2, 9, 8, 7, 6, 4]),
		).toBe(10);
		expect(computeGlobalSearchBenchmarkP95([100, 200, 300])).toBe(300);
	});

	it('returns null when no samples exist (nothing measured)', () => {
		expect(computeGlobalSearchBenchmarkP95([])).toBeNull();
	});
});

describe('GH-67 benchmark gate evaluation (spec §10.11)', () => {
	it('passes every gate for a report built from real, consistent measurements', () => {
		const report = executedReport();
		const result = evaluateGlobalSearchBenchmarkGates(report);
		expect(result.assertPasses).toBe(true);
		for (const [name, gate] of Object.entries(result.gates)) {
			expect(gate.passed, `${name} gate must pass: ${gate.reason}`).toBe(true);
		}
	});

	it('applies the desktop targets to the desktop profile', () => {
		expect(GLOBAL_SEARCH_BENCHMARK_TARGETS.desktop).toEqual({
			firstPageP95Ms: 150,
			totalP95Ms: 300,
			indexingP95Ms: 5_000,
			longTaskMaxMs: 50,
			cancellationMs: 500,
		});
	});

	it('applies the relaxed low-end targets to the low-end profile', () => {
		expect(GLOBAL_SEARCH_BENCHMARK_TARGETS['low-end']).toEqual({
			firstPageP95Ms: 400,
			totalP95Ms: 800,
			indexingP95Ms: 15_000,
			longTaskMaxMs: 50,
			cancellationMs: 500,
		});
	});

	it('fails --assert when the first-page p95 misses the profile target', () => {
		const samples = realSamples().map((sample) => ({
			...sample,
			firstPageMs: 200 + sample.index,
		}));
		const report = executedReport({
			samples,
			p95: { firstPageMs: 209, totalMs: 245, indexingMs: 190 },
		});
		const result = evaluateGlobalSearchBenchmarkGates(report);
		expect(result.assertPasses).toBe(false);
		expect(result.gates.firstPageP95.passed).toBe(false);
	});

	it('fails --assert when the total p95 misses the desktop target', () => {
		const samples = realSamples().map((sample) => ({
			...sample,
			totalMs: 600 + sample.index * 20,
		}));
		const report = executedReport({
			samples,
			p95: { firstPageMs: 48, totalMs: 780, indexingMs: 190 },
		});
		const result = evaluateGlobalSearchBenchmarkGates(report);
		expect(result.assertPasses).toBe(false);
		expect(result.gates.totalP95.passed).toBe(false);
	});

	it('accepts the same total on the low-end profile', () => {
		const samples = realSamples().map((sample) => ({
			...sample,
			totalMs: 600 + sample.index * 20,
		}));
		const report = executedReport({
			samples,
			p95: { firstPageMs: 48, totalMs: 780, indexingMs: 190 },
		});
		report.profile = 'low-end';
		const result = evaluateGlobalSearchBenchmarkGates(report);
		expect(result.assertPasses).toBe(true);
	});

	it('fails --assert when indexing p95 misses the target', () => {
		const samples = realSamples().map((sample) => ({
			...sample,
			indexingMs: 6_000 + sample.index * 100,
		}));
		const report = executedReport({
			samples,
			p95: { firstPageMs: 48, totalMs: 245, indexingMs: 6_900 },
		});
		const result = evaluateGlobalSearchBenchmarkGates(report);
		expect(result.assertPasses).toBe(false);
		expect(result.gates.indexingP95.passed).toBe(false);
	});

	it('fails --assert when cancellation exceeds 500 ms or was never observed', () => {
		const slow = executedReport({
			cancellation: { observed: true, ms: 640 },
			samples: realSamples().map((sample) =>
				sample.cancelled ? { ...sample, cancellationMs: 640 } : sample,
			),
		});
		expect(evaluateGlobalSearchBenchmarkGates(slow).assertPasses).toBe(false);
		expect(
			evaluateGlobalSearchBenchmarkGates(slow).gates.cancellation.passed,
		).toBe(false);

		const unobserved = executedReport({
			cancellation: { observed: false, ms: -1 },
			samples: realSamples().map((sample) => ({
				...sample,
				cancelled: false,
				cancellationMs: null,
			})),
		});
		expect(evaluateGlobalSearchBenchmarkGates(unobserved).assertPasses).toBe(
			false,
		);
		expect(
			evaluateGlobalSearchBenchmarkGates(unobserved).gates.cancellation.passed,
		).toBe(false);
	});

	it('fails --assert when a main-thread long task exceeds 50 ms during indexing', () => {
		const report = executedReport({
			longTasks: { maxMs: 84, observed: true, available: true, reason: null },
		});
		const result = evaluateGlobalSearchBenchmarkGates(report);
		expect(result.assertPasses).toBe(false);
		expect(result.gates.longTasks.passed).toBe(false);
	});

	it('passes the long-task gate when the observer is registered and no long task was observed', () => {
		// Zero long tasks during indexing is COMPLIANCE (§10.11: the main
		// thread must not have a long task above 50 ms), not a measurement
		// failure — as long as the observer itself is registered.
		const report = executedReport({
			longTasks: { maxMs: 0, observed: false, available: true, reason: null },
		});
		const result = evaluateGlobalSearchBenchmarkGates(report);
		expect(result.gates.longTasks.passed).toBe(true);
		expect(result.assertPasses).toBe(true);
	});

	it('fails --assert when the long-task observer could not register (unavailable is never compliance)', () => {
		const report = executedReport({
			longTasks: {
				maxMs: 0,
				observed: false,
				available: false,
				reason:
					'PerformanceObserver could not observe longtask entries — marked unavailable, not invented',
			},
		});
		const result = evaluateGlobalSearchBenchmarkGates(report);
		expect(result.assertPasses).toBe(false);
		expect(result.gates.longTasks.passed).toBe(false);
		expect(result.gates.longTasks.reason.toLowerCase()).toContain(
			'unavailable',
		);
	});

	it('fails --assert when any non-local request was observed', () => {
		const report = executedReport({
			network: { requests: 44, nonLocalRequests: 2 },
		});
		const result = evaluateGlobalSearchBenchmarkGates(report);
		expect(result.assertPasses).toBe(false);
		expect(result.gates.offline.passed).toBe(false);
	});

	it('fails --assert when no real dedicated worker was used', () => {
		const report = executedReport({ worker: { used: false, url: null } });
		const result = evaluateGlobalSearchBenchmarkGates(report);
		expect(result.assertPasses).toBe(false);
		expect(result.gates.realWorker.passed).toBe(false);
	});

	it('fails --assert when the scenario was never executed (unavailable)', () => {
		const unavailable = createUnavailableGlobalSearchBenchmarkReport(
			OPTIONS,
			ENVIRONMENT,
			['node', 'benchmark', '--assert'],
		);
		const result = evaluateGlobalSearchBenchmarkGates(unavailable);
		expect(result.assertPasses).toBe(false);
		expect(result.gates.scenarioExecuted.passed).toBe(false);
	});
});

describe('GH-67 benchmark report validation (fabrication guard)', () => {
	it('accepts an internally consistent executed report', () => {
		expect(validateGlobalSearchBenchmarkReport(executedReport())).toEqual([]);
	});

	it('rejects a fabricated p95 that does not match the samples', () => {
		const report = executedReport({
			p95: { firstPageMs: 1, totalMs: 1, indexingMs: 1 },
		});
		const errors = validateGlobalSearchBenchmarkReport(report);
		expect(errors.some((error) => error.includes('p95'))).toBe(true);
	});

	it('rejects a sample whose total contradicts its phases (fabricated fixture)', () => {
		const samples = realSamples();
		samples[3] = {
			...samples[3],
			indexingMs: 900,
			firstPageMs: 400,
			totalMs: 200, // total < indexing + firstPage → impossible
		};
		const report = executedReport({ samples });
		const errors = validateGlobalSearchBenchmarkReport(report);
		expect(errors.length).toBeGreaterThan(0);
	});

	it('rejects a non-10-sample run (spec requires 10 after one warmup)', () => {
		const report = executedReport({ samples: realSamples().slice(0, 4) });
		const errors = validateGlobalSearchBenchmarkReport(report);
		expect(errors.some((error) => error.includes('10'))).toBe(true);
	});

	it('rejects an unavailable memory claim with a fabricated reason', () => {
		const report = executedReport({
			memory: {
				available: false,
				measureUasBytes: null,
				jsHeapUsedBytes: null,
				reason: 'the benchmark harness decided not to measure',
			},
		});
		const errors = validateGlobalSearchBenchmarkReport(report);
		expect(errors.some((error) => error.toLowerCase().includes('memory'))).toBe(
			true,
		);
	});

	it('allows memory unavailable only when the UAS API is absent', () => {
		const report = executedReport(); // memory unavailable, UAS reason
		expect(validateGlobalSearchBenchmarkReport(report)).toEqual([]);
		const result = evaluateGlobalSearchBenchmarkGates(report);
		expect(result.gates.memory.passed).toBe(true);
		expect(result.assertPasses).toBe(true);
	});

	it('rejects an unavailable long-task claim that does not name the absent API', () => {
		const report = executedReport({
			longTasks: {
				maxMs: 0,
				observed: false,
				available: false,
				reason: 'the benchmark harness decided not to measure',
			},
		});
		const errors = validateGlobalSearchBenchmarkReport(report);
		expect(
			errors.some((error) => error.toLowerCase().includes('long-task')),
		).toBe(true);
	});

	it('rejects an unavailable long-task claim that carries invented values', () => {
		const report = executedReport({
			longTasks: {
				maxMs: 84,
				observed: true,
				available: false,
				reason: 'PerformanceObserver absent — marked unavailable, not invented',
			},
		});
		const errors = validateGlobalSearchBenchmarkReport(report);
		expect(
			errors.some((error) => error.toLowerCase().includes('long-task')),
		).toBe(true);
	});

	it('rejects a cancellation observation without a matching cancelled sample', () => {
		const report = executedReport({
			cancellation: { observed: true, ms: 100 },
			samples: realSamples().map((sample) => ({
				...sample,
				cancelled: false,
				cancellationMs: null,
			})),
		});
		const errors = validateGlobalSearchBenchmarkReport(report);
		expect(errors.some((error) => error.toLowerCase().includes('cancel'))).toBe(
			true,
		);
	});
});

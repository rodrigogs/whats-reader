import { describe, expect, it } from 'vitest';
import {
	createExecutedGlobalSearchBenchmarkReport,
	createUnavailableGlobalSearchBenchmarkReport,
	evaluateGlobalSearchBenchmarkGates,
	type GlobalSearchBenchmarkEnvironment,
	type GlobalSearchBenchmarkExecutedReport,
	type GlobalSearchBenchmarkOptions,
	type GlobalSearchBenchmarkSample,
	isGlobalSearchBenchmarkRealWorkerUrl,
	parseGlobalSearchBenchmarkArgs,
	validateGlobalSearchBenchmarkReport,
} from './benchmark-contract';

describe('GH-67 benchmark runner contract', () => {
	it('accepts only the spec-defined flags and scenario values', () => {
		expect(
			parseGlobalSearchBenchmarkArgs([
				'--target=web',
				'--profile=desktop',
				'--size=100000',
				'--assert',
				'--report=artifacts/gh67/report.json',
			]),
		).toMatchObject({
			target: 'web',
			profile: 'desktop',
			size: 100_000,
			assert: true,
			report: 'artifacts/gh67/report.json',
		});

		expect(() => parseGlobalSearchBenchmarkArgs(['--target=node'])).toThrow(
			/target/,
		);
		expect(() => parseGlobalSearchBenchmarkArgs(['--profile=mobile'])).toThrow(
			/profile/,
		);
		expect(() => parseGlobalSearchBenchmarkArgs(['--size=42'])).toThrow(/size/);
		expect(() => parseGlobalSearchBenchmarkArgs(['--unknown'])).toThrow(
			/unknown/i,
		);
	});

	it('accepts --target=electron as a first-class target', () => {
		expect(
			parseGlobalSearchBenchmarkArgs([
				'--target=electron',
				'--profile=low-end',
				'--size=100000',
				'--assert',
				'--report=artifacts/gh67/electron-linux-100k.json',
			]),
		).toMatchObject({
			target: 'electron',
			profile: 'low-end',
			size: 100_000,
			assert: true,
			report: 'artifacts/gh67/electron-linux-100k.json',
		});
	});

	it('marks unavailable app scenarios explicitly without inventing measurements', () => {
		const options = parseGlobalSearchBenchmarkArgs([
			'--target=web',
			'--profile=desktop',
			'--size=100000',
		]);
		const report = createUnavailableGlobalSearchBenchmarkReport(options, {
			commit: 'abc123',
			nodeVersion: 'v24.0.0',
			platform: 'linux',
			logicalCpus: 8,
			totalRamBytes: 16 * 1024 ** 3,
		});

		expect(report.version).toBe(1);
		expect(report.seed).toBe('gh67-v1');
		expect(report.scenario.status).toBe('unavailable');
		expect(report.samples).toEqual([]);
		expect(report.gates.scenarioExecuted.passed).toBe(false);
		expect(report.memory).toBe('unavailable');
	});

	it('records honest attempt evidence on an electron launch failure', () => {
		const options = parseGlobalSearchBenchmarkArgs(['--target=electron']);
		const report = createUnavailableGlobalSearchBenchmarkReport(
			options,
			{
				commit: 'abc123',
				nodeVersion: 'v24.0.0',
				platform: 'linux',
				logicalCpus: 8,
				totalRamBytes: 16 * 1024 ** 3,
			},
			['node', 'benchmark', '--target=electron', '--assert'],
			{
				command: ['electron', '--version'],
				exitCode: 1,
				log: 'Error: missing X server or $DISPLAY',
			},
		);
		expect(report.scenario.status).toBe('unavailable');
		expect(report.attempt).toEqual({
			command: ['electron', '--version'],
			exitCode: 1,
			log: 'Error: missing X server or $DISPLAY',
		});
		expect(report.gates.scenarioExecuted.passed).toBe(false);
	});
});

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
	// Sample 9 is the cancellation observation run; all values internally
	// consistent (totalMs >= firstPageMs, cancellationMs matches the report).
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
	samples: GlobalSearchBenchmarkSample[] = realSamples(),
): GlobalSearchBenchmarkExecutedReport {
	return {
		...createExecutedGlobalSearchBenchmarkReport(OPTIONS, ENVIRONMENT, {
			query: 'gh67-v1-query',
			warmupSamples: 1,
			samples,
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
			worker: {
				used: true,
				url: 'http://127.0.0.1:4123/_app/immutable/workers/global-search-worker-test.js',
			},
			throttle: { cpuRate: 1, heapCapBytes: null },
		}),
		...overrides,
	};
}

describe('GH-67 fail-closed gates (D2c regression fixes)', () => {
	it('rejects a constant-0 first page (unmeasured must never pass)', () => {
		// RED#1 reproduction: every sample carries the fabricated constant 0.
		const samples = realSamples().map((sample) => ({
			...sample,
			firstPageMs: 0,
		}));
		const report = executedReport({}, samples);
		const result = evaluateGlobalSearchBenchmarkGates(report);
		expect(result.assertPasses).toBe(false);
		expect(result.gates.firstPageP95.passed).toBe(false);
		expect(result.gates.firstPageP95.reason.toLowerCase()).toContain(
			'unmeasured',
		);
	});

	it('rejects a null first page (no progress observed)', () => {
		const samples = realSamples().map((sample) => ({
			...sample,
			firstPageMs: null,
		}));
		const report = executedReport({}, samples);
		const result = evaluateGlobalSearchBenchmarkGates(report);
		expect(result.assertPasses).toBe(false);
		expect(result.gates.firstPageP95.passed).toBe(false);
		expect(result.gates.firstPageP95.reason.toLowerCase()).toContain(
			'unmeasured',
		);
	});

	it('passes the first-page gate for a real measured p95', () => {
		const result = evaluateGlobalSearchBenchmarkGates(executedReport());
		expect(result.gates.firstPageP95.passed).toBe(true);
		expect(result.assertPasses).toBe(true);
	});

	it('rejects worker.used=true with no observed worker URL (RED#2)', () => {
		// In-process loopback with a forged `kind` marker: used is
		// self-reported true, but no `page.on('worker')` event ever fired.
		const report = executedReport({ worker: { used: true, url: null } });
		const result = evaluateGlobalSearchBenchmarkGates(report);
		expect(result.assertPasses).toBe(false);
		expect(result.gates.realWorker.passed).toBe(false);
		expect(result.gates.realWorker.reason.toLowerCase()).toContain('none');
	});

	it('rejects a worker URL that is not a real worker asset of the target', () => {
		const report = executedReport({
			worker: { used: true, url: 'http://127.0.0.1:4123/other.js' },
		});
		const result = evaluateGlobalSearchBenchmarkGates(report);
		expect(result.gates.realWorker.passed).toBe(false);
		expect(result.assertPasses).toBe(false);
	});

	it('accepts a real observed worker URL for each target', () => {
		expect(
			isGlobalSearchBenchmarkRealWorkerUrl(
				'http://127.0.0.1:4123/_app/immutable/workers/global-search-worker-test.js',
				'web',
			),
		).toBe(true);
		expect(
			isGlobalSearchBenchmarkRealWorkerUrl(
				'app://localhost/_app/immutable/workers/global-search-worker-test.js',
				'electron',
			),
		).toBe(true);
		expect(
			isGlobalSearchBenchmarkRealWorkerUrl(
				'http://127.0.0.1:4123/_app/immutable/workers/global-search-worker-test.js',
				'electron',
			),
		).toBe(false);
		expect(isGlobalSearchBenchmarkRealWorkerUrl(null, 'web')).toBe(false);
	});

	it('flags the RED mutations as fabricated by the validation guard too', () => {
		const constantZero = realSamples().map((sample) => ({
			...sample,
			firstPageMs: 0,
		}));
		expect(
			validateGlobalSearchBenchmarkReport(executedReport({}, constantZero)),
		).not.toEqual([]);

		const forgedLoopback = executedReport({
			worker: { used: true, url: null },
		});
		expect(validateGlobalSearchBenchmarkReport(forgedLoopback)).not.toEqual([]);
	});
});

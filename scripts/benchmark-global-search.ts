#!/usr/bin/env tsx
/**
 * GH-67 §9 — REAL web/Electron benchmark runner (D2a + D2b slices).
 *
 * This is the one production benchmark runner for the **web** and
 * **Electron** targets. It:
 *
 *  1. builds the app with `VITE_GLOBAL_SEARCH_HARNESS=1` (the harness build;
 *     normal/distributed builds never include the synthetic hook),
 *  2. for web, serves ONLY the local build output on a dedicated explicit
 *     free loopback port (never 5173) with `--strictPort` (no foreign server
 *     reuse); for Electron, launches the local Electron binary (Playwright
 *     `_electron.launch`) which loads the same harness build through the
 *     app's own `app://` protocol — the real app worker path,
 *  3. drives the REAL global-search UI/worker path against the deterministic
 *     `gh67-v1` corpus through the `window.__gh67GlobalSearchHarness` bridge
 *     (real dedicated worker messaging, never an in-process loopback/mock),
 *  4. measures 1 warmup + 10 samples (first-page p95, total-query p95,
 *     indexing p95, cancellation observation, main-thread long-task max,
 *     memory via `measureUserAgentSpecificMemory` when available),
 *  5. verifies offline/local-only traffic and that a real Worker was used;
 *     for Electron it records the OS/Electron/Chromium versions from the
 *     actual main process,
 *  6. writes a versioned JSON report OUTSIDE the versioned tree
 *     (`artifacts/gh67/…`) and evaluates every §10.11 gate; `--assert` exits
 *     non-zero unless every gate passes with a genuinely executed scenario.
 *
 * If the host cannot run Electron, the runner PROVES it (launch attempt log
 * with exit codes) and reports `scenario.status: 'unavailable'` honestly —
 * `--assert` fails closed, it never pretends success.
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:net';
import { cpus, release, totalmem } from 'node:os';
import { createRequire } from 'node:module';
import {
	_electron,
	chromium,
	type Browser,
	type ElectronApplication,
	type Page,
} from '@playwright/test';
import {
	createExecutedGlobalSearchBenchmarkReport,
	createUnavailableGlobalSearchBenchmarkReport,
	evaluateGlobalSearchBenchmarkGates,
	parseGlobalSearchBenchmarkArgs,
	type GlobalSearchBenchmarkAttempt,
	type GlobalSearchBenchmarkEnvironment,
	type GlobalSearchBenchmarkMeasurements,
	type GlobalSearchBenchmarkOptions,
	type GlobalSearchBenchmarkSample,
} from '../src/lib/global-search/benchmark-contract';

const require = createRequire(import.meta.url);

/** Deterministic query: matches exactly one message (ordinal 12345). */
const BENCHMARK_QUERY = '#12345';
const WARMUP_SAMPLES = 1;
const MEASURED_SAMPLES = 10;
const LOW_END_CPU_RATE = 4;
const LOW_END_HEAP_CAP_BYTES = 512 * 1024 * 1024;

/** Electron serves the built app from the custom `app://` scheme. */
const ELECTRON_LOCAL_PREFIX = 'app://';

class ElectronLaunchError extends Error {
	constructor(
		message: string,
		readonly attempt: GlobalSearchBenchmarkAttempt,
	) {
		super(message);
		this.name = 'ElectronLaunchError';
	}
}

type HarnessWindow = {
	__gh67GlobalSearchHarness: {
		seed: string;
		workerUsed: boolean;
		loadCorpus(size: number): Promise<{
			archiveCount: number;
			messageCount: number;
			searchableBytes: number;
		}>;
		clearCorpus(): Promise<{ removedArchives: number }>;
		beginRun(): void;
		getLastRun(): GlobalSearchHarnessRunTiming | null;
		dropPreparedSources(): void;
		getLongTasks(): {
			maxMs: number;
			observed: boolean;
			available: boolean;
			reason: string | null;
		};
		resetLongTasks(): void;
		getMemory(): Promise<{
			available: boolean;
			measureUasBytes: number | null;
			jsHeapUsedBytes: number | null;
			reason: string | null;
		}>;
	};
};

type GlobalSearchHarnessRunTiming = {
	submitMs: number;
	indexingMs: number;
	firstPageMs: number;
	totalMs: number;
	cancelled: boolean;
	cancellationMs: number | null;
	shardCount: number;
	progressCount: number;
	totalMatches: number | null;
};

function harnessBridge(page: Page) {
	return page.evaluate(() => {
		const bridge = (window as unknown as { __gh67GlobalSearchHarness?: unknown })
			.__gh67GlobalSearchHarness;
		if (!bridge) throw new Error('GH-67 benchmark: harness bridge missing');
		return bridge as HarnessWindow['__gh67GlobalSearchHarness'];
	});
}

async function findFreeLoopbackPort(): Promise<number> {
	for (;;) {
		const server = createServer();
		await once(server.listen(0, '127.0.0.1'), 'listening');
		const address = server.address();
		if (!address || typeof address === 'string') {
			server.close();
			throw new Error('GH-67 benchmark: could not allocate a loopback port');
		}
		const port = address.port;
		await new Promise<void>((resolveClose, rejectClose) => {
			server.close((error) => (error ? rejectClose(error) : resolveClose()));
		});
		// The spec forbids 5173 outright; retry if the OS happened to pick it.
		if (port !== 5173) return port;
	}
}

function buildHarnessApp(): void {
	const result = spawnSync('npm', ['run', 'build'], {
		encoding: 'utf8',
		env: { ...process.env, VITE_GLOBAL_SEARCH_HARNESS: '1' },
	});
	if (result.status !== 0) {
		const tail = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim().slice(-2000);
		throw new Error(`GH-67 benchmark: harness build failed:\n${tail}`);
	}
}

/**
 * Kill the whole preview-server process tree. The server is spawned as
 * `npx vite preview` (own process group via `detached: true`), so a negative
 * pid targets the group — both the npx wrapper and the real vite server die.
 */
function killProcessTree(child: ChildProcess): void {
	if (child.pid === undefined) return;
	try {
		process.kill(-child.pid, 'SIGTERM');
	} catch {
		child.kill();
	}
}

async function serveBuild(
	port: number,
): Promise<{ child: ChildProcess; baseURL: string }> {
	const baseURL = `http://127.0.0.1:${port}`;
	const child = spawn(
		'npx',
		[
			'vite',
			'preview',
			'--host',
			'127.0.0.1',
			'--port',
			String(port),
			'--strictPort',
		],
		{
			cwd: process.cwd(),
			env: { ...process.env, VITE_GLOBAL_SEARCH_HARNESS: '1' },
			stdio: ['ignore', 'pipe', 'pipe'],
			// Own process group so `killProcessTree` can take down BOTH the
			// npx wrapper and the vite server it spawns — killing only npx
			// left orphaned preview servers on dedicated ports.
			detached: true,
		},
	);
	let stderr = '';
	child.stderr.on('data', (chunk) => {
		stderr += String(chunk);
	});
	const deadline = Date.now() + 60_000;
	for (;;) {
		if (child.exitCode !== null) {
			throw new Error(
				`GH-67 benchmark: preview server exited early (strictPort?):\n${stderr.slice(-2000)}`,
			);
		}
		try {
			const response = await fetch(baseURL, {
				signal: AbortSignal.timeout(2_000),
			});
			if (response.ok) return { child, baseURL };
		} catch {
			// not ready yet
		}
		if (Date.now() > deadline) {
			killProcessTree(child);
			throw new Error('GH-67 benchmark: preview server did not become ready');
		}
		await new Promise((resolveWait) => setTimeout(resolveWait, 250));
	}
}

async function waitForHarness(page: Page): Promise<void> {
	await page.waitForFunction(
		() =>
			Boolean(
				(window as unknown as { __gh67GlobalSearchHarness?: unknown })
					.__gh67GlobalSearchHarness,
			),
		undefined,
		{ timeout: 30_000 },
	);
}

/**
 * Open the global-search panel through its real toggle button. The slot is
 * width:0 (and the cancel button unactionable) while closed.
 */
async function openSearchPanel(page: Page): Promise<void> {
	// The toggle appears twice (sidebar + header); either opens the panel.
	await page.getByLabel('Global search').first().click();
	// Wait until the panel is actually open (width transition completes).
	await page.waitForSelector('.global-search-slot.global-search-open', {
		timeout: 15_000,
	});
}

/**
 * Drive the REAL global-search UI path: focus the real input (the Svelte
 * handler chain: input event → 300 ms debounce → `state.submitQuery` → real
 * worker) and wait for the terminal worker message. `expectCancelled` clicks
 * the real "Cancel search" button mid-scan and waits for a cancelled run.
 * The panel must already be open (see `openSearchPanel`).
 */
async function runUISample(
	page: Page,
	query: string,
	expectCancelled: boolean,
): Promise<GlobalSearchHarnessRunTiming> {
	await page.evaluate((q) => {
		const bridge = (
			window as unknown as { __gh67GlobalSearchHarness?: HarnessWindow['__gh67GlobalSearchHarness'] }
		).__gh67GlobalSearchHarness;
		if (!bridge) throw new Error('GH-67 benchmark: harness bridge missing');
		bridge.beginRun();
		const input = document.querySelector<HTMLInputElement>(
			'input[aria-label="Search all chats..."]',
		);
		if (!input) {
			throw new Error('GH-67 benchmark: global-search input not found');
		}
		const setter = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			'value',
		)?.set;
		if (!setter) throw new Error('GH-67 benchmark: input value setter unavailable');
		setter.call(input, q);
		input.dispatchEvent(new Event('input', { bubbles: true }));
	}, query);

	if (expectCancelled) {
		// The input event triggers the 300 ms debounce; wait for the searching
		// state (submit fired) and cancel through the real button while the
		// worker is mid-scan.
		//
		// The scan can complete FASTER than Playwright's actionability
		// pipeline (visible → stable → enabled → click, ~100 ms+), so the
		// button can appear and vanish before a locator click ever lands.
		// Click it with an immediate DOM click on the REAL button: the real
		// Svelte `onclick` handler runs — same real path, no actionability
		// delay.
		//
		// The click only lands once the worker is provably mid-scan (the
		// "{count} messages scanned" progress paragraph is rendered, which
		// requires the first shard to have been consumed): clicking at bare
		// first appearance can land BEFORE the worker received `start` (the
		// cold prep runs between status='searching' and the first shard),
		// where the controller drops the cancel and the terminal is a normal
		// `complete` — no real cancellation observed.
		//
		// NOTE: the poll must NOT be a self-referential named function —
		// Playwright's esbuild keepNames transform wraps any function that
		// references itself by name in a `__name(...)` helper that is not
		// defined inside the evaluate scope ("ReferenceError: __name is not
		// defined"; probed empirically, both arrow-const and function
		// declaration fail). A setInterval + Promise shape has no
		// self-reference and evaluates cleanly; the evaluate resolves once
		// the real button has been clicked (or the deadline expires).
		await page.evaluate(
			() =>
				new Promise<void>((resolve) => {
					const deadline = performance.now() + 60_000;
					const timer = setInterval(() => {
						const button = document.querySelector<HTMLButtonElement>(
							'button[aria-label="Cancel search"]',
						);
						const scanning = Array.from(document.querySelectorAll('p')).some(
							(paragraph) =>
								(paragraph.textContent ?? '').includes('messages scanned'),
						);
						if (button && scanning) {
							button.click();
							clearInterval(timer);
							resolve();
						} else if (performance.now() > deadline) {
							clearInterval(timer);
							resolve();
						}
					}, 5);
				}),
		);
	}

	await page.waitForFunction(
		() => {
			const bridge = (
				window as unknown as {
					__gh67GlobalSearchHarness?: HarnessWindow['__gh67GlobalSearchHarness'];
				}
			).__gh67GlobalSearchHarness;
			return bridge !== undefined && bridge.getLastRun() !== null;
		},
		undefined,
		{ timeout: 300_000 },
	);

	const run = await page.evaluate(() => {
		const bridge = (
			window as unknown as {
				__gh67GlobalSearchHarness?: HarnessWindow['__gh67GlobalSearchHarness'];
			}
		).__gh67GlobalSearchHarness;
		if (!bridge) throw new Error('GH-67 benchmark: harness bridge missing');
		return bridge.getLastRun();
	});
	if (!run) throw new Error('GH-67 benchmark: sample produced no run timing');
	return run;
}

async function collectEnvironment(
	browserVersion?: string,
): Promise<GlobalSearchBenchmarkEnvironment> {
	let commit = 'unavailable';
	const git = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
	if (git.status === 0) commit = git.stdout.trim();
	return {
		commit,
		nodeVersion: process.version,
		platform: `${process.platform}-${process.arch}`,
		logicalCpus: cpus().length,
		totalRamBytes: totalmem(),
		osRelease: release(),
		browserVersion,
	};
}

async function runWebBenchmark(
	options: GlobalSearchBenchmarkOptions,
	environment: GlobalSearchBenchmarkEnvironment,
): Promise<{ reportPath: string; assertPasses: boolean }> {
	console.info('GH-67 benchmark: building harness app (VITE_GLOBAL_SEARCH_HARNESS=1)…');
	buildHarnessApp();

	const port = await findFreeLoopbackPort();
	console.info(
		`GH-67 benchmark: serving build on http://127.0.0.1:${port} (strictPort)`,
	);
	const { child: server, baseURL } = await serveBuild(port);

	let browser: Browser | undefined;
	try {
		const isLowEnd = options.profile === 'low-end';
		browser = await chromium.launch({
			args: isLowEnd
				? [
						`--js-flags=--max-old-space-size=${LOW_END_HEAP_CAP_BYTES / (1024 * 1024)}`,
					]
				: [],
		});
		environment.browserVersion = browser.version();
		const context = await browser.newContext();
		const page = await context.newPage();

		// Real DevTools CPU throttle (4x) for the low-end profile.
		if (isLowEnd) {
			const cdp = await context.newCDPSession(page);
			await cdp.send('Emulation.setCPUThrottlingRate', {
				rate: LOW_END_CPU_RATE,
			});
		}

		const requests: string[] = [];
		const workerUrls: string[] = [];
		page.on('request', (request) => requests.push(request.url()));
		page.on('worker', (worker) => workerUrls.push(worker.url()));

		await page.goto(baseURL, { waitUntil: 'networkidle' });
		await waitForHarness(page);

		const seed = await page.evaluate(() => {
			const bridge = (
				window as unknown as {
					__gh67GlobalSearchHarness?: HarnessWindow['__gh67GlobalSearchHarness'];
				}
			).__gh67GlobalSearchHarness;
			return bridge?.seed ?? null;
		});
		if (seed !== 'gh67-v1') {
			throw new Error(`GH-67 benchmark: unexpected harness seed ${seed}`);
		}

		const corpus = await page.evaluate((size) => {
			const bridge = (
				window as unknown as {
					__gh67GlobalSearchHarness?: HarnessWindow['__gh67GlobalSearchHarness'];
				}
			).__gh67GlobalSearchHarness;
			if (!bridge) throw new Error('GH-67 benchmark: harness bridge missing');
			return bridge.loadCorpus(size);
		}, options.size);
		console.info('GH-67 benchmark: corpus loaded', corpus);

		// Long-task window: reset AFTER corpus load (corpus building is not the
		// measured indexing phase) and read after the last measured sample.
		await page.evaluate(() => {
			(
				window as unknown as {
					__gh67GlobalSearchHarness?: HarnessWindow['__gh67GlobalSearchHarness'];
				}
			).__gh67GlobalSearchHarness?.resetLongTasks();
		});

		await openSearchPanel(page);

		console.info('GH-67 benchmark: warmup run…');
		await runUISample(page, BENCHMARK_QUERY, false);

		const samples: GlobalSearchBenchmarkSample[] = [];
		for (let index = 0; index < MEASURED_SAMPLES; index += 1) {
			// Sample 9 is the cancellation observation run (contract convention).
			const cancelled = index === MEASURED_SAMPLES - 1;
			let run = await runUISample(page, BENCHMARK_QUERY, cancelled);

			if (cancelled && !run.cancelled) {
				// The warm scan can complete before the immediate DOM click
				// lands (the button appears and vanishes inside one poll
				// tick). Make the cancellation sample deterministic by giving
				// the scan a real window: drop the prepared-source cache
				// through the harness-only bridge hook (exposed under
				// VITE_GLOBAL_SEARCH_HARNESS=1 only) so this LAST sample runs
				// the cold prep+scan (~500ms+) and the mid-scan click lands
				// reliably — a real cancel over a real long-running scan.
				console.info(
					'GH-67 benchmark: cancel landed after completion — dropping prepared sources for a cold cancellation window',
				);
				await page.evaluate(() => {
					const bridge = (
						window as unknown as {
							__gh67GlobalSearchHarness?: HarnessWindow['__gh67GlobalSearchHarness'];
						}
					).__gh67GlobalSearchHarness;
					bridge?.dropPreparedSources?.();
				});
				run = await runUISample(page, BENCHMARK_QUERY, true);
				if (!run.cancelled) {
					throw new Error(
						'GH-67 benchmark: cancellation sample completed before the cancel landed even on the cold path',
					);
				}
			}

			samples.push({
				index,
				indexingMs: run.indexingMs,
				firstPageMs: run.firstPageMs,
				totalMs: run.totalMs,
				cancelled: run.cancelled,
				cancellationMs: run.cancellationMs,
			});
			console.info(
				`GH-67 benchmark: sample ${index}${cancelled ? ' (cancelled)' : ''} indexing=${run.indexingMs.toFixed(0)}ms firstPage=${run.firstPageMs.toFixed(0)}ms total=${run.totalMs.toFixed(0)}ms${run.cancelled ? ` cancel=${run.cancellationMs?.toFixed(0)}ms` : ''}`,
			);
		}

		const [longTasks, memory, workerUsed] = await page.evaluate(async () => {
			const bridge = (
				window as unknown as {
					__gh67GlobalSearchHarness?: HarnessWindow['__gh67GlobalSearchHarness'];
				}
			).__gh67GlobalSearchHarness;
			if (!bridge) throw new Error('GH-67 benchmark: harness bridge missing');
			const [lt, mem] = await Promise.all([
				Promise.resolve(bridge.getLongTasks()),
				bridge.getMemory(),
			]);
			return [lt, mem, bridge.workerUsed] as const;
		});

		const cancelledSample = samples.find((sample) => sample.cancelled);
		const measurements: GlobalSearchBenchmarkMeasurements = {
			query: BENCHMARK_QUERY,
			warmupSamples: WARMUP_SAMPLES,
			samples,
			longTaskMaxMs: longTasks.maxMs,
			longTasksObserved: longTasks.observed,
			longTaskObserverAvailable: longTasks.available,
			longTaskUnavailableReason: longTasks.reason,
			cancellation: {
				observed: cancelledSample !== undefined,
				ms: cancelledSample?.cancellationMs ?? -1,
			},
			memory: {
				available: memory.available,
				measureUasBytes: memory.measureUasBytes,
				jsHeapUsedBytes: memory.jsHeapUsedBytes,
				reason: memory.reason,
			},
			network: {
				requests: requests.length,
				nonLocalRequests: requests.filter((url) => !url.startsWith(baseURL))
					.length,
			},
			worker: {
				used: workerUsed,
				url: workerUrls[0] ?? null,
			},
			throttle: {
				cpuRate: isLowEnd ? LOW_END_CPU_RATE : 1,
				heapCapBytes: isLowEnd ? LOW_END_HEAP_CAP_BYTES : null,
			},
		};

		const report = createExecutedGlobalSearchBenchmarkReport(
			options,
			environment,
			measurements,
			process.argv,
		);
		const reportPath = writeReport(options.report, report);
		const { assertPasses, gates } = evaluateGlobalSearchBenchmarkGates(report);
		printGateSummary(gates);
		return { reportPath, assertPasses };
	} finally {
		await browser?.close();
		killProcessTree(server);
	}
}

function printGateSummary(
	gates: Record<string, { passed: boolean; reason: string }>,
): void {
	for (const [name, gate] of Object.entries(gates)) {
		console.info(
			`GH-67 benchmark: gate ${name}: ${gate.passed ? 'PASS' : 'FAIL'} — ${gate.reason}`,
		);
	}
}

/**
 * Resolve the Electron executable from the installed `electron` package
 * (the module's default export is the binary path string).
 */
function resolveElectronExecutable(): string {
	const resolved = require('electron') as unknown;
	if (typeof resolved !== 'string' || resolved.length === 0) {
		throw new ElectronLaunchError(
			'electron module did not resolve to an executable path',
			{
				command: ['node', '-e', 'require("electron")'],
				exitCode: null,
				log: `resolved to ${JSON.stringify(resolved)}`,
			},
		);
	}
	return resolved;
}

/** Pull a numeric exit code out of a Playwright launch error, if present. */
function extractExitCode(message: string): number | null {
	const match = /exit code (\d+)/.exec(message) ?? /code (\d+)/.exec(message);
	return match ? Number(match[1]) : null;
}

async function runElectronBenchmark(
	options: GlobalSearchBenchmarkOptions,
	environment: GlobalSearchBenchmarkEnvironment,
): Promise<{ reportPath: string; assertPasses: boolean }> {
	console.info('GH-67 benchmark: building harness app (VITE_GLOBAL_SEARCH_HARNESS=1)…');
	buildHarnessApp();

	const executablePath = resolveElectronExecutable();
	const isLowEnd = options.profile === 'low-end';

	let electronApp: ElectronApplication | undefined;
	try {
		console.info(`GH-67 benchmark: launching Electron (${executablePath})…`);
		electronApp = await _electron.launch({
			executablePath,
			args: [
				'.',
				...(isLowEnd
					? [
							`--js-flags=--max-old-space-size=${LOW_END_HEAP_CAP_BYTES / (1024 * 1024)}`,
						]
					: []),
			],
			cwd: process.cwd(),
			// NODE_ENV=production pins the app://localhost/ production path —
			// the dev path would load http://localhost:5173, which the spec
			// forbids outright.
			env: {
				...process.env,
				VITE_GLOBAL_SEARCH_HARNESS: '1',
				NODE_ENV: 'production',
			},
		});
	} catch (error) {
		// Honest launch-attempt evidence: the command, the real exit code and
		// the captured log — never a guessed reason.
		const message = error instanceof Error ? error.message : String(error);
		const attempt: GlobalSearchBenchmarkAttempt = {
			command: [executablePath, '.'],
			exitCode: extractExitCode(message),
			log: message,
		};
		console.error(
			`GH-67 benchmark: electron launch failed (exit ${attempt.exitCode ?? 'n/a'}): ${message}`,
		);
		throw new ElectronLaunchError(message, attempt);
	}

	try {
		// Record OS/Electron/Chromium versions from the ACTUAL main process.
		const versions = await electronApp.evaluate(async () => ({
			electron: process.versions.electron,
			chrome: process.versions.chrome,
			node: process.versions.node,
		}));
		environment.electronVersion = versions.electron;
		environment.browserVersion = versions.chrome;
		console.info(
			`GH-67 benchmark: Electron ${versions.electron} / Chromium ${versions.chrome} / Node ${versions.node}`,
		);

		const page = await electronApp.firstWindow();

		// Attach the request/worker listeners BEFORE the harness settles: the
		// real worker is created eagerly at harness construction, so a listener
		// attached after waitForHarness would miss it. Requests made before the
		// listener attaches are still recovered below from the Performance
		// resource entries, so the offline gate sees the full app:// load.
		const requests: string[] = [];
		const workerUrls: string[] = [];
		page.on('request', (request) => requests.push(request.url()));
		page.on('worker', (worker) => workerUrls.push(worker.url()));
		// Workers created before the listener attached are still on the page.
		for (const worker of page.workers()) {
			workerUrls.push(worker.url());
		}

		await waitForHarness(page);

		// Real DevTools CPU throttle (4x) for the low-end profile. Electron
		// pages are Chromium under the hood, so CDP works — but if the session
		// is unavailable we record cpuRate 1 honestly rather than faking it.
		let appliedCpuRate = 1;
		if (isLowEnd) {
			try {
				const cdp = await page.context().newCDPSession(page);
				await cdp.send('Emulation.setCPUThrottlingRate', {
					rate: LOW_END_CPU_RATE,
				});
				appliedCpuRate = LOW_END_CPU_RATE;
			} catch (error) {
				console.warn(
					'GH-67 benchmark: CDP CPU throttle unavailable for Electron low-end:',
					error instanceof Error ? error.message : String(error),
				);
			}
		}

		const seed = await page.evaluate(() => {
			const bridge = (
				window as unknown as {
					__gh67GlobalSearchHarness?: HarnessWindow['__gh67GlobalSearchHarness'];
				}
			).__gh67GlobalSearchHarness;
			return bridge?.seed ?? null;
		});
		if (seed !== 'gh67-v1') {
			throw new Error(`GH-67 benchmark: unexpected harness seed ${seed}`);
		}

		const corpus = await page.evaluate((size) => {
			const bridge = (
				window as unknown as {
					__gh67GlobalSearchHarness?: HarnessWindow['__gh67GlobalSearchHarness'];
				}
			).__gh67GlobalSearchHarness;
			if (!bridge) throw new Error('GH-67 benchmark: harness bridge missing');
			return bridge.loadCorpus(size);
		}, options.size);
		console.info('GH-67 benchmark: corpus loaded', corpus);

		await page.evaluate(() => {
			(
				window as unknown as {
					__gh67GlobalSearchHarness?: HarnessWindow['__gh67GlobalSearchHarness'];
				}
			).__gh67GlobalSearchHarness?.resetLongTasks();
		});

		await openSearchPanel(page);

		console.info('GH-67 benchmark: warmup run…');
		await runUISample(page, BENCHMARK_QUERY, false);

		const samples: GlobalSearchBenchmarkSample[] = [];
		for (let index = 0; index < MEASURED_SAMPLES; index += 1) {
			const cancelled = index === MEASURED_SAMPLES - 1;
			let run = await runUISample(page, BENCHMARK_QUERY, cancelled);

			if (cancelled && !run.cancelled) {
				console.info(
					'GH-67 benchmark: cancel landed after completion — dropping prepared sources for a cold cancellation window',
				);
				await page.evaluate(() => {
					const bridge = (
						window as unknown as {
							__gh67GlobalSearchHarness?: HarnessWindow['__gh67GlobalSearchHarness'];
						}
					).__gh67GlobalSearchHarness;
					bridge?.dropPreparedSources?.();
				});
				run = await runUISample(page, BENCHMARK_QUERY, true);
				if (!run.cancelled) {
					throw new Error(
						'GH-67 benchmark: cancellation sample completed before the cancel landed even on the cold path',
					);
				}
			}

			samples.push({
				index,
				indexingMs: run.indexingMs,
				firstPageMs: run.firstPageMs,
				totalMs: run.totalMs,
				cancelled: run.cancelled,
				cancellationMs: run.cancellationMs,
			});
			console.info(
				`GH-67 benchmark: sample ${index}${cancelled ? ' (cancelled)' : ''} indexing=${run.indexingMs.toFixed(0)}ms firstPage=${run.firstPageMs.toFixed(0)}ms total=${run.totalMs.toFixed(0)}ms${run.cancelled ? ` cancel=${run.cancellationMs?.toFixed(0)}ms` : ''}`,
			);
		}

		const [longTasks, memory, workerUsed] = await page.evaluate(async () => {
			const bridge = (
				window as unknown as {
					__gh67GlobalSearchHarness?: HarnessWindow['__gh67GlobalSearchHarness'];
				}
			).__gh67GlobalSearchHarness;
			if (!bridge) throw new Error('GH-67 benchmark: harness bridge missing');
			const [lt, mem] = await Promise.all([
				Promise.resolve(bridge.getLongTasks()),
				bridge.getMemory(),
			]);
			return [lt, mem, bridge.workerUsed] as const;
		});

		const cancelledSample = samples.find((sample) => sample.cancelled);
		// Recover requests made before the listener attached (the app:// boot
		// load, the worker script, fonts, …) from the Performance resource
		// entries, so the offline gate covers the FULL page load, not only the
		// requests observed after firstWindow resolved.
		const resourceUrls = await page.evaluate(() =>
			performance
				.getEntriesByType('resource')
				.map((entry) => entry.name)
				.filter((name) => !name.startsWith('data:')),
		);
		const allRequestUrls = [...new Set([...requests, ...resourceUrls])];
		const measurements: GlobalSearchBenchmarkMeasurements = {
			query: BENCHMARK_QUERY,
			warmupSamples: WARMUP_SAMPLES,
			samples,
			longTaskMaxMs: longTasks.maxMs,
			longTasksObserved: longTasks.observed,
			longTaskObserverAvailable: longTasks.available,
			longTaskUnavailableReason: longTasks.reason,
			cancellation: {
				observed: cancelledSample !== undefined,
				ms: cancelledSample?.cancellationMs ?? -1,
			},
			memory: {
				available: memory.available,
				measureUasBytes: memory.measureUasBytes,
				jsHeapUsedBytes: memory.jsHeapUsedBytes,
				reason: memory.reason,
			},
			network: {
				requests: allRequestUrls.length,
				nonLocalRequests: allRequestUrls.filter(
					(url) => !url.startsWith(ELECTRON_LOCAL_PREFIX),
				).length,
			},
			worker: {
				used: workerUsed,
				url: workerUrls[0] ?? null,
			},
			throttle: {
				cpuRate: appliedCpuRate,
				heapCapBytes: isLowEnd ? LOW_END_HEAP_CAP_BYTES : null,
			},
		};

		const report = createExecutedGlobalSearchBenchmarkReport(
			options,
			environment,
			measurements,
			process.argv,
		);
		const reportPath = writeReport(options.report, report);
		const { assertPasses, gates } = evaluateGlobalSearchBenchmarkGates(report);
		printGateSummary(gates);
		return { reportPath, assertPasses };
	} finally {
		await electronApp?.close();
	}
}

function writeReport(reportPath: string, report: unknown): string {
	const absolute = resolve(reportPath);
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`);
	console.info(`GH-67 benchmark report written to ${absolute}`);
	return absolute;
}

async function main(): Promise<void> {
	let options: GlobalSearchBenchmarkOptions;
	try {
		options = parseGlobalSearchBenchmarkArgs(process.argv.slice(2));
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
		return;
	}

	const environment = await collectEnvironment();

	if (options.target === 'electron') {
		try {
			const { reportPath, assertPasses } = await runElectronBenchmark(
				options,
				environment,
			);
			console.info(
				`GH-67 benchmark: ${assertPasses ? 'ALL GATES PASS' : 'GATE FAILURES'} → ${reportPath}`,
			);
			if (options.assert && !assertPasses) process.exitCode = 1;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`GH-67 benchmark failed: ${message}`);
			// Fail closed with honest attempt evidence (command + exit code +
			// log) when the host could not run Electron — never guessed.
			const report = createUnavailableGlobalSearchBenchmarkReport(
				options,
				environment,
				process.argv,
				error instanceof ElectronLaunchError ? error.attempt : undefined,
			);
			report.scenario = {
				status: 'unavailable',
				reason: message,
			};
			writeReport(options.report, report);
			process.exitCode = 1;
		}
		return;
	}

	try {
		const { reportPath, assertPasses } = await runWebBenchmark(
			options,
			environment,
		);
		console.info(
			`GH-67 benchmark: ${assertPasses ? 'ALL GATES PASS' : 'GATE FAILURES'} → ${reportPath}`,
		);
		if (options.assert && !assertPasses) process.exitCode = 1;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`GH-67 benchmark failed: ${message}`);
		// Fail closed: write an honest unavailable report (never fabricated).
		const report = createUnavailableGlobalSearchBenchmarkReport(
			options,
			environment,
			process.argv,
		);
		report.scenario = {
			status: 'unavailable',
			reason: message,
		};
		writeReport(options.report, report);
		process.exitCode = 1;
	}
}

void main();

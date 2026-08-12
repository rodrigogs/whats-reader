import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { cpus, totalmem } from 'node:os';
import { spawnSync } from 'node:child_process';
import {
	createUnavailableGlobalSearchBenchmarkReport,
	parseGlobalSearchBenchmarkArgs,
	type GlobalSearchBenchmarkEnvironment,
} from '../src/lib/global-search/benchmark-contract';

function main() {
	try {
		const options = parseGlobalSearchBenchmarkArgs(process.argv.slice(2));
		const environment = collectEnvironment();
		const report = createUnavailableGlobalSearchBenchmarkReport(
			options,
			environment,
			process.argv,
		);

		mkdirSync(dirname(options.report), { recursive: true });
		writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`);
		console.info(`GH-67 benchmark report written to ${options.report}`);

		if (options.assert) {
			console.error(
				'GH-67 benchmark assertion failed: scenario unavailable; no metrics were fabricated.',
			);
			process.exitCode = 1;
		}
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}

function collectEnvironment(): GlobalSearchBenchmarkEnvironment {
	return {
		commit: readGitCommit(),
		nodeVersion: process.version,
		platform: `${process.platform}-${process.arch}`,
		logicalCpus: cpus().length,
		totalRamBytes: totalmem(),
	};
}

function readGitCommit(): string {
	const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
		encoding: 'utf8',
	});
	return result.status === 0 ? result.stdout.trim() : 'unavailable';
}

main();

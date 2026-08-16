import { describe, expect, it } from 'vitest';
import {
	createUnavailableGlobalSearchBenchmarkReport,
	parseGlobalSearchBenchmarkArgs,
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

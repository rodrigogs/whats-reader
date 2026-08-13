import { describe, expect, it } from 'vitest';
import {
	decideQuotaGate,
	QUOTA_MIN_FREE_BYTES,
	QUOTA_USAGE_LIMIT_RATIO,
} from './storage-estimate';

describe('GH-67 storage estimate / quota gate contract', () => {
	it('allows indexing when projection stays under 80% and leaves >=100 MiB free', () => {
		const decision = decideQuotaGate(
			{ usage: 0, quota: 1 * 1024 ** 3 },
			0,
			10 * 1024 * 1024,
		);
		expect(decision.allowed).toBe(true);
		expect(decision.reason).toBe('ok');
	});

	it('refuses when the projection exceeds 80% of quota', () => {
		const quota = 1 * 1024 ** 3;
		const decision = decideQuotaGate(
			{ usage: quota * 0.5, quota },
			0,
			quota * 0.4, // 0.5 + 0.4 = 0.9 > 0.8
		);
		expect(decision.allowed).toBe(false);
		expect(decision.reason).toBe('over-usage-ratio');
	});

	it('refuses when projected free space drops below 100 MiB', () => {
		const quota = 200 * 1024 * 1024; // 200 MiB
		const decision = decideQuotaGate(
			{ usage: 50 * 1024 * 1024, quota },
			0,
			60 * 1024 * 1024, // projected free = 200 - 50 - 60 = 90 MiB < 100
		);
		expect(decision.allowed).toBe(false);
		expect(decision.reason).toBe('under-free-minimum');
	});

	it('fails closed when storage estimate is unavailable', () => {
		const decision = decideQuotaGate(null, 0, 1024);
		expect(decision.allowed).toBe(false);
		expect(decision.reason).toBe('estimate-unavailable');
	});

	it('subtracts existing generation bytes before projecting', () => {
		const quota = 1 * 1024 ** 3;
		// usage already counts the old generation; projecting a same-sized new
		// generation should net to roughly the same usage, not double it.
		const decision = decideQuotaGate(
			{ usage: 100 * 1024 * 1024, quota },
			50 * 1024 * 1024, // existing
			50 * 1024 * 1024, // added
		);
		expect(decision.allowed).toBe(true);
		expect(decision.projectedUsage).toBe(100 * 1024 * 1024);
	});

	it('exposes the configured thresholds as constants', () => {
		expect(QUOTA_USAGE_LIMIT_RATIO).toBe(0.8);
		expect(QUOTA_MIN_FREE_BYTES).toBe(100 * 1024 * 1024);
	});
});

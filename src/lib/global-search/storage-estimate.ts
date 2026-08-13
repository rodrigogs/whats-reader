/**
 * GH-67 §6 step 2 — Storage projection gate.
 *
 * Before building a generation we estimate the IndexedDB quota and refuse to
 * start indexing if the projection would exceed 80% of the quota or leave less
 * than 100 MiB free. On failure the previous generation stays untouched and no
 * staging data is written.
 *
 * `navigator.storage.estimate()` is only available in secure browsers; when it
 * is absent the gate fails closed (refuses to start) rather than guessing.
 */

export const QUOTA_USAGE_LIMIT_RATIO = 0.8;
export const QUOTA_MIN_FREE_BYTES = 100 * 1024 * 1024; // 100 MiB

export type StorageEstimateLike = {
	usage: number;
	quota: number;
};

export type StorageEstimateProvider = () => Promise<StorageEstimateLike | null>;

export type QuotaGateDecision = {
	allowed: boolean;
	reason:
		| 'ok'
		| 'estimate-unavailable'
		| 'over-usage-ratio'
		| 'under-free-minimum';
	usage: number;
	quota: number;
	projectedUsage: number;
};

/**
 * Decide whether indexing `projectedAddedBytes` may proceed.
 *
 * `existingBytes` is the bytes already occupied by the previous generation's
 * shards+manifest (which will be cleaned up after commit, but we conservatively
 * count them until commit succeeds). `projectedAddedBytes` is the estimated
 * size of the new generation.
 */
export function decideQuotaGate(
	estimate: StorageEstimateLike | null,
	existingBytes: number,
	projectedAddedBytes: number,
): QuotaGateDecision {
	if (!estimate || estimate.quota <= 0) {
		return {
			allowed: false,
			reason: 'estimate-unavailable',
			usage: estimate?.usage ?? 0,
			quota: estimate?.quota ?? 0,
			projectedUsage: 0,
		};
	}

	const projectedUsage = estimate.usage - existingBytes + projectedAddedBytes;
	const projectedFree = estimate.quota - projectedUsage;

	if (projectedUsage / estimate.quota > QUOTA_USAGE_LIMIT_RATIO) {
		return {
			allowed: false,
			reason: 'over-usage-ratio',
			usage: estimate.usage,
			quota: estimate.quota,
			projectedUsage,
		};
	}

	if (projectedFree < QUOTA_MIN_FREE_BYTES) {
		return {
			allowed: false,
			reason: 'under-free-minimum',
			usage: estimate.usage,
			quota: estimate.quota,
			projectedUsage,
		};
	}

	return {
		allowed: true,
		reason: 'ok',
		usage: estimate.usage,
		quota: estimate.quota,
		projectedUsage,
	};
}

/**
 * Build a provider from the real `navigator.storage.estimate()` API. Returns
 * null if the API is absent (the gate then fails closed).
 */
export function createBrowserStorageEstimateProvider(): StorageEstimateProvider {
	return async () => {
		if (
			typeof navigator === 'undefined' ||
			!navigator.storage ||
			typeof navigator.storage.estimate !== 'function'
		) {
			return null;
		}
		const estimate = await navigator.storage.estimate();
		if (!estimate || estimate.quota === undefined) return null;
		return {
			usage: estimate.usage ?? 0,
			quota: estimate.quota,
		};
	};
}

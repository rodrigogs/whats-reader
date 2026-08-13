import { beforeEach, describe, expect, it } from 'vitest';
import {
	createConsent,
	GLOBAL_SEARCH_CONSENT_COPY_VERSION,
	type GlobalSearchConsent,
} from './consent';
import {
	commitGeneration,
	isGateEnabled,
	listReadyArchives,
	nextGeneration,
	readReadyGeneration,
	startupCleanup,
} from './index-lifecycle';
import {
	commitKey,
	type GlobalSearchDocument,
	manifestKey,
	parseShardKey,
	shardKey,
	stagingKey,
} from './manifest';
import {
	createInMemoryGlobalSearchStorage,
	type GlobalSearchStorage,
} from './storage';
import type { StorageEstimateProvider } from './storage-estimate';

function makeDoc(
	ordinal: number,
	content = `message ${ordinal}`,
): GlobalSearchDocument {
	return {
		archiveId: 'a1',
		ordinal,
		messageId: `m${ordinal}`,
		timestamp: ordinal,
		sender: 'Ana',
		content,
	};
}

function validConsent(archiveId: string): GlobalSearchConsent {
	return createConsent(archiveId, 'keep-locally');
}

const GENEROUS_ESTIMATE: StorageEstimateProvider = async () => ({
	usage: 0,
	quota: 10 * 1024 ** 3, // 10 GiB — always allows
});

type AtomicPublicationStorage = GlobalSearchStorage & {
	setMany(entries: readonly [string, unknown][]): Promise<void>;
};

function failAtomicPublication(
	storage: ReturnType<typeof createInMemoryGlobalSearchStorage>,
): AtomicPublicationStorage {
	return {
		...storage,
		async setMany(): Promise<void> {
			throw new Error('injected atomic publication failure');
		},
	};
}

function failOldGenerationCleanup(
	storage: ReturnType<typeof createInMemoryGlobalSearchStorage>,
): AtomicPublicationStorage {
	return {
		...storage,
		async del(key: string): Promise<void> {
			if (key === shardKey('a1', 1, 0)) {
				throw new Error('injected cleanup failure');
			}
			await storage.del(key);
		},
		async setMany(entries: readonly [string, unknown][]): Promise<void> {
			for (const [key, value] of entries) await storage.set(key, value);
		},
	};
}

describe('GH-67 index lifecycle — gate disabled fails closed', () => {
	it('commits nothing and reads nothing when the gate is false', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		const docs = [makeDoc(0), makeDoc(1)];
		const outcome = await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: docs,
			consent: validConsent('a1'),
			gate: false,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});
		expect(outcome.status).toBe('skipped-gate-disabled');
		expect(storage.snapshot().size).toBe(0);
		expect(await readReadyGeneration(storage, 'a1', false)).toBeNull();
	});

	it('isGateEnabled is true only for an explicit true', () => {
		expect(isGateEnabled(true)).toBe(true);
		expect(isGateEnabled(false)).toBe(false);
	});
});

describe('GH-67 index lifecycle — consent gate', () => {
	it('commits nothing without valid consent', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		const outcome = await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [makeDoc(0)],
			consent: undefined,
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});
		expect(outcome.status).toBe('skipped-no-consent');
		expect(storage.snapshot().size).toBe(0);
	});

	it('commits nothing for session-only consent', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		const outcome = await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [makeDoc(0)],
			consent: createConsent('a1', 'session-only'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});
		expect(outcome.status).toBe('skipped-no-consent');
	});

	it('rejects consent for the wrong archiveId', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		const outcome = await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [makeDoc(0)],
			consent: validConsent('a2'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});
		expect(outcome.status).toBe('skipped-no-consent');
	});
});

describe('GH-67 index lifecycle — atomic commit', () => {
	it('commits a generation and exposes it via readReadyGeneration', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		const docs = Array.from({ length: 10 }, (_, i) => makeDoc(i));
		const outcome = await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Family Group',
			documents: docs,
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});
		expect(outcome.status).toBe('committed');
		if (outcome.status !== 'committed') return;

		expect(outcome.manifest.state).toBe('ready');
		expect(outcome.manifest.archiveId).toBe('a1');
		expect(outcome.manifest.chatTitle).toBe('Family Group');
		expect(outcome.manifest.indexedDocumentCount).toBe(10);
		expect(outcome.manifest.includes).toEqual({
			content: true,
			sender: true,
			transcriptions: false,
		});
		expect(outcome.manifest.schemaVersion).toBe(1);
		expect(outcome.manifest.sourceFingerprint).toMatch(/^[0-9a-f]{64}$/);
		expect(outcome.manifest.indexedAt).toBeTypeOf('number');

		const ready = await readReadyGeneration(storage, 'a1', true);
		expect(ready).not.toBeNull();
		expect(ready?.manifest.state).toBe('ready');
		const allDocs = ready?.shards.flat() ?? [];
		expect(allDocs).toHaveLength(10);
		expect(allDocs[0]).toMatchObject({
			archiveId: 'a1',
			ordinal: 0,
			messageId: 'm0',
		});
	});

	it('drops the staging manifest after commit (only the ready manifest remains)', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [makeDoc(0)],
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});
		expect(storage.snapshot().has(stagingKey('a1', 1))).toBe(false);
		expect(storage.snapshot().has(manifestKey('a1'))).toBe(true);
	});

	it('cleans up the previous generation shards after commit', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		const docs1 = [makeDoc(0)];
		const docs2 = [makeDoc(0, 'updated')];

		await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: docs1,
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});
		const gen1ShardKeys = [...storage.snapshot().keys()].filter(
			(k) => parseShardKey(k)?.generation === 1,
		);
		expect(gen1ShardKeys.length).toBe(1);

		await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: docs2,
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});

		// Gen-1 shards gone, gen-2 shard present.
		const gen1Survivors = [...storage.snapshot().keys()].filter(
			(k) => parseShardKey(k)?.generation === 1,
		);
		expect(gen1Survivors).toHaveLength(0);
		const gen2Shards = [...storage.snapshot().keys()].filter(
			(k) => parseShardKey(k)?.generation === 2,
		);
		expect(gen2Shards.length).toBe(1);
	});
});

describe('GH-67 index lifecycle — rollback preserves previous generation', () => {
	it('preserves the prior ready generation when atomic public publication fails', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [makeDoc(0, 'generation one')],
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});

		const outcome = await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [makeDoc(0, 'generation two')],
			consent: validConsent('a1'),
			gate: true,
			storage: failAtomicPublication(storage),
			estimateProvider: GENEROUS_ESTIMATE,
		});

		expect(outcome).toMatchObject({
			status: 'failed',
			previousGenerationPreserved: true,
		});
		const ready = await readReadyGeneration(storage, 'a1', true);
		expect(ready?.manifest.generation).toBe(1);
		expect(ready?.shards.flat().map((document) => document.content)).toEqual([
			'generation one',
		]);
		expect(storage.snapshot().get(commitKey('a1'))).toMatchObject({
			readyGeneration: 1,
		});
		expect(storage.snapshot().get(manifestKey('a1'))).toMatchObject({
			generation: 1,
			state: 'ready',
		});
		expect(storage.snapshot().has(stagingKey('a1', 2))).toBe(false);
		expect(
			Array.from(storage.snapshot().keys()).some(
				(key) => parseShardKey(key)?.generation === 2,
			),
		).toBe(false);
	});

	it('keeps generation two committed and readable when post-publication cleanup fails', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [makeDoc(0, 'generation one')],
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});

		const outcome = await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [makeDoc(0, 'generation two')],
			consent: validConsent('a1'),
			gate: true,
			storage: failOldGenerationCleanup(storage),
			estimateProvider: GENEROUS_ESTIMATE,
		});

		expect(outcome).toMatchObject({ status: 'committed' });
		const ready = await readReadyGeneration(storage, 'a1', true);
		expect(ready?.manifest.generation).toBe(2);
		expect(ready?.shards.flat().map((document) => document.content)).toEqual([
			'generation two',
		]);
		expect(storage.snapshot().has(shardKey('a1', 1, 0))).toBe(true);
	});

	it('preserves the ready generation when quota is refused', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		// First commit succeeds with a generous estimate.
		await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [makeDoc(0), makeDoc(1)],
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});
		const readyBefore = await readReadyGeneration(storage, 'a1', true);
		expect(readyBefore?.manifest.generation).toBe(1);

		// Second commit refused by quota.
		const stingy: StorageEstimateProvider = async () => ({
			usage: 0,
			quota: 10, // tiny quota → always refused
		});
		const outcome = await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [makeDoc(0, 'changed')],
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: stingy,
		});
		expect(outcome.status).toBe('refused-quota');

		// Previous generation untouched.
		const readyAfter = await readReadyGeneration(storage, 'a1', true);
		expect(readyAfter?.manifest.generation).toBe(1);
		expect(readyAfter?.shards.flat()).toHaveLength(2);
	});

	it('fails closed and preserves the previous generation when estimate is unavailable', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [makeDoc(0)],
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});

		const noEstimate: StorageEstimateProvider = async () => null;
		const outcome = await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [makeDoc(0, 'changed')],
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: noEstimate,
		});
		expect(outcome.status).toBe('refused-quota');
		const ready = await readReadyGeneration(storage, 'a1', true);
		expect(ready?.manifest.generation).toBe(1);
	});

	it('fails closed on an empty document set without touching storage', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		const outcome = await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [],
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});
		expect(outcome.status).toBe('failed');
		expect(storage.snapshot().size).toBe(0);
	});
});

describe('GH-67 index lifecycle — stale / corrupt detection', () => {
	it('returns null for a manifest with a mismatched schema version (stale)', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [makeDoc(0)],
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});
		// Tamper: bump schemaVersion on the manifest.
		const manifest = storage.snapshot().get(manifestKey('a1')) as Record<
			string,
			unknown
		>;
		storage
			.snapshot()
			.set(manifestKey('a1'), { ...manifest, schemaVersion: 999 });
		expect(await readReadyGeneration(storage, 'a1', true)).toBeNull();
	});

	it('returns null when a shard is missing (corrupt generation)', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [makeDoc(0)],
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});
		// Delete the only shard.
		storage.snapshot().delete(shardKey('a1', 1, 0));
		expect(await readReadyGeneration(storage, 'a1', true)).toBeNull();
	});

	it('returns null when the commit pointer checksum does not match recomputed checksum', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [makeDoc(0)],
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});
		// Tamper: corrupt a shard's content so recomputed checksum differs.
		const shardKeyStr = shardKey('a1', 1, 0);
		const docs = storage.snapshot().get(shardKeyStr) as GlobalSearchDocument[];
		docs[0] = { ...docs[0], content: 'TAMPERED' };
		storage.snapshot().set(shardKeyStr, docs);
		expect(await readReadyGeneration(storage, 'a1', true)).toBeNull();
	});

	it('returns null for a manifest in a non-ready state', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [makeDoc(0)],
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});
		const manifest = storage.snapshot().get(manifestKey('a1')) as Record<
			string,
			unknown
		>;
		storage.snapshot().set(manifestKey('a1'), { ...manifest, state: 'stale' });
		expect(await readReadyGeneration(storage, 'a1', true)).toBeNull();
	});
});

describe('GH-67 index lifecycle — startup cleanup', () => {
	beforeEach(() => {
		// Ensure copy version is current for all tests in this block.
		expect(GLOBAL_SEARCH_CONSENT_COPY_VERSION).toBe(1);
	});

	it('deletes staging manifests and orphan shards, preserves the committed generation', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [makeDoc(0)],
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});

		// Simulate a crashed prior run: leave a staging manifest + its shards.
		storage.snapshot().set(stagingKey('a1', 5), { state: 'staging' });
		storage.snapshot().set(shardKey('a1', 5, 0), [makeDoc(99)]);
		storage.snapshot().set(shardKey('a1', 5, 1), [makeDoc(100)]);

		const report = await startupCleanup(storage, true);
		expect(report.stagingManifestsDeleted).toBe(1);
		expect(report.orphanShardsDeleted).toBeGreaterThanOrEqual(2);
		expect(storage.snapshot().has(stagingKey('a1', 5))).toBe(false);
		expect(storage.snapshot().has(shardKey('a1', 5, 0))).toBe(false);
		expect(storage.snapshot().has(shardKey('a1', 5, 1))).toBe(false);

		// Committed generation survives.
		const ready = await readReadyGeneration(storage, 'a1', true);
		expect(ready?.manifest.generation).toBe(1);
	});

	it('marks an incompatible manifest stale instead of reading or deleting it', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [makeDoc(0)],
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});
		// Tamper schema version to simulate an incompatible index from a future build.
		const manifest = storage.snapshot().get(manifestKey('a1')) as Record<
			string,
			unknown
		>;
		storage
			.snapshot()
			.set(manifestKey('a1'), { ...manifest, schemaVersion: 999 });

		const report = await startupCleanup(storage, true);
		expect(report.manifestsMarkedStale).toBe(1);
		const after = storage.snapshot().get(manifestKey('a1')) as Record<
			string,
			unknown
		>;
		expect(after.state).toBe('stale');
		expect(await readReadyGeneration(storage, 'a1', true)).toBeNull();
	});

	it('is a no-op when the gate is disabled', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		storage.snapshot().set(stagingKey('a1', 1), { state: 'staging' });
		const report = await startupCleanup(storage, false);
		expect(report.stagingManifestsDeleted).toBe(0);
		expect(storage.snapshot().has(stagingKey('a1', 1))).toBe(true);
	});
});

describe('GH-67 index lifecycle — helpers', () => {
	it('nextGeneration always increases from the higher of ready/staging', () => {
		expect(nextGeneration(null, null)).toBe(1);
		expect(nextGeneration(3, null)).toBe(4);
		expect(nextGeneration(null, 7)).toBe(8);
		expect(nextGeneration(3, 7)).toBe(8);
	});

	it('listReadyArchives returns only version-compatible ready manifests', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'A',
			documents: [makeDoc(0)],
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});
		// Make a second archive with a ready manifest too (reuse makeDoc but change archiveId).
		const doc2 = { ...makeDoc(0), archiveId: 'a2' };
		await commitGeneration({
			archiveId: 'a2',
			chatTitle: 'B',
			documents: [doc2],
			consent: validConsent('a2'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});
		const ready = await listReadyArchives(storage, true);
		expect(ready.map((m) => m.archiveId).sort()).toEqual(['a1', 'a2']);
		expect(await listReadyArchives(storage, false)).toEqual([]);
	});

	it('listReadyArchives excludes a ready manifest not named by its commit pointer', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'A',
			documents: [makeDoc(0)],
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});
		const manifest = storage.snapshot().get(manifestKey('a1')) as Record<
			string,
			unknown
		>;
		storage.snapshot().set(manifestKey('a1'), { ...manifest, generation: 2 });

		expect(await listReadyArchives(storage, true)).toEqual([]);
	});
});

describe('GH-67 index lifecycle — commit pointer is the atomic switch', () => {
	it('never writes a commit pointer until every shard + manifest is valid', async () => {
		const storage = createInMemoryGlobalSearchStorage();
		await commitGeneration({
			archiveId: 'a1',
			chatTitle: 'Chat',
			documents: [makeDoc(0)],
			consent: validConsent('a1'),
			gate: true,
			storage,
			estimateProvider: GENEROUS_ESTIMATE,
		});
		// The commit pointer exists and references generation 1 with shard count 1.
		const pointer = storage.snapshot().get(commitKey('a1')) as {
			readyGeneration: number;
			shardCount: number;
		};
		expect(pointer.readyGeneration).toBe(1);
		expect(pointer.shardCount).toBe(1);
	});
});

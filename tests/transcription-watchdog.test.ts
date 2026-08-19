import assert from 'node:assert/strict';
import { afterEach, describe, it, vi } from 'vitest';
import {
	postIfTranscriptionRequestAccepted,
	TranscriptionRequestManager,
	TranscriptionServiceError,
} from '../src/lib/transcription-request-manager.ts';

afterEach(() => {
	vi.useRealTimers();
});

describe('TranscriptionRequestManager', () => {
	it('rejects a concurrent duplicate without replacing the original request', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		const manager = new TranscriptionRequestManager(100);
		let workerPosts = 0;
		let firstResolved = false;
		const first = new Promise<string>((resolve, reject) => {
			const accepted = manager.add(
					'message-1',
					(text) => {
						firstResolved = true;
						resolve(text);
					},
					reject,
			);
			assert.equal(accepted, true);
			postIfTranscriptionRequestAccepted(accepted, () => {
				workerPosts += 1;
			});
		});

		vi.advanceTimersByTime(50);
		const duplicate = new Promise<string>((resolve, reject) => {
			const accepted = manager.add('message-1', resolve, reject);
			assert.equal(accepted, false);
			postIfTranscriptionRequestAccepted(accepted, () => {
				workerPosts += 1;
			});
		});

		await assert.rejects(duplicate, { code: 'TRANSCRIPTION_DUPLICATE_REQUEST' });
		assert.equal(workerPosts, 1);
		assert.equal(manager.size, 1);
		assert.equal(firstResolved, false);

		vi.advanceTimersByTime(50);
		await assert.rejects(first, { code: 'TRANSCRIPTION_TIMEOUT' });
		assert.equal(firstResolved, false);
		assert.equal(manager.size, 0);
	});

	it('expires a silent request after the inactivity timeout and removes it', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		let timedOut = false;
		const manager = new TranscriptionRequestManager(90_000);
		const rejection = new Promise<unknown>((_resolve, reject) => {
			manager.add('message-1', () => undefined, reject, () => {
				timedOut = true;
			});
		});

		vi.advanceTimersByTime(90_000);

		await assert.rejects(rejection, (error: unknown) => {
			assert.ok(error instanceof TranscriptionServiceError);
			assert.equal(error.code, 'TRANSCRIPTION_TIMEOUT');
			return true;
		});
		assert.equal(manager.size, 0);
		assert.equal(timedOut, true);
	});

	it('renews pending watchdogs when the worker reports progress', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		const manager = new TranscriptionRequestManager(90_000);
		const rejection = new Promise<unknown>((_resolve, reject) => {
			manager.add('message-1', () => undefined, reject, () => undefined);
		});

		vi.advanceTimersByTime(89_000);
		manager.renewAll();
		vi.advanceTimersByTime(89_000);
		assert.equal(manager.size, 1);
		vi.advanceTimersByTime(1_000);

		await assert.rejects(rejection, { code: 'TRANSCRIPTION_TIMEOUT' });
	});

	it('rejects every pending request for a model error', async () => {
		const manager = new TranscriptionRequestManager(90_000);
		const first = new Promise<unknown>((_resolve, reject) =>
			manager.add('first', () => undefined, reject, () => undefined),
		);
		const second = new Promise<unknown>((_resolve, reject) =>
			manager.add('second', () => undefined, reject, () => undefined),
		);

		manager.rejectAll(
			new TranscriptionServiceError('TRANSCRIPTION_MODEL_ERROR', 'Model failed'),
		);

		await Promise.all([
			assert.rejects(first, { code: 'TRANSCRIPTION_MODEL_ERROR' }),
			assert.rejects(second, { code: 'TRANSCRIPTION_MODEL_ERROR' }),
		]);
		assert.equal(manager.size, 0);
	});

	it('rejects every pending request for a worker error', async () => {
		const manager = new TranscriptionRequestManager(90_000);
		const rejection = new Promise<unknown>((_resolve, reject) =>
			manager.add('message-1', () => undefined, reject, () => undefined),
		);

		manager.rejectAll(
			new TranscriptionServiceError('TRANSCRIPTION_WORKER_ERROR', 'Worker failed'),
		);

		await assert.rejects(rejection, { code: 'TRANSCRIPTION_WORKER_ERROR' });
		assert.equal(manager.size, 0);
	});

	it('ignores a late callback after a request was rejected', async () => {
		const manager = new TranscriptionRequestManager(90_000);
		let resolved = 0;
		let rejected = 0;
		manager.add(
			'message-1',
			() => {
				resolved += 1;
			},
			() => {
				rejected += 1;
			},
			() => undefined,
		);

		manager.reject(
			'message-1',
			new TranscriptionServiceError('TRANSCRIPTION_MODEL_ERROR', 'Model failed'),
		);

		assert.equal(manager.resolve('message-1', 'late result'), false);
		assert.equal(resolved, 0);
		assert.equal(rejected, 1);
	});

	it('accepts a retry after a failed request was removed', () => {
		const manager = new TranscriptionRequestManager(90_000);
		manager.add('message-1', () => undefined, () => undefined, () => undefined);
		manager.reject(
			'message-1',
			new TranscriptionServiceError('TRANSCRIPTION_WORKER_ERROR', 'Worker failed'),
		);

		let retryResolved = false;
		manager.add(
			'message-1',
			() => {
				retryResolved = true;
			},
			() => undefined,
			() => undefined,
		);
		manager.resolve('message-1', 'retry result');

		assert.equal(retryResolved, true);
		assert.equal(manager.size, 0);
	});
});

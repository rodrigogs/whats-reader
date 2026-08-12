export type TranscriptionErrorCode =
	| 'TRANSCRIPTION_TIMEOUT'
	| 'TRANSCRIPTION_WORKER_ERROR'
	| 'TRANSCRIPTION_MODEL_ERROR'
	| 'TRANSCRIPTION_DUPLICATE_REQUEST';

export class TranscriptionServiceError extends Error {
	constructor(
		public readonly code: TranscriptionErrorCode,
		message: string,
	) {
		super(message);
		this.name = 'TranscriptionServiceError';
	}
}

export function postIfTranscriptionRequestAccepted(
	accepted: boolean,
	post: () => void,
): void {
	if (accepted) post();
}

interface PendingTranscription {
	resolve: (text: string) => void;
	reject: (error: Error) => void;
	timeoutId: number | ReturnType<typeof setTimeout>;
	onTimeout: (messageId: string) => void;
}

export class TranscriptionRequestManager {
	private readonly pending = new Map<string, PendingTranscription>();

	constructor(private readonly inactivityTimeoutMs: number) {}

	get size(): number {
		return this.pending.size;
	}

	add(
		messageId: string,
		resolve: (text: string) => void,
		reject: (error: Error) => void,
		onTimeout?: (messageId: string) => void,
	): boolean {
		if (this.pending.has(messageId)) {
			reject(
				new TranscriptionServiceError(
					'TRANSCRIPTION_DUPLICATE_REQUEST',
					'A transcription request is already pending for this message',
				),
			);
			return false;
		}

		const onRequestTimeout = () => {
			if (
				this.reject(
					messageId,
					new TranscriptionServiceError(
						'TRANSCRIPTION_TIMEOUT',
						'Transcription timed out due to worker inactivity',
					),
				)
			) {
				onTimeout?.(messageId);
			}
		};
		const timeoutId = setTimeout(onRequestTimeout, this.inactivityTimeoutMs);

		this.pending.set(messageId, {
			resolve,
			reject,
			timeoutId,
			onTimeout: onRequestTimeout,
		});
		return true;
	}

	renewAll(): void {
		for (const pending of Array.from(this.pending.values())) {
			clearTimeout(pending.timeoutId);
			pending.timeoutId = setTimeout(
				pending.onTimeout,
				this.inactivityTimeoutMs,
			);
		}
	}

	resolve(messageId: string, text: string): boolean {
		const pending = this.take(messageId);
		if (!pending) return false;
		pending.resolve(text);
		return true;
	}

	reject(messageId: string, error: Error): boolean {
		const pending = this.take(messageId);
		if (!pending) return false;
		pending.reject(error);
		return true;
	}

	rejectAll(error: Error): void {
		const pending = Array.from(this.pending.values());
		this.pending.clear();
		for (const request of pending) {
			clearTimeout(request.timeoutId);
			request.reject(error);
		}
	}

	rejectAllExcept(messageId: string, error: Error): void {
		for (const [pendingMessageId, pending] of Array.from(
			this.pending.entries(),
		)) {
			if (pendingMessageId === messageId) continue;
			this.pending.delete(pendingMessageId);
			clearTimeout(pending.timeoutId);
			pending.reject(error);
		}
	}

	private take(messageId: string): PendingTranscription | undefined {
		const pending = this.pending.get(messageId);
		if (!pending) return undefined;
		this.pending.delete(messageId);
		clearTimeout(pending.timeoutId);
		return pending;
	}
}

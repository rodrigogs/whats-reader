/**
 * Audio Transcription Service using Whisper via Transformers.js
 * Runs in a Web Worker to keep UI responsive
 */

import { browser } from '$app/environment';
import {
	postIfTranscriptionRequestAccepted,
	TranscriptionRequestManager,
	TranscriptionServiceError,
} from './transcription-request-manager';

const TRANSCRIPTION_INACTIVITY_TIMEOUT_MS = 90_000;

// Default language for transcription (can be changed by user)
let transcriptionLanguage = $state<string>('portuguese');

// Reactive transcription store - enables search integration
let transcriptionStore = $state<Map<string, string>>(new Map());

// State management
let isModelLoading = $state(false);
let modelLoadProgress = $state(0);
let modelError = $state<string | null>(null);
let isModelReady = $state(false);

// Worker instance
let worker: Worker | null = null;

const pendingTranscriptions = new TranscriptionRequestManager(
	TRANSCRIPTION_INACTIVITY_TIMEOUT_MS,
);

function discardWorker(): void {
	if (worker) worker.terminate();
	worker = null;
	isModelReady = false;
	isModelLoading = false;
	modelLoadProgress = 0;
}

function failPendingTranscriptions(error: TranscriptionServiceError): void {
	pendingTranscriptions.rejectAll(error);
	discardWorker();
}

/**
 * Initialize the transcription worker
 */
function initWorker(): Worker {
	if (worker) return worker;

	const createdWorker = new Worker(
		new URL('./workers/transcription-worker.ts', import.meta.url),
		{ type: 'module' },
	);
	worker = createdWorker;

	createdWorker.onmessage = (event) => {
		if (worker !== createdWorker) return;
		const message = event.data;

		switch (message.type) {
			case 'progress':
				modelLoadProgress = message.progress;
				pendingTranscriptions.renewAll();
				break;
			case 'model-ready':
				isModelReady = true;
				isModelLoading = false;
				modelLoadProgress = 100;
				pendingTranscriptions.renewAll();
				break;
			case 'model-error':
				modelError = message.error;
				failPendingTranscriptions(
					new TranscriptionServiceError(
						'TRANSCRIPTION_MODEL_ERROR',
						message.error,
					),
				);
				break;
			case 'transcription-result': {
				if (
					pendingTranscriptions.resolve(
						message.messageId,
						message.text || '(No speech detected)',
					)
				) {
					// Store in reactive store
					if (message.text) {
						transcriptionStore.set(message.messageId, message.text);
						transcriptionStore = new Map(transcriptionStore);
					}
				}
				break;
			}
			case 'transcription-error': {
				pendingTranscriptions.reject(
					message.messageId,
					new Error(message.error),
				);
				break;
			}
		}
	};

	createdWorker.onerror = (error) => {
		if (worker !== createdWorker) return;
		console.error('Transcription worker error:', error);
		modelError = error.message;
		failPendingTranscriptions(
			new TranscriptionServiceError(
				'TRANSCRIPTION_WORKER_ERROR',
				error.message || 'Transcription worker failed',
			),
		);
	};

	return createdWorker;
}

// Export reactive state
export function getTranscriptionState() {
	return {
		get isModelLoading() {
			return isModelLoading;
		},
		get modelLoadProgress() {
			return modelLoadProgress;
		},
		get modelError() {
			return modelError;
		},
		get isModelReady() {
			return isModelReady;
		},
		get language() {
			return transcriptionLanguage;
		},
	};
}

/**
 * Set the transcription language
 */
export function setTranscriptionLanguage(lang: string): void {
	transcriptionLanguage = lang;
}

/**
 * Get available languages for transcription
 */
export function getAvailableLanguages(): { code: string; name: string }[] {
	return [
		{ code: 'portuguese', name: 'Português' },
		{ code: 'english', name: 'English' },
		{ code: 'spanish', name: 'Español' },
		{ code: 'french', name: 'Français' },
		{ code: 'german', name: 'Deutsch' },
		{ code: 'italian', name: 'Italiano' },
		{ code: 'dutch', name: 'Nederlands' },
		{ code: 'japanese', name: '日本語' },
		{ code: 'chinese', name: '中文' },
		{ code: 'korean', name: '한국어' },
		{ code: 'russian', name: 'Русский' },
		{ code: 'auto', name: 'Auto-detect' },
	];
}

/**
 * Get transcription for a message ID (reactive)
 */
export function getTranscription(messageId: string): string | undefined {
	return transcriptionStore.get(messageId);
}

/**
 * Check if a message has a transcription
 */
export function hasTranscription(messageId: string): boolean {
	return transcriptionStore.has(messageId);
}

/**
 * Get all transcriptions as a plain object (for search worker)
 */
export function getAllTranscriptions(): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, value] of transcriptionStore) {
		result[key] = value;
	}
	return result;
}

/**
 * Get transcriptions for a specific chat (for persistence).
 * Filters by provided message IDs to avoid cross-chat leakage.
 */
export function getTranscriptionsForChat(
	messageIds: string[],
): Record<string, string> {
	const idSet = new Set(messageIds);
	const result: Record<string, string> = {};
	for (const [key, value] of transcriptionStore) {
		if (idSet.has(key)) {
			result[key] = value;
		}
	}
	return result;
}

/**
 * Set transcriptions for a chat (for restoration).
 * Merges into the runtime store keyed by bare messageId.
 */
export function setTranscriptionsForChat(
	transcriptions: Record<string, string>,
): void {
	for (const [messageId, text] of Object.entries(transcriptions)) {
		transcriptionStore.set(messageId, text);
	}
	transcriptionStore = new Map(transcriptionStore);
}

/**
 * Pre-load the Whisper model
 */
export function preloadModel(): void {
	if (!browser || isModelReady || isModelLoading) return;

	isModelLoading = true;
	modelError = null;
	modelLoadProgress = 0;

	const w = initWorker();
	w.postMessage({ type: 'load-model' });
}

/**
 * Fetch and decode audio to Float32Array at 16kHz mono (Whisper's expected format)
 * This must happen on the main thread since AudioContext is not available in workers
 */
async function fetchAndDecodeAudio(url: string): Promise<Float32Array> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch audio: ${response.status}`);
	}
	const arrayBuffer = await response.arrayBuffer();

	// Decode using AudioContext (main thread only)
	const audioContext = new AudioContext({ sampleRate: 16000 });

	try {
		const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

		// If already at 16kHz, just get the channel data
		if (audioBuffer.sampleRate === 16000) {
			return audioBuffer.getChannelData(0);
		}

		// Resample to 16kHz mono using OfflineAudioContext
		const duration = audioBuffer.duration;
		const targetLength = Math.ceil(duration * 16000);
		const offlineCtx = new OfflineAudioContext(1, targetLength, 16000);

		const source = offlineCtx.createBufferSource();
		source.buffer = audioBuffer;
		source.connect(offlineCtx.destination);
		source.start();

		const resampledBuffer = await offlineCtx.startRendering();
		return resampledBuffer.getChannelData(0);
	} finally {
		await audioContext.close();
	}
}

/**
 * Transcribe audio from a URL
 */
export async function transcribeAudio(
	audioUrl: string,
	messageId: string,
): Promise<string> {
	if (!browser) {
		throw new Error('Transcription only available in browser');
	}

	// Check cache first
	if (transcriptionStore.has(messageId)) {
		return transcriptionStore.get(messageId)!;
	}

	// Initialize worker if needed
	const w = initWorker();

	// Start loading model if not already
	if (!isModelReady && !isModelLoading) {
		isModelLoading = true;
		modelError = null;
		modelLoadProgress = 0;
	}

	try {
		// Fetch and decode audio to Float32Array on main thread
		// (AudioContext is not available in workers)
		const audioData = await fetchAndDecodeAudio(audioUrl);

		// Create promise for this transcription
		return new Promise((resolve, reject) => {
			const accepted = pendingTranscriptions.add(
				messageId,
				resolve,
				reject,
				(timedOutMessageId) => {
					pendingTranscriptions.rejectAllExcept(
						timedOutMessageId,
						new TranscriptionServiceError(
							'TRANSCRIPTION_WORKER_ERROR',
							'Transcription worker was reset after an inactive request',
						),
					);
					discardWorker();
				},
			);
			// Send to worker - transfer the underlying buffer for performance
			try {
				postIfTranscriptionRequestAccepted(accepted, () =>
					w.postMessage(
						{
							type: 'transcribe',
							audioData,
							language: transcriptionLanguage,
							messageId,
						},
						[audioData.buffer],
					),
				);
			} catch (error) {
				pendingTranscriptions.reject(
					messageId,
					new TranscriptionServiceError(
						'TRANSCRIPTION_WORKER_ERROR',
						error instanceof Error
							? error.message
							: 'Failed to contact transcription worker',
					),
				);
				discardWorker();
			}
		});
	} catch (e) {
		console.error('Failed to decode audio:', e);
		throw new Error(e instanceof Error ? e.message : 'Failed to decode audio');
	}
}

/**
 * Get cached transcription if available
 */
export function getCachedTranscription(messageId: string): string | null {
	return transcriptionStore.get(messageId) || null;
}

/**
 * Clear transcription store
 */
export function clearTranscriptionCache(): void {
	transcriptionStore = new Map();
}

/**
 * Check if transcription is supported in this browser
 */
export function isTranscriptionSupported(): boolean {
	if (!browser) return false;
	// Requires Web Audio API and WebAssembly
	return (
		typeof AudioContext !== 'undefined' && typeof WebAssembly !== 'undefined'
	);
}

/**
 * Terminate the worker (cleanup)
 */
export function terminateWorker(): void {
	pendingTranscriptions.rejectAll(
		new TranscriptionServiceError(
			'TRANSCRIPTION_WORKER_ERROR',
			'Transcription worker was terminated',
		),
	);
	discardWorker();
}

/**
 * Web Worker for audio transcription using Whisper via Transformers.js
 * Runs model inference off the main thread to keep UI responsive
 */

import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

// Model configuration
const MODEL_ID = 'Xenova/whisper-small';

let whisperPipeline: AutomaticSpeechRecognitionPipeline | null = null;
let isLoading = false;

// Message types
interface LoadModelMessage {
	type: 'load-model';
}

interface TranscribeMessage {
	type: 'transcribe';
	audioData: Float32Array;
	language: string;
	messageId: string;
}

type WorkerMessage = LoadModelMessage | TranscribeMessage;

interface ProgressResponse {
	type: 'progress';
	progress: number;
	status?: string;
}

interface ModelReadyResponse {
	type: 'model-ready';
}

interface ModelErrorResponse {
	type: 'model-error';
	error: string;
}

interface TranscriptionResultResponse {
	type: 'transcription-result';
	messageId: string;
	text: string;
}

interface TranscriptionErrorResponse {
	type: 'transcription-error';
	messageId: string;
	error: string;
}

type WorkerResponse = ProgressResponse | ModelReadyResponse | ModelErrorResponse | TranscriptionResultResponse | TranscriptionErrorResponse;

/**
 * Load the Whisper model
 */
async function loadModel(): Promise<void> {
	if (whisperPipeline || isLoading) return;
	
	isLoading = true;
	
	try {
		// @ts-expect-error - pipeline types are complex
		whisperPipeline = await pipeline('automatic-speech-recognition', MODEL_ID, {
			dtype: 'q8',
			device: 'wasm',
			progress_callback: (progress: { progress?: number; status?: string }) => {
				const response: ProgressResponse = {
					type: 'progress',
					progress: progress.progress !== undefined ? Math.round(progress.progress) : 0,
					status: progress.status
				};
				self.postMessage(response);
			}
		});
		
		const response: ModelReadyResponse = { type: 'model-ready' };
		self.postMessage(response);
	} catch (e) {
		const response: ModelErrorResponse = {
			type: 'model-error',
			error: e instanceof Error ? e.message : 'Failed to load model'
		};
		self.postMessage(response);
	} finally {
		isLoading = false;
	}
}

// Note: Audio decoding happens on the main thread since AudioContext
// is not available in Web Workers. We receive pre-decoded Float32Array.

/**
 * Transcribe pre-decoded audio data
 */
async function transcribe(audioData: Float32Array, language: string, messageId: string): Promise<void> {
	try {
		// Ensure model is loaded
		if (!whisperPipeline) {
			await loadModel();
		}
		
		if (!whisperPipeline) {
			throw new Error('Model not available');
		}
		
		// Build options
		const options: Record<string, unknown> = {
			chunk_length_s: 30,
			stride_length_s: 5,
			return_timestamps: false,
			task: 'transcribe'
		};
		
		if (language !== 'auto') {
			options.language = language;
		}
		
		// Run transcription with the pre-decoded audio
		const result = await whisperPipeline(audioData, options);
		
		// Extract text
		const text = Array.isArray(result) ? result[0]?.text : result.text;
		const transcription = text?.trim() || '';
		
		const response: TranscriptionResultResponse = {
			type: 'transcription-result',
			messageId,
			text: transcription
		};
		self.postMessage(response);
	} catch (e) {
		console.error('Transcription error:', e);
		const response: TranscriptionErrorResponse = {
			type: 'transcription-error',
			messageId,
			error: e instanceof Error ? e.message : 'Transcription failed'
		};
		self.postMessage(response);
	}
}

// Handle messages from main thread
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
	const message = event.data;
	
	switch (message.type) {
		case 'load-model':
			await loadModel();
			break;
		case 'transcribe':
			await transcribe(message.audioData, message.language, message.messageId);
			break;
	}
};

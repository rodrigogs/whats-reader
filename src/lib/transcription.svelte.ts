/**
 * Audio Transcription Service using Whisper via Transformers.js
 * Runs in a Web Worker to keep UI responsive
 */

import { browser } from "$app/environment";

// Default language for transcription (can be changed by user)
let transcriptionLanguage = $state<string>("portuguese");

// Reactive transcription store - enables search integration
let transcriptionStore = $state<Map<string, string>>(new Map());

// State management
let isModelLoading = $state(false);
let modelLoadProgress = $state(0);
let modelError = $state<string | null>(null);
let isModelReady = $state(false);

// Worker instance
let worker: Worker | null = null;

// Pending transcription callbacks
const pendingTranscriptions = new Map<
  string,
  {
    resolve: (text: string) => void;
    reject: (error: Error) => void;
  }
>();

/**
 * Initialize the transcription worker
 */
function initWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(
    new URL("./workers/transcription-worker.ts", import.meta.url),
    { type: "module" },
  );

  worker.onmessage = (event) => {
    const message = event.data;

    switch (message.type) {
      case "progress":
        modelLoadProgress = message.progress;
        break;
      case "model-ready":
        isModelReady = true;
        isModelLoading = false;
        modelLoadProgress = 100;
        break;
      case "model-error":
        modelError = message.error;
        isModelLoading = false;
        break;
      case "transcription-result": {
        const pending = pendingTranscriptions.get(message.messageId);
        if (pending) {
          // Store in reactive store
          if (message.text) {
            transcriptionStore.set(message.messageId, message.text);
            transcriptionStore = new Map(transcriptionStore);
          }
          pending.resolve(message.text || "(No speech detected)");
          pendingTranscriptions.delete(message.messageId);
        }
        break;
      }
      case "transcription-error": {
        const pendingErr = pendingTranscriptions.get(message.messageId);
        if (pendingErr) {
          pendingErr.reject(new Error(message.error));
          pendingTranscriptions.delete(message.messageId);
        }
        break;
      }
    }
  };

  worker.onerror = (error) => {
    console.error("Transcription worker error:", error);
    modelError = error.message;
  };

  return worker;
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
    { code: "portuguese", name: "Português" },
    { code: "english", name: "English" },
    { code: "spanish", name: "Español" },
    { code: "french", name: "Français" },
    { code: "german", name: "Deutsch" },
    { code: "italian", name: "Italiano" },
    { code: "dutch", name: "Nederlands" },
    { code: "japanese", name: "日本語" },
    { code: "chinese", name: "中文" },
    { code: "korean", name: "한국어" },
    { code: "russian", name: "Русский" },
    { code: "auto", name: "Auto-detect" },
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
 * Pre-load the Whisper model
 */
export function preloadModel(): void {
  if (!browser || isModelReady || isModelLoading) return;

  isModelLoading = true;
  modelError = null;
  modelLoadProgress = 0;

  const w = initWorker();
  w.postMessage({ type: "load-model" });
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
    throw new Error("Transcription only available in browser");
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
      pendingTranscriptions.set(messageId, { resolve, reject });

      // Send to worker - transfer the underlying buffer for performance
      w.postMessage(
        {
          type: "transcribe",
          audioData,
          language: transcriptionLanguage,
          messageId,
        },
        [audioData.buffer],
      );
    });
  } catch (e) {
    console.error("Failed to decode audio:", e);
    throw new Error(e instanceof Error ? e.message : "Failed to decode audio");
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
    typeof AudioContext !== "undefined" && typeof WebAssembly !== "undefined"
  );
}

/**
 * Terminate the worker (cleanup)
 */
export function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    isModelReady = false;
  }
}

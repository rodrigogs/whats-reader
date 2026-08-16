<script lang="ts">
import { tick } from 'svelte';
import { browser } from '$app/environment';
import favicon from '$lib/assets/favicon.png';
import { getAutoUpdaterState, initAutoUpdater } from '$lib/auto-updater.svelte';
import { bookmarksState } from '$lib/bookmarks.svelte';
import {
	ChatList,
	ChatStats,
	ChatView,
	Collapsible,
	Dropdown,
	DropdownHeader,
	DropdownList,
	DropdownSearch,
	FeatureItem,
	FileDropZone,
	SearchBar,
	VersionBadge,
} from '$lib/components';
import AutoUpdateToast from '$lib/components/AutoUpdateToast.svelte';
import BookmarksPanel from '$lib/components/BookmarksPanel.svelte';
import Button from '$lib/components/Button.svelte';
import GlobalSearchPanel from '$lib/components/GlobalSearchPanel.svelte';
import Icon from '$lib/components/Icon.svelte';
import IconButton from '$lib/components/IconButton.svelte';
import ListItemButton from '$lib/components/ListItemButton.svelte';
import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
import MediaGallery from '$lib/components/MediaGallery.svelte';
import Modal from '$lib/components/Modal.svelte';
import ModalContent from '$lib/components/ModalContent.svelte';
import ModalHeader from '$lib/components/ModalHeader.svelte';
import ReselectFileModal from '$lib/components/ReselectFileModal.svelte';
import RestoreSessionModal from '$lib/components/RestoreSessionModal.svelte';
import Toast from '$lib/components/Toast.svelte';
import { findArchiveIndex } from '$lib/global-search/archive-navigation';
import { createArchivePageState } from '$lib/global-search/archive-page-state.svelte';
import { createGlobalSearchState } from '$lib/global-search/global-search-state.svelte';
import {
	createGlobalSearchHarnessTransport,
	GLOBAL_SEARCH_HARNESS_ENABLED,
	installGlobalSearchHarnessWindowApi,
} from '$lib/global-search/harness-entry';
import { GLOBAL_SEARCH_V1_ENABLED } from '$lib/global-search/manifest';
import { idbPersistedChatRemovalStore } from '$lib/global-search/persisted-chat-removal-store';
import { createWorkerTransport } from '$lib/global-search/query-orchestrator';
import type { GlobalSearchResult } from '$lib/global-search/query-worker';
import { idbGlobalSearchStorage } from '$lib/global-search/storage';
import {
	getElectronFilePath,
	openElectronFile,
	openZipFilePicker,
} from '$lib/helpers/file-picker';
import { sanitizeFilename } from '$lib/helpers/format';
import {
	isElectronMac as checkIsElectronMac,
	isElectronApp,
	isMobileViewport,
} from '$lib/helpers/responsive';
import * as m from '$lib/paraglide/messages';
import { parseZipFile, readFileAsArrayBuffer } from '$lib/parser';
import {
	acceptValidatedRestore,
	getDontShowRestoreModal,
	getPersistedChats,
	isElectronPathReference,
	type PersistedChatMetadata,
	restoreChat,
	savePersistedChat,
	storeFileHandle,
	updatePersistedChat,
} from '$lib/persistence.svelte';
import { appState, type ChatData, type LoadingChat } from '$lib/state.svelte';
import {
	getTranscriptionsForChat,
	setTranscriptionLanguage,
	setTranscriptionsForChat,
} from '$lib/transcription.svelte';

// Detect if running in Electron
const isElectron = isElectronApp();

// Detect if running in Electron on macOS (only macOS needs custom titlebar)
const isElectronMac = checkIsElectronMac();

// Dark mode state - check if dark class is on html element
let isDarkMode = $state(
	browser ? document.documentElement.classList.contains('dark') : true,
);

function toggleDarkMode() {
	isDarkMode = !isDarkMode;
	if (browser) {
		if (isDarkMode) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
		// Only persist to localStorage when user explicitly toggles
		localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
	}
}

// Auto-updater state
const autoUpdaterState = $derived(getAutoUpdaterState());

// Initialize auto-updater when the app loads (Electron only)
$effect(() => {
	if (browser && isElectron) {
		initAutoUpdater();
	}
});

let showStats = $state(false);
let showSidebar = $state(true);
let sidebarFileInput: HTMLInputElement | undefined = $state();
let showBookmarks = $state(false);
let showMediaGallery = $state(false);
let showParticipants = $state(false);
let participantStats = $state<Map<string, number> | null>(null);
let scrollToMessageId = $state<string | null>(null);

// Toast notification state
let toastMessage = $state<string | null>(null);
let toastType = $state<'success' | 'error' | 'info'>('success');

function showToast(
	message: string,
	type: 'success' | 'error' | 'info' = 'success',
) {
	toastMessage = message;
	toastType = type;
}

function hideToast() {
	toastMessage = null;
}

// Compute participant stats when modal opens (not during render)
function openParticipantsModal() {
	if (!appState.selectedChat) return;

	// Pre-compute message counts in a single pass
	const counts = new Map<string, number>();
	for (const msg of appState.selectedChat.messages) {
		if (msg.sender) {
			counts.set(msg.sender, (counts.get(msg.sender) || 0) + 1);
		}
	}
	participantStats = counts;
	showParticipants = true;
}

function closeParticipantsModal() {
	showParticipants = false;
	participantStats = null;
}
let showPerspectiveDropdown = $state(false);
let perspectiveSearchQuery = $state('');
let showChatOptionsDropdown = $state(false);
let chatOptionsButtonRef = $state<HTMLButtonElement | null>(null);

// Loading chats state - shows placeholder items while importing
let loadingChats = $state<LoadingChat[]>([]);

// Derived loading state for FileDropZone (empty state)
const isLoadingFiles = $derived(loadingChats.length > 0);
const loadingFilesProgress = $derived.by(() => {
	if (loadingChats.length === 0) return 0;
	const total = loadingChats.reduce((sum, lc) => sum + lc.progress, 0);
	return total / loadingChats.length;
});
let perspectiveButtonRef = $state<HTMLButtonElement | null>(null);
let perspectiveSearchInputRef = $state<HTMLInputElement | null>(null);

// Auto-focus search input when perspective dropdown opens
$effect(() => {
	if (showPerspectiveDropdown && perspectiveSearchInputRef) {
		// Small delay to ensure the element is rendered and positioned
		setTimeout(() => perspectiveSearchInputRef?.focus(), 50);
	}
});

// Per-archive runtime/UI state keyed by archiveId. Chat titles are non-unique,
// so language, perspective, auto-load preference, remembered flag and file
// reference all live behind a single factory consumed here and by tests.
const pageState = createArchivePageState();

// ── Global search (GH-67 §5/§7/§8) ──────────────────────────────────────
// Wired against the real approved persistence + worker/controller contracts.
// The build-time gate stays GLOBAL_SEARCH_V1_ENABLED (false): the surface is
// fail-closed until the feature ships, and the flag is never used as a
// substitute for the wired contract.
//
// The GH-67 §9 benchmark harness (VITE_GLOBAL_SEARCH_HARNESS=1) wraps the
// REAL dedicated worker transport with a timing tap and installs the
// `window.__gh67GlobalSearchHarness` bridge. Normal and distributed builds
// never enable it (the constant is a build-time false).
const globalSearchHarness = GLOBAL_SEARCH_HARNESS_ENABLED
	? createGlobalSearchHarnessTransport()
	: null;
const globalSearchState = createGlobalSearchState({
	// The harness build (VITE_GLOBAL_SEARCH_HARNESS=1) enables the real
	// search path so the benchmark executes the actual UI/worker flow;
	// GLOBAL_SEARCH_V1_ENABLED itself stays false (fail-closed) and normal
	// and distributed builds keep the gate off.
	gate: GLOBAL_SEARCH_V1_ENABLED || GLOBAL_SEARCH_HARNESS_ENABLED,
	storage: idbGlobalSearchStorage,
	workerFactory: () =>
		globalSearchHarness?.transport ?? createWorkerTransport(),
	persistedLibraryStore: idbPersistedChatRemovalStore,
});
let showGlobalSearch = $state(false);

// Display-only titles for remembered (persisted) archives. Identity always
// resolves through archiveId; titles here are purely for presentation.
let persistedTitles = $state<Map<string, string>>(new Map());

$effect(() => {
	if (!browser) return;
	(async () => {
		const persisted = await getPersistedChats();
		persistedTitles = new Map(
			persisted.map((chat) => [chat.id, chat.chatTitle]),
		);
	})();
});

// Keep the global search surface in sync with the app's live archives.
$effect(() => {
	globalSearchState.setLoadedChats(appState.chats);
	globalSearchState.setRememberedArchives(
		[...pageState.rememberedArchiveIds].map((archiveId) => ({
			archiveId,
			chatTitle: persistedTitles.get(archiveId) ?? '',
		})),
	);
});

// GH-67 §9 benchmark harness bridge: installed only in harness builds
// (VITE_GLOBAL_SEARCH_HARNESS=1). It injects the deterministic synthetic
// corpus through the real app state and taps the real worker transport.
$effect(() => {
	if (!browser || !GLOBAL_SEARCH_HARNESS_ENABLED || !globalSearchHarness)
		return;
	installGlobalSearchHarnessWindowApi({
		state: globalSearchState,
		harness: globalSearchHarness,
		addChat: (chat) => appState.addChat(chat),
		removeChatAt: (index) => appState.removeChat(index),
		getChatCount: () => appState.chats.length,
	});
});

// Unique senders across loaded chats, for the sender filter.
const globalSearchSenders = $derived.by(() => {
	const senders = new Set<string>();
	for (const chat of appState.chats) {
		for (const message of chat.messages) {
			if (message.sender) senders.add(message.sender);
		}
	}
	return [...senders];
});

let showRestoreSessionModal = $state(false);
let showReselectFileModal = $state(false);
let reselectChatMetadata = $state<PersistedChatMetadata | null>(null);
let reselectResolve:
	| ((
			result: {
				file: File;
				path?: string;
				handle?: FileSystemFileHandle;
			} | null,
	  ) => void)
	| null = null;
let persistedChatsToRestore = $state<PersistedChatMetadata[]>([]);

// Get auto-load media setting for the current chat
const autoLoadMediaForCurrentChat = $derived.by(() => {
	if (!appState.selectedChat) return false;
	return pageState.getAutoLoadMedia(appState.selectedChat.archiveId);
});

const STAGE_PROGRESS = {
	reading: { offset: 0.0, weight: 0.1 },
	extracting: { offset: 0.1, weight: 0.5 },
	parsing: { offset: 0.6, weight: 0.4 },
} as const;

function startIndexWorker(chatData: ChatData) {
	const indexWorker = new Worker(
		new URL('$lib/workers/index-worker.ts', import.meta.url),
		{ type: 'module' },
	);

	indexWorker.onmessage = (
		event: MessageEvent<{
			archiveId: string;
			indexEntries: [string, number][];
			flatItems: Array<
				| { type: 'date'; dateKey: string }
				| { type: 'message'; messageId: string }
			>;
			serializedMessages: Array<{
				id: string;
				timestamp: string;
				sender: string;
				content: string;
				isSystemMessage: boolean;
				isMediaMessage: boolean;
				mediaType?: string;
				rawLine: string;
			}>;
		}>,
	) => {
		const { archiveId, indexEntries, flatItems, serializedMessages } =
			event.data;
		const messageIndex = new Map(indexEntries);
		appState.updateChatMessageIndex(archiveId, messageIndex);
		appState.updateChatFlatItems(archiveId, flatItems);
		appState.updateChatSerializedMessages(archiveId, serializedMessages);
		indexWorker.terminate();
	};

	indexWorker.onerror = (err) => {
		console.error('Index worker error:', err);
		indexWorker.terminate();
	};

	indexWorker.postMessage({
		messages: chatData.messages.map((m) => ({
			id: m.id,
			timestamp: m.timestamp.toISOString(),
			sender: m.sender,
			content: m.content,
			isSystemMessage: m.isSystemMessage,
			isMediaMessage: m.isMediaMessage,
			mediaType: m.mediaType,
			rawLine: m.rawLine,
		})),
		archiveId: chatData.archiveId,
	});
}

function makeProgressCallback(loadingId: string) {
	return async ({
		stage,
		progress,
	}: {
		stage: LoadingChat['stage'];
		progress: number;
	}) => {
		const { offset: stageOffset, weight: stageWeight } =
			STAGE_PROGRESS[stage] ?? STAGE_PROGRESS.extracting;
		const overallProgress =
			10 + (stageOffset + (progress / 100) * stageWeight) * 90;
		loadingChats = loadingChats.map((lc) =>
			lc.id === loadingId ? { ...lc, progress: overallProgress, stage } : lc,
		);
	};
}

async function handleSidebarImport() {
	if (window.electronAPI) {
		const result = await openElectronFile();
		if (result) {
			const dt = new DataTransfer();
			dt.items.add(result.file);
			handleFilesSelected(
				dt.files,
				undefined,
				result.path ? [result.path] : undefined,
			);
		}
	} else {
		const result = await openZipFilePicker(true);
		if (result) {
			handleFilesSelected(result.files, result.handles);
		} else if (!('showOpenFilePicker' in window)) {
			sidebarFileInput?.click();
		}
	}
}

async function handleFilesSelected(
	files: FileList,
	handles?: FileSystemFileHandle[],
	paths?: string[],
) {
	appState.clearError();

	let handleIndex = 0;
	for (const file of files) {
		if (!file.name.endsWith('.zip')) {
			appState.setError(m.error_unsupported_file({ filename: file.name }));
			continue;
		}

		// Create a loading placeholder for this file
		const loadingId = crypto.randomUUID();
		const filename = sanitizeFilename(file.name);

		loadingChats = [
			...loadingChats,
			{
				id: loadingId,
				filename,
				progress: 0,
				stage: 'reading',
			},
		];

		// Capture values before async IIFE to avoid closure-over-loop-variable bug
		const currentHandleIndex = handleIndex;
		// File path: prefer explicit path from Electron dialog, fall back to file.path from drag-drop
		const droppedFilePath =
			paths?.[currentHandleIndex] || getElectronFilePath(file);
		const droppedHandle = handles?.[currentHandleIndex];

		// Process file asynchronously
		(async () => {
			try {
				// Read file (0-10% of progress)
				const buffer = await readFileAsArrayBuffer(file, (readProgress) => {
					loadingChats = loadingChats.map((lc) =>
						lc.id === loadingId
							? {
									...lc,
									progress: readProgress * 0.1,
									stage: 'reading' as const,
								}
							: lc,
					);
				});

				// Parse ZIP file using Web Worker
				const chatData: ChatData = await parseZipFile(
					buffer,
					makeProgressCallback(loadingId),
				);

				// Remove loading placeholder and add actual chat
				loadingChats = loadingChats.filter((lc) => lc.id !== loadingId);
				appState.addChat(chatData);

				// Store file reference for persistence
				pageState.setFileReference(chatData.archiveId, {
					file,
					filePath: droppedFilePath,
					fileHandle: droppedHandle,
				});

				// Start background indexing
				startIndexWorker(chatData);

				// On mobile, collapse sidebar after loading chats
				if (browser && isMobileViewport()) {
					showSidebar = false;
				}
			} catch (error) {
				console.error('Error parsing file:', error);
				// Remove loading placeholder on error
				loadingChats = loadingChats.filter((lc) => lc.id !== loadingId);
				appState.setError(
					error instanceof Error ? error.message : m.error_parse_failed(),
				);
			}
		})();
		handleIndex++;
	}
}

function handleSelectChat(index: number) {
	appState.selectChat(index);
	// Set the transcription language for this chat
	const chat = appState.chats[index];
	if (chat) {
		const lang = pageState.getLanguage(chat.archiveId);
		setTranscriptionLanguage(lang);
	}
	// On mobile, collapse sidebar after selecting a chat
	if (browser && isMobileViewport()) {
		showSidebar = false;
	}
}

function handleRemoveChat(index: number) {
	const chat = appState.chats[index];
	const archiveId = chat?.archiveId;

	// Remove from current session only — persisted data stays in IndexedDB
	// so the chat can be restored on next app launch.
	// To remove from saved chats, user must toggle "Remember Conversation" off.
	appState.removeChat(index);

	if (archiveId) {
		pageState.removeFileReference(archiveId);
	}
}

function handleLanguageChange(archiveId: string, language: string) {
	pageState.setLanguage(archiveId, language);
	// If this is the currently selected chat, update the transcription service
	if (appState.selectedChat?.archiveId === archiveId) {
		setTranscriptionLanguage(language);
	}
}

function handleAutoLoadMediaChange(archiveId: string, enabled: boolean) {
	pageState.setAutoLoadMedia(archiveId, enabled);
}

function handleSearchInput(value: string) {
	appState.setSearchQuery(value);
}

function toggleStats() {
	showStats = !showStats;
}

function toggleSidebar() {
	showSidebar = !showSidebar;
}

function toggleBookmarks() {
	showBookmarks = !showBookmarks;
	if (showBookmarks) {
		showMediaGallery = false;
	}
}

function toggleMediaGallery() {
	showMediaGallery = !showMediaGallery;
	if (showMediaGallery) {
		showBookmarks = false;
	}
}

async function handleNavigateToMediaMessage(messageId: string) {
	// Clear any previous scroll target
	scrollToMessageId = null;

	// Wait for Svelte to process the null value
	await tick();

	// Set the new scroll target
	scrollToMessageId = messageId;
}

async function handleNavigateToBookmark(messageId: string, archiveId: string) {
	// Find and select the chat if different from current
	const chatIndex = findArchiveIndex(appState.chats, archiveId);
	const needsChatSwitch =
		chatIndex !== -1 && chatIndex !== appState.selectedChatIndex;

	if (needsChatSwitch) {
		appState.selectChat(chatIndex);
	}

	// Clear any previous scroll target
	scrollToMessageId = null;

	// Wait for Svelte to process the null value
	await tick();

	// Use longer delay when switching chats to allow messages to load
	const delay = needsChatSwitch ? 300 : 0;
	if (delay > 0) {
		await new Promise((resolve) => setTimeout(resolve, delay));
	}

	// Set the new scroll target
	scrollToMessageId = messageId;
}

function selectPerspective(participant: string | null) {
	if (appState.selectedChat) {
		pageState.setPerspective(appState.selectedChat.archiveId, participant);
	}
	showPerspectiveDropdown = false;
	showChatOptionsDropdown = false;
	perspectiveSearchQuery = '';
}

// Get current perspective for selected chat
const currentPerspective = $derived.by(() => {
	if (!appState.selectedChat) return null;
	return pageState.getPerspective(appState.selectedChat.archiveId);
});

// Filter participants based on search query
const filteredParticipants = $derived.by(() => {
	if (!appState.selectedChat) return [];
	const query = perspectiveSearchQuery.toLowerCase().trim();
	if (!query) return appState.selectedChat.participants;
	return appState.selectedChat.participants.filter((p) =>
		p.toLowerCase().includes(query),
	);
});

// Determine current user based on selected perspective
const currentUser = $derived.by(() => {
	if (!appState.selectedChat) return undefined;
	// If a perspective is selected, use it
	if (currentPerspective !== null) {
		return currentPerspective;
	}
	// Otherwise, no perspective (all messages on left)
	return undefined;
});

// Check for persisted chats on app load (one-time)
let persistenceChecked = false;
$effect(() => {
	if (!browser || persistenceChecked) return;
	persistenceChecked = true;

	(async () => {
		try {
			const persisted = await getPersistedChats();
			if (persisted.length === 0) return;

			// Seed rememberedChats from IndexedDB so toggle state is correct
			// even if user skips the restore modal or clicks "Start Fresh"
			for (const chat of persisted) {
				pageState.addRemembered(chat.id);
			}

			// Check if user wants to skip the modal
			const dontShow = await getDontShowRestoreModal();
			if (dontShow) return;

			// Show restore modal
			persistedChatsToRestore = persisted;
			showRestoreSessionModal = true;
		} catch (e) {
			console.error('Failed to check for persisted chats:', e);
		}
	})();
});

// Handle restoring selected chats
async function handleRestoreChats(chatIds: string[]) {
	showRestoreSessionModal = false;

	for (const chatId of chatIds) {
		const persistedChat = persistedChatsToRestore.find((c) => c.id === chatId);
		if (!persistedChat) continue;

		try {
			const result = await restoreChat(persistedChat);

			if (result.needsReselect) {
				// Show reselect modal and wait for user response
				reselectChatMetadata = persistedChat;
				showReselectFileModal = true;
				const reselected = await new Promise<{
					file: File;
					path?: string;
					handle?: FileSystemFileHandle;
				} | null>((resolve) => {
					reselectResolve = resolve;
				});
				reselectChatMetadata = null;
				showReselectFileModal = false;

				if (reselected) {
					const reselectedBuffer = await reselected.file.arrayBuffer();
					const { validationPassed } = await loadChatFromBuffer(
						reselectedBuffer,
						reselected.file.name,
						persistedChat,
					);

					// Only upgrade persisted entry and mark remembered when validation passes
					// to avoid binding saved metadata to the wrong file
					if (validationPassed) {
						const reselectedPath =
							reselected.path || getElectronFilePath(reselected.file);
						pageState.setFileReference(persistedChat.id, {
							file: reselected.file,
							filePath: reselectedPath,
							fileHandle: reselected.handle,
							persistedId: persistedChat.id,
						});

						// Upgrade persisted entry so future restores work automatically
						if (reselectedPath) {
							await updatePersistedChat(persistedChat.id, {
								fileReference: {
									type: 'electron-path',
									filePath: reselectedPath,
								},
							});
						} else if (reselected.handle) {
							// Chrome/Edge: store handle and upgrade entry
							await storeFileHandle(persistedChat.id, reselected.handle);
							await updatePersistedChat(persistedChat.id, {
								fileReference: {
									type: 'file-handle',
									handleId: persistedChat.id,
								},
							});
						}
						pageState.addRemembered(persistedChat.id);
					}
				}
				continue;
			}

			if (!result.success || !result.data) {
				console.error(
					`Failed to restore chat ${persistedChat.chatTitle}:`,
					result.error,
				);
				showToast(m.persistence_restore_failed(), 'error');
				continue;
			}

			// Parse and load the chat
			await loadChatFromBuffer(
				result.data.buffer,
				result.data.name,
				persistedChat,
				isElectronPathReference(result.data.metadata.fileReference)
					? result.data.metadata.fileReference.filePath
					: undefined,
			);

			// Store file reference for subsequent toggle operations
			pageState.setFileReference(persistedChat.id, {
				file: null,
				filePath: isElectronPathReference(result.data.metadata.fileReference)
					? result.data.metadata.fileReference.filePath
					: undefined,
				persistedId: persistedChat.id,
			});

			pageState.addRemembered(persistedChat.id);
		} catch (e) {
			console.error(`Error restoring chat ${persistedChat.chatTitle}:`, e);
			showToast(m.persistence_restore_failed(), 'error');
		}
	}
}

// Handle reselect file for a persisted chat
async function handleReselectFile(
	file: File,
	filePath?: string,
	fileHandle?: FileSystemFileHandle,
) {
	if (reselectResolve) {
		reselectResolve({ file, path: filePath, handle: fileHandle });
		reselectResolve = null;
	}
}

// Skip reselect for a chat
function handleSkipReselect() {
	if (reselectResolve) {
		reselectResolve(null);
		reselectResolve = null;
	}
}

// Handle start fresh (close restore modal without restoring)
function handleStartFresh() {
	showRestoreSessionModal = false;
	persistedChatsToRestore = [];
}

// Load chat from buffer with optional restoration metadata
async function loadChatFromBuffer(
	buffer: ArrayBuffer,
	fileName: string,
	restoredMetadata?: PersistedChatMetadata,
	filePath?: string,
): Promise<{ validationPassed: boolean }> {
	// Create a loading placeholder
	const loadingId = crypto.randomUUID();
	const displayName = sanitizeFilename(fileName);

	loadingChats = [
		...loadingChats,
		{
			id: loadingId,
			filename: displayName,
			progress: 0,
			stage: 'extracting',
		},
	];

	try {
		// Parse ZIP file using Web Worker
		const chatData: ChatData = await parseZipFile(
			buffer,
			makeProgressCallback(loadingId),
			restoredMetadata?.id,
		);

		// When restoring, every side effect is routed through the validation
		// gate: a mismatched archive triggers none of them (no bookmarks,
		// settings or transcription restoration, no chat added, no index
		// worker started, and the placeholder is removed).
		if (restoredMetadata) {
			const validationPassed = acceptValidatedRestore(
				chatData,
				restoredMetadata,
				{
					applyBookmarks: (bookmarks, savedAt) => {
						// Persistence predates archiveId on Bookmark. This callback runs only
						// after metadata/file validation, so the parsed archive is the safe
						// namespace for those legacy entries.
						bookmarksState.importValidatedPersistedBookmarks(
							bookmarks,
							chatData.archiveId,
							savedAt,
						);
					},
					applyTranscriptions: (transcriptions) => {
						setTranscriptionsForChat(chatData.archiveId, transcriptions);
					},
					applySettings: (settings) => {
						if (settings.language) {
							pageState.setLanguage(chatData.archiveId, settings.language);
						}
						if (settings.autoLoadMedia !== undefined) {
							pageState.setAutoLoadMedia(
								chatData.archiveId,
								settings.autoLoadMedia,
							);
						}
						if (settings.perspective !== undefined) {
							pageState.setPerspective(
								chatData.archiveId,
								settings.perspective,
							);
						}
					},
					addChat: (chat) => {
						appState.addChat(chat);
						if (filePath) {
							pageState.setFileReference(chat.archiveId, {
								file: null,
								filePath,
							});
						}
					},
					startIndex: (chat) => startIndexWorker(chat),
				},
			);

			loadingChats = loadingChats.filter((lc) => lc.id !== loadingId);

			if (!validationPassed) {
				console.warn('Restored file validation failed');
				return { validationPassed: false };
			}
			return { validationPassed: true };
		}

		// Fresh import path (no persisted identity to validate)
		loadingChats = loadingChats.filter((lc) => lc.id !== loadingId);
		appState.addChat(chatData);

		// Store file reference for persistence
		if (filePath) {
			pageState.setFileReference(chatData.archiveId, { file: null, filePath });
		}

		// Start background indexing
		startIndexWorker(chatData);

		return { validationPassed: true };
	} catch (error) {
		console.error('Error parsing file:', error);
		// Remove loading placeholder on error
		loadingChats = loadingChats.filter((lc) => lc.id !== loadingId);
		throw error;
	}
}

async function rememberChat(archiveId: string) {
	const chat = appState.chats.find((c) => c.archiveId === archiveId);
	if (!chat) return;

	try {
		const fileRef = pageState.getFileReference(archiveId);
		// Use handle captured during drag-drop (no file picker needed)
		const fileHandle = fileRef?.fileHandle;

		const bookmarks = bookmarksState.getBookmarksForArchive(archiveId);
		const chatMessageIds = chat.messages.map((msg) => msg.id);
		const transcriptions = getTranscriptionsForChat(archiveId, chatMessageIds);

		const persistedId = await savePersistedChat(
			chat,
			fileRef?.file || null,
			bookmarks,
			transcriptions,
			{
				language: pageState.getLanguage(archiveId),
				autoLoadMedia: pageState.getAutoLoadMedia(archiveId),
				perspective: pageState.getPerspective(archiveId),
			},
			fileRef?.filePath,
			fileHandle,
		);

		if (fileRef) {
			pageState.setFileReference(archiveId, {
				...fileRef,
				fileHandle,
				persistedId,
			});
		}

		pageState.addRemembered(archiveId);
		showToast(m.persistence_conversation_saved(), 'success');
	} catch (e) {
		console.error('Failed to save conversation:', e);
		showToast(m.persistence_save_failed(), 'error');
	}
}

// Removal confirmation state for the sidebar forget surface (§5: destructive
// removal must never execute without an explicit confirmation).
let confirmingRemoveArchiveId = $state<string | null>(null);

async function forgetChat(archiveId: string) {
	try {
		// ONE unified §5 cascade shared with the global-search panel: persisted
		// metadata + file-handle reference + global-search index/consent, each
		// half read back and fail-closed. If the readback reports a survivor the
		// removal is surfaced honestly as a failure, never silently swallowed.
		const report = await globalSearchState.removeFromLibrary(archiveId);
		if (!report.complete) {
			showToast(m.persistence_remove_failed(), 'error');
			return;
		}
		pageState.removeRemembered(archiveId);
		showToast(m.persistence_conversation_removed(), 'success');
	} catch (e) {
		console.error('Failed to remove conversation:', e);
		showToast(m.persistence_remove_failed(), 'error');
	}
}

function handleToggleRemember(archiveId: string, enabled: boolean) {
	if (enabled) {
		rememberChat(archiveId);
	} else {
		confirmingRemoveArchiveId = archiveId;
	}
}

function cancelForgetChat() {
	confirmingRemoveArchiveId = null;
}

function confirmForgetChat() {
	const archiveId = confirmingRemoveArchiveId;
	confirmingRemoveArchiveId = null;
	if (archiveId !== null) {
		void forgetChat(archiveId);
	}
}

function toggleGlobalSearch() {
	showGlobalSearch = !showGlobalSearch;
	if (showGlobalSearch) {
		void globalSearchState.initialize();
	}
}

function handleGlobalSearchNavigate(result: GlobalSearchResult) {
	// Resolves the canonical (archiveId, ordinal, messageId) tuple through the
	// same validated navigation path used by bookmarks; never approximates.
	void handleNavigateToBookmark(result.messageId, result.archiveId);
}

function handleGlobalSearchReselectSource(_archiveId: string) {
	// The panel retains query + filters and requests reselection; the source
	// file must be re-imported by the user. This is a request, not a guess.
	showToast(m.global_search_source_missing(), 'info');
}
</script>

<div class="h-screen flex flex-col bg-gray-100 dark:bg-gray-950">
	<!-- Electron drag region for macOS titlebar (only shown in Electron on macOS) -->
	{#if isElectronMac}
		<div class="electron-drag h-[38px] flex-shrink-0 bg-[var(--color-whatsapp-dark-green)]"></div>
	{/if}

	{#if !appState.hasChats}
		<!-- Empty state - show file upload -->
		<div class="relative flex-1 flex flex-col overflow-hidden">
			<!-- Version badge (top-left) - fixed position -->
			<div class="absolute top-4 left-4 z-10">
				<VersionBadge />
			</div>
			
			<!-- Settings buttons (top-right) - fixed position -->
			<div class="absolute top-4 right-4 flex items-center gap-1.5 z-10">
				<LocaleSwitcher variant="default" />
				<button
					onclick={toggleDarkMode}
					class="p-1.5 rounded-full transition-colors cursor-pointer bg-gray-100/80 dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-700 backdrop-blur-sm"
					aria-label={m.toggle_dark_mode()}
					title={isDarkMode ? m.theme_switch_to_light() : m.theme_switch_to_dark()}
				>
					{#if isDarkMode}
						<!-- Sun icon -->
						<Icon name="sun" size="sm" class="text-yellow-500" />
					{:else}
						<!-- Moon icon -->
						<Icon name="moon" size="sm" class="text-gray-600 dark:text-gray-400" />
					{/if}
				</button>
			</div>
			
			<!-- Scrollable content area -->
			<div class="flex-1 overflow-y-auto">
				<div class="flex flex-col items-center p-4 sm:p-8 min-h-full">
					<div class="max-w-lg w-full flex flex-col items-center py-8">
					<!-- Logo and title -->
					<div class="text-center mb-6">
						<div class="w-32 h-32 mx-auto mb-4">
							<img src={favicon} alt="WhatsApp Backup Reader" class="w-full h-full" />
						</div>
						<h1 class="text-2xl font-bold text-gray-800 dark:text-white mb-1">
							{m.app_title()}
						</h1>
						<p class="text-sm text-gray-500 dark:text-gray-400">
							{m.app_subtitle()}
						</p>
					</div>

					<!-- Drop zone -->
					<div class="w-full">
						<FileDropZone onFilesSelected={handleFilesSelected} isLoading={isLoadingFiles} loadingProgress={loadingFilesProgress} />
					</div>

					{#if appState.error}
						<div class="mt-4 w-full p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
							<p class="text-red-700 dark:text-red-400 text-sm text-center">
								{appState.error}
							</p>
						</div>
					{/if}

				<!-- Instructions - Collapsible -->
				<Collapsible title={m.export_instructions_title()} class="mt-6 w-full">
					<div class="grid grid-cols-1 gap-2">
						<FeatureItem badge={1}>{m.export_step_1()}</FeatureItem>
						<FeatureItem badge={2}>{m.export_step_2()}</FeatureItem>
						<FeatureItem badge={3}>{m.export_step_3()}</FeatureItem>
						<FeatureItem badge={4}>{m.export_step_4()}</FeatureItem>
						<FeatureItem badge={5}>{m.export_step_5()}</FeatureItem>
					</div>
				</Collapsible>

				<!-- Privacy & Security - Collapsible -->
				<Collapsible title={m.privacy_title()} class="mt-4 w-full">
					<div class="grid grid-cols-1 gap-2">
						<FeatureItem icon="wifi-off" variant="icon">{m.privacy_offline()}</FeatureItem>
						<FeatureItem icon="shield" variant="icon">{m.privacy_local_processing()}</FeatureItem>
						<FeatureItem icon="code" variant="icon">{m.privacy_local_ai()}</FeatureItem>
						<FeatureItem icon="eye-off" variant="icon">{m.privacy_no_tracking()}</FeatureItem>
						<FeatureItem icon="code" variant="icon">{m.privacy_open_source()}</FeatureItem>
					</div>
				</Collapsible>

				<!-- GitHub Star -->
				<div class="mt-4 flex flex-col items-center gap-1.5">
					<span class="text-xs text-gray-400 dark:text-gray-500">{m.github_star_title()}</span>
					<a
						href="https://github.com/rodrigogs/whats-reader"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-md transition-colors text-xs font-medium"
						onclick={(e) => {
							if (isElectron && window.electronAPI?.openExternal) {
								e.preventDefault();
								window.electronAPI.openExternal('https://github.com/rodrigogs/whats-reader');
							}
						}}
					>
						<Icon name="github" size="sm" />
						<Icon name="star" size="xs" class="text-yellow-400" filled />
						{m.github_star_cta()}
					</a>
				</div>
			</div>
		</div>
	</div>
	</div>
	{:else}
		<!-- Main app layout -->
		<div class="flex-1 flex flex-col overflow-hidden">
			<!-- Top header bar - always full width -->
			{#if appState.selectedChat}
				{#snippet perspectiveSelectorContent()}
					<DropdownHeader title={m.perspective_view_as()} />
					
					<DropdownSearch
						bind:value={perspectiveSearchQuery}
						bind:ref={perspectiveSearchInputRef}
						placeholder={m.perspective_search_placeholder()}
					/>
					
					<DropdownList>
						{#if !perspectiveSearchQuery}
							<ListItemButton
								active={currentPerspective === null}
								onclick={() => selectPerspective(null)}
							>
								<span class="w-5 text-center">{currentPerspective === null ? '✓' : ''}</span>
								<span class="italic">{m.perspective_none()}</span>
							</ListItemButton>
						{/if}
						{#each filteredParticipants as participant}
							<ListItemButton
								active={currentPerspective === participant}
								onclick={() => selectPerspective(participant)}
							>
								<span class="w-5 text-center">{currentPerspective === participant ? '✓' : ''}</span>
								<span class="truncate">{participant}</span>
							</ListItemButton>
						{/each}
						{#if filteredParticipants.length === 0 && perspectiveSearchQuery}
							<div class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 italic">
								{m.perspective_no_match({ query: perspectiveSearchQuery })}
							</div>
						{/if}
					</DropdownList>
				{/snippet}
				
				<!-- Chat header -->
				<div class="h-16 px-4 flex items-center gap-3 bg-[var(--color-whatsapp-dark-green)] text-white shadow-md flex-shrink-0">
					<!-- Sidebar toggle button -->
					<IconButton
						theme="dark"
						size="md"
						class="-ml-2"
						onclick={toggleSidebar}
						aria-label={m.sidebar_toggle()}
						title={m.sidebar_toggle()}
					>
						{#if showSidebar}
							<Icon name="chevron-left" size="md" />
						{:else}
							<Icon name="menu" size="md" />
						{/if}
					</IconButton>
					<!-- Avatar -->
					<div class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-semibold">
						{appState.selectedChat.title.charAt(0).toUpperCase()}
					</div>

					<!-- Chat info -->
					<div class="flex-1 min-w-0">
						<h2 class="font-semibold truncate">{appState.selectedChat.title}</h2>
						<button
							type="button"
							class="text-xs text-white/70 hover:text-white truncate block max-w-full text-left cursor-pointer transition-colors"
							onclick={openParticipantsModal}
						title={m.participants_view_all()}
						>
							{appState.selectedChat.participants.slice(0, 5).join(', ')}
							{#if appState.selectedChat.participants.length > 5}
								{m.perspective_more_participants({ count: appState.selectedChat.participants.length - 5 })}
							{/if}
						</button>
					</div>

					<!-- Actions -->
					<div class="flex items-center gap-2">
						<!-- Small screens: Options menu -->
						<div class="md:hidden relative">
							<IconButton
								bind:ref={chatOptionsButtonRef}
								theme="dark"
								size="md"
								onclick={() => showChatOptionsDropdown = !showChatOptionsDropdown}
								title={m.chat_options()}
								aria-label={m.chat_options()}
							>
								<Icon name="dots-vertical" size="md" />
							</IconButton>
							
							<Dropdown
								anchor={chatOptionsButtonRef}
								open={showChatOptionsDropdown}
								onClose={() => {
									showChatOptionsDropdown = false;
									showPerspectiveDropdown = false;
									perspectiveSearchQuery = '';
								}}
								width="w-56"
								placement="bottom-end"
							>
								{#if showPerspectiveDropdown}
									<!-- Perspective selector view -->
									{@render perspectiveSelectorContent()}
								{:else}
									<!-- Main options menu -->
									<DropdownList>
										<ListItemButton
											active={!!currentPerspective}
											onclick={() => showPerspectiveDropdown = true}
										>
											<Icon name="user" size="sm" />
											<span>{m.perspective_view_as()}</span>
										</ListItemButton>
										<ListItemButton
											active={showMediaGallery}
											onclick={() => {
												showChatOptionsDropdown = false;
												toggleMediaGallery();
											}}
										>
											<Icon name="image" size="sm" />
											<span>{m.media_gallery_title()}</span>
										</ListItemButton>
										<ListItemButton
											active={showBookmarks}
											onclick={() => {
												showChatOptionsDropdown = false;
												toggleBookmarks();
											}}
										>
											<Icon name="bookmark" size="sm" />
											<span>{m.bookmarks_title()}</span>
										</ListItemButton>
										<ListItemButton
											onclick={() => {
												showChatOptionsDropdown = false;
												toggleStats();
											}}
										>
											<Icon name="chart-bar" size="sm" />
											<span>{m.stats_view()}</span>
										</ListItemButton>
									</DropdownList>
								{/if}
							</Dropdown>
						</div>

						<!-- Large screens: Individual buttons -->
						<div class="hidden md:flex items-center gap-2">
							<!-- Global search -->
							<IconButton
								theme="dark"
								size="md"
								active={showGlobalSearch}
								onclick={toggleGlobalSearch}
								title={m.global_search_toggle()}
								aria-label={m.global_search_toggle()}
							>
								<Icon name="search" size="md" />
							</IconButton>

							<!-- Perspective selector -->
							<div class="relative">
								<IconButton
									bind:ref={perspectiveButtonRef}
									theme="dark"
									size="md"
									active={!!currentPerspective}
									onclick={() => showPerspectiveDropdown = !showPerspectiveDropdown}
									title={m.perspective_view_as()}
									aria-label={m.perspective_select()}
								>
									<Icon name="user" size="md" />
								</IconButton>
								
								<Dropdown
									anchor={perspectiveButtonRef}
									open={showPerspectiveDropdown}
									onClose={() => { showPerspectiveDropdown = false; perspectiveSearchQuery = ''; }}
								>
									{@render perspectiveSelectorContent()}
								</Dropdown>
							</div>

							<IconButton
								theme="dark"
								size="md"
								active={showMediaGallery}
								onclick={toggleMediaGallery}
								title={m.media_gallery_title()}
								aria-label={m.media_gallery_toggle()}
							>
								<Icon name="image" size="md" filled={showMediaGallery} />
							</IconButton>
							<IconButton
								theme="dark"
								size="md"
								active={showBookmarks}
								onclick={toggleBookmarks}
								title={m.bookmarks_title()}
								aria-label={m.bookmarks_toggle()}
							>
								<Icon name="bookmark" size="md" filled={showBookmarks} />
							</IconButton>
							<IconButton
								theme="dark"
								size="md"
								onclick={toggleStats}
								title={m.stats_view()}
								aria-label={m.stats_view()}
							>
								<Icon name="chart-bar" size="md" />
							</IconButton>
						</div>

						<!-- Theme toggle and language selector (always visible) -->
						<LocaleSwitcher variant="header" />
						<IconButton
							theme="dark"
							size="md" rounded="full"
							onclick={toggleDarkMode}
							aria-label={m.toggle_dark_mode()}
							title={isDarkMode ? m.theme_switch_to_light() : m.theme_switch_to_dark()}
						>
							{#if isDarkMode}
								<Icon name="sun" size="md" class="text-yellow-300" />
							{:else}
								<Icon name="moon" size="md" class="text-white/80" />
							{/if}
						</IconButton>
					</div>
				</div>
			{:else}
				<!-- No chat selected - simplified header -->
				<div class="h-16 px-4 flex items-center bg-[var(--color-whatsapp-dark-green)] flex-shrink-0">
					<!-- Sidebar toggle button -->
					<IconButton
						theme="dark"
						size="md"
						class="-ml-2"
						onclick={toggleSidebar}
						aria-label={m.sidebar_toggle()}
						title={m.sidebar_toggle()}
					>
						{#if showSidebar}
							<Icon name="chevron-left" size="md" />
						{:else}
							<Icon name="menu" size="md" />
						{/if}
					</IconButton>

					<!-- Global search (available without a selected chat) -->
					<div class="ml-auto">
						<IconButton
							theme="dark"
							size="md"
							active={showGlobalSearch}
							onclick={toggleGlobalSearch}
							title={m.global_search_toggle()}
							aria-label={m.global_search_toggle()}
						>
							<Icon name="search" size="md" />
						</IconButton>
					</div>
				</div>
			{/if}

			<!-- Content area below header -->
			<div class="flex-1 flex overflow-hidden">
				<!-- Sidebar -->
				<div
					class="sidebar-panel w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col {showSidebar ? 'sidebar-open' : 'sidebar-closed'}"
					class:electron-mac={isElectronMac}
				>
				
				<!-- Chats title bar - matches search bar styling exactly -->
				<div class="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
					<button
						type="button"
						class="relative flex items-center w-full h-10 pl-10 pr-4 bg-gray-100 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
						onclick={handleSidebarImport}
					>
						<div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
							<Icon name="plus" size="md" class="text-gray-400" />
						</div>
						<span class="text-gray-500">{m.import_chat()}</span>
					</button>
					<input
						bind:this={sidebarFileInput}
						type="file"
						accept=".zip"
						class="hidden"
						onchange={(e) => {
							const input = e.target as HTMLInputElement;
							if (input.files) handleFilesSelected(input.files);
						}}
						multiple
					/>
				</div>

				<!-- Chat list -->
				<div class="flex-1 overflow-hidden">
					<ChatList
						chats={appState.chats}
						selectedIndex={appState.selectedChatIndex}
						onSelect={handleSelectChat}
						onRemove={handleRemoveChat}
						languageByChat={pageState.languageByArchive}
						onLanguageChange={handleLanguageChange}
						autoLoadMediaByChat={pageState.autoLoadMediaByArchive}
						onAutoLoadMediaChange={handleAutoLoadMediaChange}
						{loadingChats}
						rememberedChats={pageState.rememberedArchiveIds}
						onToggleRemember={handleToggleRemember}
					/>
				</div>
			</div>

			<!-- Overlay for mobile sidebar -->
			{#if showSidebar}
				<button
					class="md:hidden fixed inset-0 bg-black/50 z-30"
					onclick={() => (showSidebar = false)}
					aria-label={m.sidebar_close()}
				></button>
			{/if}

			<!-- Main content -->
			{#if appState.selectedChat}
				<div class="flex-1 flex flex-col overflow-hidden">
					<!-- Search bar -->
					<div class="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
						<div class="flex items-center gap-2">
							<div class="flex-1">
								<SearchBar
									value={appState.searchQuery}
									onInput={handleSearchInput}
									onNextResult={() => appState.nextSearchResult()}
									onPrevResult={() => appState.prevSearchResult()}
									placeholder={m.search_placeholder()}
								/>
							</div>
							{#if appState.searchQuery}
								<!-- Search results count and navigation -->
								<div class="flex items-center gap-1">
									{#if appState.isSearching}
										<div class="flex items-center gap-2 px-2">
											<svg class="w-4 h-4 animate-spin-slow" viewBox="0 0 36 36">
												<circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" stroke-width="3" class="text-gray-200 dark:text-gray-700" />
												<circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-whatsapp-teal)" stroke-width="3" stroke-linecap="round" stroke-dasharray={100.53} stroke-dashoffset={100.53 - (100.53 * appState.searchProgress) / 100} transform="rotate(-90 18 18)" />
											</svg>
											<span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{appState.searchProgress}%</span>
										</div>
									{:else}
										<span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap px-2">
											{#if appState.totalSearchMatches > 0}
												{m.search_result_of({ current: appState.currentSearchIndex + 1, total: appState.totalSearchMatches })}
											{:else}
												{m.search_no_results()}
											{/if}
										</span>
										<!-- Navigation buttons -->
										<IconButton
											theme="subtle"
											size="sm"
											rounded="md"
											onclick={() => appState.prevSearchResult()}
											disabled={appState.totalSearchMatches === 0}
											class={appState.totalSearchMatches === 0 ? 'opacity-30 cursor-not-allowed' : ''}
											title={m.search_previous()}
											aria-label={m.search_previous()}
										>
											<Icon name="chevron-up" size="sm" class="text-gray-600 dark:text-gray-400" />
										</IconButton>
										<IconButton
											theme="subtle"
											size="sm"
											rounded="md"
											onclick={() => appState.nextSearchResult()}
											disabled={appState.totalSearchMatches === 0}
											class={appState.totalSearchMatches === 0 ? 'opacity-30 cursor-not-allowed' : ''}
											title={m.search_next()}
											aria-label={m.search_next()}
										>
											<Icon name="chevron-down" size="sm" class="text-gray-600 dark:text-gray-400" />
										</IconButton>
									{/if}
								</div>
							{/if}
						</div>
					</div>

					<!-- Chat view -->
					<ChatView
						messages={appState.displayMessages}
						archiveId={appState.selectedChat.archiveId}
						chatTitle={appState.selectedChat.title}
						{currentUser}
						searchQuery={appState.activeSearchQuery}
						isSearchMatch={appState.isSearchMatch}
						currentSearchResultId={appState.currentSearchResultId}
						{scrollToMessageId}
						autoLoadMedia={autoLoadMediaForCurrentChat}
						precomputedMessageIndex={appState.selectedChat.messageIndex}
						precomputedFlatItems={appState.selectedChat.flatItems}
						precomputedMessagesById={appState.selectedChat.messagesById}
					/>
				</div>

				<!-- Media gallery panel (slide from right) -->
				<div
					class="gallery-panel w-96 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col {showMediaGallery ? 'gallery-open' : 'gallery-closed'}"
					class:electron-mac={isElectronMac}
				>
					<div class="flex-1 overflow-hidden">
						<MediaGallery
							onNavigateToMessage={handleNavigateToMediaMessage}
							onClose={() => (showMediaGallery = false)}
						/>
					</div>
				</div>

				<!-- Bookmarks panel (slide from right) -->
				<div
					class="bookmarks-panel w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col {showBookmarks ? 'bookmarks-open' : 'bookmarks-closed'}"
					class:electron-mac={isElectronMac}
				>
					<!-- Bookmarks content -->
					<div class="flex-1 overflow-hidden">
						<BookmarksPanel
							currentArchiveId={appState.selectedChat.archiveId}
							onNavigateToMessage={handleNavigateToBookmark}
							onClose={() => showBookmarks = false}
							indexedArchiveIds={appState.indexedArchiveIds}
						/>
					</div>
				</div>

				<!-- Stats modal -->
				{#if showStats}
					<ChatStats
						chat={appState.selectedChat}
						onClose={() => (showStats = false)}
					/>
				{/if}

				<!-- Participants modal -->
				<Modal open={showParticipants && !!appState.selectedChat && !!participantStats} onClose={closeParticipantsModal}>
					<ModalHeader
						icon="users"
						title={m.participants_title()}
						subtitle={appState.selectedChat ? m.participants_members({ count: appState.selectedChat.participants.length }) : ''}
						onClose={closeParticipantsModal}
						closeLabel={m.participants_close()}
					/>
					<ModalContent>
						{#if appState.selectedChat && participantStats}
							{#each appState.selectedChat.participants as participant}
								{@const messageCount = participantStats.get(participant) || 0}
								{@const isPhoneNumber = /\+?\d[\d\s\-()]{8,}/.test(participant)}
								{@const contactInfo = appState.selectedChat.contacts?.get(participant.toLowerCase())}
								{@const phoneFromVcf = contactInfo?.phoneNumber}
								<div class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0">
									<!-- Avatar -->
									<div class="w-10 h-10 rounded-full bg-[var(--color-whatsapp-teal)] flex items-center justify-center text-white font-semibold flex-shrink-0">
										{participant.charAt(0).toUpperCase()}
									</div>
									
									<!-- Participant info -->
									<div class="flex-1 min-w-0">
										<p class="font-medium text-gray-900 dark:text-white truncate">
											{participant}
										</p>
										{#if phoneFromVcf}
											<!-- Phone number from VCF file -->
											<p class="text-xs text-[var(--color-whatsapp-teal)] font-medium">
												{phoneFromVcf}
											</p>
											<p class="text-xs text-gray-400 dark:text-gray-500">
												{m.participants_phone_from_vcf()}
											</p>
										{:else if isPhoneNumber}
											<p class="text-xs text-gray-500 dark:text-gray-400">
												{m.participants_phone_number()}
											</p>
										{:else}
											<p class="text-xs text-gray-500 dark:text-gray-400">
												{m.participants_contact_name()}
											</p>
										{/if}
									</div>
									
									<!-- Message count for this participant -->
									{#if messageCount > 0}
										<div class="text-right flex-shrink-0">
											<p class="text-sm font-medium text-[var(--color-whatsapp-teal)]">{messageCount}</p>
											<p class="text-xs text-gray-400">{m.participants_messages()}</p>
										</div>
									{/if}
								</div>
							{/each}
						{/if}
					</ModalContent>
				</Modal>
			{:else}
				<!-- No chat selected -->
				<div class="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
					<div class="text-center text-gray-500 dark:text-gray-400">
						<Icon name="chat" size="2xl" class="mx-auto mb-4 opacity-50" />
						<p>{m.chat_select()}</p>
					</div>
				</div>
			{/if}

			<!-- Global search panel (slide from right; works with no chat selected) -->
			<div
				class="global-search-slot flex-shrink-0 flex {showGlobalSearch ? 'global-search-open' : 'global-search-closed'}"
			>
				<GlobalSearchPanel
					searchState={globalSearchState}
					senders={globalSearchSenders}
					onNavigate={handleGlobalSearchNavigate}
					onReselectSource={handleGlobalSearchReselectSource}
					onClose={() => (showGlobalSearch = false)}
				/>
			</div>
		</div>
	</div>
{/if}
</div>

<!-- Auto-update toast notification (Electron only) -->
{#if isElectron && autoUpdaterState.isElectron}
	<AutoUpdateToast />
{/if}
<!-- Restore Session Modal -->
{#if showRestoreSessionModal}
<RestoreSessionModal
persistedChats={persistedChatsToRestore}
onRestore={handleRestoreChats}
onStartFresh={handleStartFresh}
onClose={handleStartFresh}
/>
{/if}

<!-- Reselect File Modal -->
{#if showReselectFileModal && reselectChatMetadata}
<ReselectFileModal
chatMetadata={reselectChatMetadata}
onFileSelected={handleReselectFile}
onSkip={handleSkipReselect}
onClose={handleSkipReselect}
/>
{/if}

<!-- Remove-from-library confirmation (§5) -->
<Modal open={confirmingRemoveArchiveId !== null} onClose={cancelForgetChat}>
	<ModalHeader
		icon="trash"
		title={m.global_search_remove_from_library()}
		onClose={cancelForgetChat}
		closeLabel={m.global_search_cancel()}
	/>
	<ModalContent>
		<p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
			{m.remove_from_library_confirm_body()}
		</p>
	</ModalContent>
	<div class="flex justify-end gap-2 p-4 sm:px-6 border-t border-gray-200 dark:border-gray-700">
		<Button variant="secondary" onclick={cancelForgetChat}>
			{m.global_search_cancel()}
		</Button>
		<Button variant="danger" onclick={confirmForgetChat}>
			{m.global_search_confirm()}
		</Button>
	</div>
</Modal>

<!-- Toast Notification -->
{#if toastMessage}
<Toast message={toastMessage} type={toastType} onClose={hideToast} />
{/if}

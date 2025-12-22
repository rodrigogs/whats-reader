<script lang="ts">
import { tick } from 'svelte';
import { browser } from '$app/environment';
import { floating } from '$lib/actions/floating';
import { getAutoUpdaterState, initAutoUpdater } from '$lib/auto-updater.svelte';
import {
	ChatList,
	ChatStats,
	ChatView,
	FileDropZone,
	SearchBar,
	VersionBadge,
} from '$lib/components';
import AutoUpdateToast from '$lib/components/AutoUpdateToast.svelte';
import BookmarksPanel from '$lib/components/BookmarksPanel.svelte';
import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
import MediaGallery from '$lib/components/MediaGallery.svelte';
import * as m from '$lib/paraglide/messages';
import { parseZipFile, readFileAsArrayBuffer } from '$lib/parser';
import { appState, type ChatData } from '$lib/state.svelte';
import { setTranscriptionLanguage } from '$lib/transcription.svelte';

// Detect if running in Electron
const isElectron =
	browser && typeof window !== 'undefined' && 'electronAPI' in window;

// Detect if running in Electron on macOS (only macOS needs custom titlebar)
const isElectronMac =
	isElectron &&
	typeof window !== 'undefined' &&
	(window as Window & { electronAPI?: { platform?: string } }).electronAPI
		?.platform === 'darwin';

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
let showBookmarks = $state(false);
let showMediaGallery = $state(false);
let showParticipants = $state(false);
let participantStats = $state<Map<string, number> | null>(null);
let scrollToMessageId = $state<string | null>(null);

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

// Loading chats state - shows placeholder items while importing
interface LoadingChat {
	id: string;
	filename: string;
	progress: number;
	stage: 'reading' | 'extracting' | 'parsing';
}
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

// Store selected perspective per chat (chatTitle -> participant name or null for "None")
let perspectiveByChat = $state<Map<string, string | null>>(new Map());

// Store transcription language per chat (chatTitle -> language code)
let languageByChat = $state<Map<string, string>>(new Map());

// Store auto-load media preference per chat (chatTitle -> enabled)
let autoLoadMediaByChat = $state<Map<string, boolean>>(new Map());

// Get auto-load media setting for the current chat
const autoLoadMediaForCurrentChat = $derived.by(() => {
	if (!appState.selectedChat) return false;
	return autoLoadMediaByChat.get(appState.selectedChat.title) || false;
});

async function handleFilesSelected(files: FileList) {
	appState.clearError();

	for (const file of files) {
		if (!file.name.endsWith('.zip')) {
			appState.setError(m.error_unsupported_file({ filename: file.name }));
			continue;
		}

		// Create a loading placeholder for this file
		const loadingId = crypto.randomUUID();
		const filename = file.name
			.replace(/\.zip$/i, '')
			.replace(/^WhatsApp Chat (with |com )/i, '');

		loadingChats = [
			...loadingChats,
			{
				id: loadingId,
				filename,
				progress: 0,
				stage: 'reading',
			},
		];

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
					async ({ stage, progress }) => {
						const STAGE_PROGRESS = {
							reading: { offset: 0.0, weight: 0.1 },
							extracting: { offset: 0.1, weight: 0.5 },
							parsing: { offset: 0.6, weight: 0.4 },
						} as const;

						const { offset: stageOffset, weight: stageWeight } =
							STAGE_PROGRESS[stage] ?? STAGE_PROGRESS.extracting;

						const overallProgress =
							10 + (stageOffset + (progress / 100) * stageWeight) * 90;

						loadingChats = loadingChats.map((lc) =>
							lc.id === loadingId
								? { ...lc, progress: overallProgress, stage }
								: lc,
						);
					},
				);

				// Remove loading placeholder and add actual chat
				loadingChats = loadingChats.filter((lc) => lc.id !== loadingId);
				appState.addChat(chatData);

				// Start background indexing for bookmark navigation and flat items
				const indexWorker = new Worker(
					new URL('$lib/workers/index-worker.ts', import.meta.url),
					{ type: 'module' },
				);

				indexWorker.onmessage = (
					event: MessageEvent<{
						chatTitle: string;
						indexEntries: [string, number][];
						flatItems: Array<
							| { type: 'date'; date: string }
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
					const { chatTitle, indexEntries, flatItems, serializedMessages } =
						event.data;
					const messageIndex = new Map(indexEntries);
					appState.updateChatMessageIndex(chatTitle, messageIndex);
					appState.updateChatFlatItems(chatTitle, flatItems);
					appState.updateChatSerializedMessages(chatTitle, serializedMessages);
					indexWorker.terminate();
				};

				indexWorker.onerror = (err) => {
					console.error('Index worker error:', err);
					indexWorker.terminate();
				};

				// Send messages to worker for indexing
				const serializedMessages = chatData.messages.map((m) => ({
					id: m.id,
					timestamp: m.timestamp.toISOString(),
					sender: m.sender,
					content: m.content,
					isSystemMessage: m.isSystemMessage,
					isMediaMessage: m.isMediaMessage,
					mediaType: m.mediaType,
					rawLine: m.rawLine,
				}));

				indexWorker.postMessage({
					messages: serializedMessages,
					chatTitle: chatData.title,
				});

				// On mobile, collapse sidebar after loading chats
				if (browser && window.innerWidth < 768) {
					showSidebar = false;
				}
			} catch (error) {
				console.error('Error parsing file:', error);
				// Remove loading placeholder on error
				loadingChats = loadingChats.filter((lc) => lc.id !== loadingId);
				appState.setError(
					error instanceof Error ? error.message : 'Failed to parse file',
				);
			}
		})();
	}
}

function handleSelectChat(index: number) {
	appState.selectChat(index);
	// Set the transcription language for this chat
	const chat = appState.chats[index];
	if (chat) {
		const lang = languageByChat.get(chat.title) || 'portuguese';
		setTranscriptionLanguage(lang);
	}
	// On mobile, collapse sidebar after selecting a chat
	if (browser && window.innerWidth < 768) {
		showSidebar = false;
	}
}

function handleRemoveChat(index: number) {
	appState.removeChat(index);
}

function handleLanguageChange(chatTitle: string, language: string) {
	languageByChat.set(chatTitle, language);
	languageByChat = new Map(languageByChat); // trigger reactivity
	// If this is the currently selected chat, update the transcription service
	if (appState.selectedChat?.title === chatTitle) {
		setTranscriptionLanguage(language);
	}
}

function handleAutoLoadMediaChange(chatTitle: string, enabled: boolean) {
	autoLoadMediaByChat.set(chatTitle, enabled);
	autoLoadMediaByChat = new Map(autoLoadMediaByChat); // trigger reactivity
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

async function handleNavigateToBookmark(messageId: string, chatId: string) {
	// Find and select the chat if different from current
	const chatIndex = appState.chats.findIndex((c) => c.title === chatId);
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
		// Create a new Map to trigger reactivity
		const newMap = new Map(perspectiveByChat);
		newMap.set(appState.selectedChat.title, participant);
		perspectiveByChat = newMap;
	}
	showPerspectiveDropdown = false;
	perspectiveSearchQuery = '';
}

// Get current perspective for selected chat
const currentPerspective = $derived.by(() => {
	if (!appState.selectedChat) return null;
	return perspectiveByChat.get(appState.selectedChat.title) ?? null;
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
						<svg class="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
						</svg>
					{:else}
						<!-- Moon icon -->
						<svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
						</svg>
					{/if}
				</button>
			</div>
			
			<!-- Scrollable content area -->
			<div class="flex-1 overflow-y-auto">
				<div class="flex flex-col items-center p-4 sm:p-8 min-h-full">
					<div class="max-w-lg w-full flex flex-col items-center py-8">
					<!-- Logo and title -->
					<div class="text-center mb-6">
						<div class="w-16 h-16 mx-auto mb-3 rounded-full bg-[var(--color-whatsapp-green)] flex items-center justify-center shadow-lg">
							<svg class="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
								<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
							</svg>
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
				<details class="mt-6 w-full group">
					<summary class="flex items-center justify-center gap-2 cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors select-none">
						<svg class="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
						</svg>
						{m.export_instructions_title()}
					</summary>
					<div class="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-600 dark:text-gray-400">
						<div class="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
							<span class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">1</span>
							<span>{m.export_step_1()}</span>
						</div>
						<div class="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
							<span class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">2</span>
							<span>{m.export_step_2()}</span>
						</div>
						<div class="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
							<span class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">3</span>
							<span>{m.export_step_3()}</span>
						</div>
						<div class="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
							<span class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">4</span>
							<span>{m.export_step_4()}</span>
						</div>
						<div class="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
							<span class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">5</span>
							<span>{m.export_step_5()}</span>
						</div>
					</div>
				</details>

				<!-- Privacy & Security - Collapsible -->
				<details class="mt-4 w-full group">
					<summary class="flex items-center justify-center gap-2 cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors select-none">
						<svg class="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
						</svg>
						{m.privacy_title()}
					</summary>
					<div class="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-600 dark:text-gray-400">
						<div class="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
							<span class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center">
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728M12 12v.01"/>
								</svg>
							</span>
							<span>{m.privacy_offline()}</span>
						</div>
						<div class="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
							<span class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center">
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
								</svg>
							</span>
							<span>{m.privacy_local_processing()}</span>
						</div>
						<div class="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
							<span class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center">
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
								</svg>
							</span>
							<span>{m.privacy_local_ai()}</span>
						</div>
						<div class="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
							<span class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center">
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
								</svg>
							</span>
							<span>{m.privacy_no_tracking()}</span>
						</div>
						<div class="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
							<span class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center">
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
								</svg>
							</span>
							<span>{m.privacy_open_source()}</span>
						</div>
					</div>
				</details>

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
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
							<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
						</svg>
						<svg class="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
							<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
						</svg>
						{m.github_star_cta()}
					</a>
				</div>
			</div>
		</div>
	</div>
	</div>
	{:else}
		<!-- Main app layout -->
		<div class="flex-1 flex overflow-hidden">
			<!-- Sidebar -->
			<div
				class="sidebar-panel w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col {showSidebar ? 'sidebar-open' : 'sidebar-closed'}"
				class:electron-mac={isElectronMac}
			>
				<!-- Sidebar header - empty green bar to match main header -->
				<div class="h-16 bg-[var(--color-whatsapp-dark-green)] flex-shrink-0"></div>
				
				<!-- Chats title bar - matches search bar styling exactly -->
				<div class="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
					<label class="relative flex items-center w-full h-10 pl-10 pr-4 bg-gray-100 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
						<div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
							<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
							</svg>
						</div>
						<span class="text-gray-500">{m.import_chat()}</span>
						<input
							type="file"
							accept=".txt,.zip"
							class="hidden"
							onchange={(e) => {
								const input = e.target as HTMLInputElement;
								if (input.files) handleFilesSelected(input.files);
							}}
							multiple
						/>
					</label>
				</div>

				<!-- Chat list -->
				<div class="flex-1 overflow-hidden">
					<ChatList
						chats={appState.chats}
						selectedIndex={appState.selectedChatIndex}
						onSelect={handleSelectChat}
						onRemove={handleRemoveChat}
						{languageByChat}
						onLanguageChange={handleLanguageChange}
						{autoLoadMediaByChat}
						onAutoLoadMediaChange={handleAutoLoadMediaChange}
						{loadingChats}
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
					<!-- Chat header -->
					<div class="h-16 px-4 flex items-center gap-3 bg-[var(--color-whatsapp-dark-green)] text-white shadow-md flex-shrink-0">
						<!-- Sidebar toggle button -->
						<button
							class="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
							onclick={toggleSidebar}
							aria-label={m.sidebar_toggle()}
							title={m.sidebar_toggle()}
						>
							{#if showSidebar}
								<!-- Close icon (arrow left) -->
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
								</svg>
							{:else}
								<!-- Menu icon (hamburger lines) -->
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
								</svg>
							{/if}
						</button>

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
							<!-- Perspective selector -->
							<div class="relative">
								<button
									bind:this={perspectiveButtonRef}
									class="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer {currentPerspective ? 'bg-white/20' : ''}"
									onclick={() => showPerspectiveDropdown = !showPerspectiveDropdown}
									title={m.perspective_view_as()}
									aria-label={m.perspective_select()}
								>
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
									</svg>
								</button>
								
								{#if showPerspectiveDropdown && perspectiveButtonRef}
									<!-- Backdrop to close dropdown -->
									<button 
										type="button"
										class="fixed inset-0 z-40 cursor-default" 
										onclick={() => { showPerspectiveDropdown = false; perspectiveSearchQuery = ''; }}
										aria-label={m.sidebar_close()}
									></button>
									
									<!-- Dropdown menu -->
									<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
									<div
										role="menu"
										tabindex="-1"
										class="fixed w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
										use:floating={{
											reference: perspectiveButtonRef,
											placement: 'bottom-end',
											fallbackPlacements: ['bottom-start', 'top-end', 'top-start', 'left-start', 'right-start'],
											offsetDistance: 8,
											enableSizeConstraint: true
										}}
										onclick={(e) => e.stopPropagation()}
									>
										<div class="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
											{m.perspective_view_as()}
										</div>
										
										<!-- Search input -->
										<div class="p-2 border-b border-gray-100 dark:border-gray-700">
											<div class="relative">
												<svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
												</svg>
												<input
													bind:this={perspectiveSearchInputRef}
													type="text"
													bind:value={perspectiveSearchQuery}
													placeholder={m.perspective_search_placeholder()}
													class="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border-0 rounded-md focus:ring-2 focus:ring-[var(--color-whatsapp-teal)] focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
												/>
											</div>
										</div>
										
										<!-- Options list -->
										<div class="max-h-48 overflow-y-auto py-1">
											{#if !perspectiveSearchQuery}
												<button
													class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-2 {currentPerspective === null ? 'text-[var(--color-whatsapp-teal)] font-medium' : 'text-gray-700 dark:text-gray-300'}"
													onclick={() => selectPerspective(null)}
												>
													<span class="w-5 text-center">{currentPerspective === null ? '✓' : ''}</span>
													<span class="italic">{m.perspective_none()}</span>
												</button>
											{/if}
											{#each filteredParticipants as participant}
												<button
													class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-2 {currentPerspective === participant ? 'text-[var(--color-whatsapp-teal)] font-medium' : 'text-gray-700 dark:text-gray-300'}"
													onclick={() => selectPerspective(participant)}
												>
													<span class="w-5 text-center">{currentPerspective === participant ? '✓' : ''}</span>
													<span class="truncate">{participant}</span>
												</button>
											{/each}
											{#if filteredParticipants.length === 0 && perspectiveSearchQuery}
												<div class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 italic">
													{m.perspective_no_match({ query: perspectiveSearchQuery })}
												</div>
											{/if}
										</div>
									</div>
								{/if}
							</div>

							<button
								class="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer {showMediaGallery ? 'bg-white/20' : ''}"
								onclick={toggleMediaGallery}
								title={m.media_gallery_title()}
								aria-label={m.media_gallery_toggle()}
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M7 15l3-3 3 3 3-3 2 2"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 9h.01"
									/>
								</svg>
							</button>
							<button
									class="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer {showBookmarks ? 'bg-white/20' : ''}"
									onclick={toggleBookmarks}
									title={m.bookmarks_title()}
									aria-label={m.bookmarks_toggle()}
								>
									<svg class="w-5 h-5" fill={showBookmarks ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
									</svg>
								</button>
								<button
									class="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
								onclick={toggleStats}
								title={m.stats_view()}
								aria-label={m.stats_view()}
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
								</svg>
							</button>
							<LocaleSwitcher variant="header" />
							<button
								onclick={toggleDarkMode}
								class="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
								aria-label={m.toggle_dark_mode()}
								title={isDarkMode ? m.theme_switch_to_light() : m.theme_switch_to_dark()}
							>
								{#if isDarkMode}
									<!-- Sun icon -->
									<svg class="w-5 h-5 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
									</svg>
								{:else}
									<!-- Moon icon -->
									<svg class="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
									</svg>
								{/if}
							</button>
						</div>
					</div>

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
										<button
											type="button"
											class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
											onclick={() => appState.prevSearchResult()}
											disabled={appState.totalSearchMatches === 0}
											title={m.search_previous()}
											aria-label={m.search_previous()}
										>
											<svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
											</svg>
										</button>
										<button
											type="button"
											class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
											onclick={() => appState.nextSearchResult()}
											disabled={appState.totalSearchMatches === 0}
											title={m.search_next()}
											aria-label={m.search_next()}
										>
											<svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
											</svg>
										</button>
									{/if}
								</div>
							{/if}
						</div>
					</div>

					<!-- Chat view -->
					<ChatView
						messages={appState.displayMessages}
						chatId={appState.selectedChat.title}
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
					<!-- Header spacer - matches sidebar header -->
					<div class="h-16 bg-[var(--color-whatsapp-dark-green)] flex-shrink-0"></div>
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
					<!-- Bookmarks header - matches sidebar header -->
					<div class="h-16 bg-[var(--color-whatsapp-dark-green)] flex-shrink-0"></div>
					
					<!-- Bookmarks content -->
					<div class="flex-1 overflow-hidden">
						<BookmarksPanel
							currentChatId={appState.selectedChat.title}
							onNavigateToMessage={handleNavigateToBookmark}
							onClose={() => showBookmarks = false}
							indexedChatTitles={appState.indexedChatTitles}
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
				{#if showParticipants && appState.selectedChat && participantStats}
					<!-- Backdrop -->
					<button
						type="button"
						class="fixed inset-0 bg-black/50 z-50 cursor-default"
						onclick={closeParticipantsModal}
						aria-label={m.participants_close()}
					></button>
					
					<!-- Modal -->
					<div class="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[480px] md:max-h-[80vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
						<!-- Header -->
						<div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-[var(--color-whatsapp-dark-green)] text-white">
							<div class="flex items-center gap-3">
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
								</svg>
								<div>
									<h2 class="font-semibold">{m.participants_title()}</h2>
									<p class="text-xs text-white/70">{m.participants_members({ count: appState.selectedChat.participants.length })}</p>
								</div>
							</div>
							<button
								type="button"
								class="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
								onclick={closeParticipantsModal}
								aria-label={m.participants_close()}
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
						
						<!-- Participants list -->
						<div class="flex-1 overflow-y-auto">
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
						</div>
					</div>
				{/if}
			{:else}
				<!-- No chat selected -->
				<div class="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
				<div class="h-16 px-4 flex items-center bg-[var(--color-whatsapp-dark-green)] flex-shrink-0">
					<!-- Sidebar toggle button -->
					<button
						class="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-white"
						onclick={toggleSidebar}
						aria-label={m.sidebar_toggle()}
						title={m.sidebar_toggle()}
					>
						{#if showSidebar}
							<!-- Close icon (arrow left) -->
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
							</svg>
						{:else}
							<!-- Menu icon (hamburger lines) -->
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
							</svg>
						{/if}
					</button>
				</div>
					<div class="flex-1 flex items-center justify-center">
						<div class="text-center text-gray-500 dark:text-gray-400">
							<svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
							</svg>
							<p>{m.chat_select()}</p>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Auto-update toast notification (Electron only) -->
{#if isElectron && autoUpdaterState.isElectron}
	<AutoUpdateToast />
{/if}
<script lang="ts">
import { tick } from 'svelte';
import { browser } from '$app/environment';
import { floating } from '$lib/actions/floating';
import { getAutoUpdaterState, initAutoUpdater } from '$lib/auto-updater.svelte';
import {
	ChatList,
	ChatStats,
	ChatView,
	Collapsible,
	FeatureItem,
	FileDropZone,
	SearchBar,
	VersionBadge,
} from '$lib/components';
import AutoUpdateToast from '$lib/components/AutoUpdateToast.svelte';
import BookmarksPanel from '$lib/components/BookmarksPanel.svelte';
import Icon from '$lib/components/Icon.svelte';
import IconButton from '$lib/components/IconButton.svelte';
import ListItemButton from '$lib/components/ListItemButton.svelte';
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
						<div class="w-16 h-16 mx-auto mb-3 rounded-full bg-[var(--color-whatsapp-green)] flex items-center justify-center shadow-lg">
							<Icon name="whatsapp" size="2xl" class="text-white" />
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
							<Icon name="plus" size="md" class="text-gray-400" />
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
												<div class="absolute left-2.5 top-1/2 -translate-y-1/2">
													<Icon name="search" size="sm" class="text-gray-400" />
												</div>
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
										</div>
									</div>
								{/if}
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
								<Icon name="users" size="md" />
								<div>
									<h2 class="font-semibold">{m.participants_title()}</h2>
									<p class="text-xs text-white/70">{m.participants_members({ count: appState.selectedChat.participants.length })}</p>
								</div>
							</div>
							<IconButton
								theme="dark"
								size="sm"
								onclick={closeParticipantsModal}
								aria-label={m.participants_close()}
							>
								<Icon name="close" size="md" />
							</IconButton>
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
					</div>
					<div class="flex-1 flex items-center justify-center">
						<div class="text-center text-gray-500 dark:text-gray-400">
							<Icon name="chat" size="2xl" class="mx-auto mb-4 opacity-50" />
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
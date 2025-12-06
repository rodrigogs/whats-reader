<script lang="ts">
import { tick } from 'svelte';
import { browser } from '$app/environment';
import { floating } from '$lib/actions/floating';
import {
	ChatList,
	ChatStats,
	ChatView,
	FileDropZone,
	SearchBar,
} from '$lib/components';
import BookmarksPanel from '$lib/components/BookmarksPanel.svelte';
import { parseZipFile, readFileAsArrayBuffer } from '$lib/parser';
import { appState, type ChatData } from '$lib/state.svelte';
import { setTranscriptionLanguage } from '$lib/transcription.svelte';

// Detect if running in Electron
const isElectron =
	browser && typeof window !== 'undefined' && 'electronAPI' in window;

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

let showStats = $state(false);
let showSidebar = $state(true);
let showBookmarks = $state(false);
let scrollToMessageId = $state<string | null>(null);
let showPerspectiveDropdown = $state(false);
let perspectiveSearchQuery = $state('');
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
	appState.setLoading(true);
	appState.clearError();
	appState.setLoadingProgress(0);

	try {
		const totalFiles = files.length;
		let processedFiles = 0;

		for (const file of files) {
			if (!file.name.endsWith('.zip')) {
				throw new Error(
					`Unsupported file type: ${file.name}. Only .zip files are supported.`,
				);
			}

			const fileBaseProgress = (processedFiles / totalFiles) * 100;
			const fileWeight = 100 / totalFiles;

			// Read file (0-10% of file progress)
			const buffer = await readFileAsArrayBuffer(file, (readProgress) => {
				const overallProgress =
					fileBaseProgress + (readProgress / 100) * (fileWeight * 0.1);
				appState.setLoadingProgress(overallProgress);
			});

			// Parse ZIP file using Web Worker (10-100% of file progress)
			// The worker handles all heavy processing without blocking the UI
			const chatData: ChatData = await parseZipFile(
				buffer,
				async ({ stage, progress }) => {
					// Progress stages: Reading (0-10%), Extracting (10-60%), Parsing (60-100%)
					const STAGE_PROGRESS = {
						reading: { offset: 0.0, weight: 0.1 },
						extracting: { offset: 0.1, weight: 0.5 },
						parsing: { offset: 0.6, weight: 0.4 },
					} as const;

					const { offset: stageOffset, weight: stageWeight } =
						STAGE_PROGRESS[stage] ?? STAGE_PROGRESS.extracting;

					const overallProgress =
						fileBaseProgress +
						(stageOffset + (progress / 100) * stageWeight) * fileWeight;
					appState.setLoadingProgress(overallProgress);
				},
			);

			appState.addChat(chatData);
			processedFiles++;
			appState.setLoadingProgress((processedFiles / totalFiles) * 100);
		}

		// On mobile, collapse sidebar after loading chats
		if (browser && window.innerWidth < 768) {
			showSidebar = false;
		}
	} catch (error) {
		console.error('Error parsing file:', error);
		appState.setError(
			error instanceof Error ? error.message : 'Failed to parse file',
		);
	} finally {
		appState.setLoading(false);
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
	<!-- Electron drag region for macOS titlebar (only shown in Electron) -->
	{#if isElectron}
		<div class="electron-drag h-[38px] flex-shrink-0 bg-[var(--color-whatsapp-dark-green)] flex items-center justify-end px-3">
			<!-- Dark mode toggle in title bar -->
			{#if !appState.hasChats || !appState.selectedChat}
				<button
					onclick={toggleDarkMode}
					class="electron-no-drag p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
					aria-label="Toggle dark mode"
					title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
				>
					{#if isDarkMode}
						<svg class="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
						</svg>
					{:else}
						<svg class="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
						</svg>
					{/if}
				</button>
			{/if}
		</div>
	{/if}

	<!-- Dark mode toggle button (top right corner) - only shown when no chat is open AND not in Electron -->
	{#if (!appState.hasChats || !appState.selectedChat) && !isElectron}
		<button
			onclick={toggleDarkMode}
			class="fixed top-4 right-4 z-50 p-2 rounded-full bg-gray-200/80 dark:bg-gray-800/80 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors backdrop-blur-sm cursor-pointer"
			aria-label="Toggle dark mode"
			title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
		>
			{#if isDarkMode}
				<!-- Sun icon -->
				<svg class="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
				</svg>
			{:else}
				<!-- Moon icon -->
				<svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
				</svg>
			{/if}
		</button>
	{/if}

	{#if !appState.hasChats}
		<!-- Empty state - show file upload -->
		<div class="flex-1 flex items-center justify-center p-8">
			<div class="max-w-lg w-full flex flex-col items-center">
				<!-- Logo and title -->
				<div class="text-center mb-8">
					<div class="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--color-whatsapp-green)] flex items-center justify-center shadow-lg">
						<svg class="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
							<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
						</svg>
					</div>
					<h1 class="text-3xl font-bold text-gray-800 dark:text-white mb-2">
						WhatsApp Backup Reader
					</h1>
					<p class="text-gray-500 dark:text-gray-400">
						View and analyze your WhatsApp chat exports
					</p>
				</div>

				<!-- Drop zone -->
				<div class="w-full">
					<FileDropZone onFilesSelected={handleFilesSelected} isLoading={appState.isLoading} loadingProgress={appState.loadingProgress} />
				</div>

				{#if appState.error}
					<div class="mt-4 w-full p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
						<p class="text-red-700 dark:text-red-400 text-sm text-center">
							{appState.error}
						</p>
					</div>
				{/if}

				<!-- Instructions -->
				<div class="mt-8 w-full">
					<div class="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700/50">
						<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 text-center">
							How to export your WhatsApp chat
						</h3>
						<ol class="text-sm text-gray-600 dark:text-gray-400 space-y-2">
							<li class="flex items-start gap-3">
								<span class="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-whatsapp-green)] text-white text-xs flex items-center justify-center font-medium">1</span>
								<span>Open WhatsApp on your phone</span>
							</li>
							<li class="flex items-start gap-3">
								<span class="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-whatsapp-green)] text-white text-xs flex items-center justify-center font-medium">2</span>
								<span>Go to the chat you want to export</span>
							</li>
							<li class="flex items-start gap-3">
								<span class="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-whatsapp-green)] text-white text-xs flex items-center justify-center font-medium">3</span>
								<span>Tap <strong class="text-gray-700 dark:text-gray-300">⋮</strong> → More → Export chat</span>
							</li>
							<li class="flex items-start gap-3">
								<span class="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-whatsapp-green)] text-white text-xs flex items-center justify-center font-medium">4</span>
								<span>Choose "Include media" for full backup</span>
							</li>
							<li class="flex items-start gap-3">
								<span class="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-whatsapp-green)] text-white text-xs flex items-center justify-center font-medium">5</span>
								<span>Save the .zip file and upload it here</span>
							</li>
						</ol>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<!-- Main app layout -->
		<div class="flex-1 flex overflow-hidden">
			<!-- Sidebar toggle for mobile - Hamburger with smooth X morph animation -->
			<button
				class="hamburger-btn md:hidden fixed bottom-4 left-4 z-50 w-11 h-11 rounded-full bg-[var(--color-whatsapp-teal)] text-white shadow-lg flex items-center justify-center {showSidebar ? 'is-active' : ''}"
				onclick={toggleSidebar}
				aria-label="Toggle sidebar"
			>
				<div class="hamburger-icon">
					<span class="hamburger-line"></span>
					<span class="hamburger-line"></span>
					<span class="hamburger-line"></span>
				</div>
			</button>

			<!-- Sidebar -->
			<div
				class="sidebar-panel w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col {showSidebar ? 'sidebar-open' : 'sidebar-closed'}"
			>
				<!-- Import button -->
				<div class="p-4 border-b border-gray-200 dark:border-gray-700">
					<label class="flex items-center justify-center gap-2 w-full py-2 px-4 bg-[var(--color-whatsapp-teal)] hover:bg-[var(--color-whatsapp-dark-green)] text-white rounded-lg cursor-pointer transition-colors">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
						</svg>
						<span>Import Chat</span>
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
					/>
				</div>
			</div>

			<!-- Overlay for mobile sidebar -->
			{#if showSidebar}
				<button
					class="md:hidden fixed inset-0 bg-black/50 z-30"
					onclick={() => (showSidebar = false)}
					aria-label="Close sidebar"
				></button>
			{/if}

			<!-- Main content -->
			{#if appState.selectedChat}
				<div class="flex-1 flex flex-col overflow-hidden">
					<!-- Chat header -->
					<div class="h-16 px-4 flex items-center gap-4 bg-[var(--color-whatsapp-dark-green)] text-white shadow-md">
						<!-- Toggle sidebar button -->
						<button 
							class="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
							onclick={toggleSidebar}
							aria-label={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
							title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
						>
							<svg class="w-6 h-6 transition-transform {showSidebar ? '' : 'rotate-180'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
							</svg>
						</button>

						<!-- Avatar -->
						<div class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-semibold">
							{appState.selectedChat.title.charAt(0).toUpperCase()}
						</div>

						<!-- Chat info -->
						<div class="flex-1 min-w-0">
							<h2 class="font-semibold truncate">{appState.selectedChat.title}</h2>
							<p class="text-xs text-white/70 truncate">
								{appState.selectedChat.participants.slice(0, 5).join(', ')}
								{#if appState.selectedChat.participants.length > 5}
									+{appState.selectedChat.participants.length - 5} more
								{/if}
							</p>
						</div>

						<!-- Actions -->
						<div class="flex items-center gap-2">
							<!-- Perspective selector -->
							<div class="relative">
								<button
									bind:this={perspectiveButtonRef}
									class="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer {currentPerspective ? 'bg-white/20' : ''}"
									onclick={() => showPerspectiveDropdown = !showPerspectiveDropdown}
									title="View as participant"
									aria-label="Select perspective"
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
										aria-label="Close menu"
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
											View as
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
													placeholder="Search by name or number..."
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
													<span class="italic">None (all messages left)</span>
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
													No participants match "{perspectiveSearchQuery}"
												</div>
											{/if}
										</div>
									</div>
								{/if}
							</div>

							<button
									class="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer {showBookmarks ? 'bg-white/20' : ''}"
									onclick={toggleBookmarks}
									title="Bookmarks"
									aria-label="Toggle bookmarks"
								>
									<svg class="w-5 h-5" fill={showBookmarks ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
									</svg>
								</button>
								<button
									class="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
								onclick={toggleStats}
								title="View statistics"
								aria-label="View statistics"
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
								</svg>
							</button>
							<!-- Dark mode toggle in header -->
							<button
								class="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
								onclick={toggleDarkMode}
								title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
								aria-label="Toggle dark mode"
							>
								{#if isDarkMode}
									<svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
									</svg>
								{:else}
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
									placeholder="Search in chat..."
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
											{#if appState.searchResultIds.length > 0}
												{appState.currentSearchIndex + 1} of {appState.searchResultIds.length}
											{:else}
												No results
											{/if}
										</span>
										<!-- Navigation buttons -->
										<button
											type="button"
											class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
											onclick={() => appState.prevSearchResult()}
											disabled={appState.searchResultIds.length === 0}
											title="Previous match (↑)"
											aria-label="Previous match"
										>
											<svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
											</svg>
										</button>
										<button
											type="button"
											class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
											onclick={() => appState.nextSearchResult()}
											disabled={appState.searchResultIds.length === 0}
											title="Next match (↓)"
											aria-label="Next match"
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
						searchQuery={appState.searchQuery}
						searchResultSet={appState.searchResultSet}
						currentSearchResultId={appState.currentSearchResultId}
						{scrollToMessageId}
						autoLoadMedia={autoLoadMediaForCurrentChat}
					/>
				</div>

				<!-- Bookmarks panel (slide from right) -->
				{#if showBookmarks}
					<div class="w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-700">
						<BookmarksPanel
							currentChatId={appState.selectedChat.title}
							onNavigateToMessage={handleNavigateToBookmark}
							onClose={() => showBookmarks = false}
						/>
					</div>
				{/if}

				<!-- Stats modal -->
				{#if showStats}
					<ChatStats
						chat={appState.selectedChat}
						onClose={() => (showStats = false)}
					/>
				{/if}
			{:else}
				<!-- No chat selected -->
				<div class="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
					<div class="text-center text-gray-500 dark:text-gray-400">
						<svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
						</svg>
						<p>Select a chat to view messages</p>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

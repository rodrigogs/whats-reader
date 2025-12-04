<script lang="ts">
	import { appState, type ChatData } from '$lib/state.svelte';
	import { parseZipFile, readFileAsArrayBuffer } from '$lib/parser';
	import { ChatList, ChatView, ChatStats, FileDropZone, SearchBar } from '$lib/components';

	let showStats = $state(false);
	let showSidebar = $state(true);

	async function handleFilesSelected(files: FileList) {
		appState.setLoading(true);
		appState.clearError();
		appState.setLoadingProgress(0);

		try {
			const totalFiles = files.length;
			let processedFiles = 0;

			for (const file of files) {
				if (!file.name.endsWith('.zip')) {
					throw new Error(`Unsupported file type: ${file.name}. Only .zip files are supported.`);
				}

				const fileBaseProgress = (processedFiles / totalFiles) * 100;
				const fileWeight = 100 / totalFiles;

				// Read file (0-10% of file progress)
				const buffer = await readFileAsArrayBuffer(file, (readProgress) => {
					const overallProgress = fileBaseProgress + (readProgress / 100) * (fileWeight * 0.1);
					appState.setLoadingProgress(overallProgress);
				});
				
				// Parse ZIP file using Web Worker (10-100% of file progress)
				// The worker handles all heavy processing without blocking the UI
				const chatData: ChatData = await parseZipFile(buffer, async ({ stage, progress }) => {
					// Progress stages: Reading (0-10%), Extracting (10-60%), Parsing (60-100%)
					const STAGE_PROGRESS = {
						reading:    { offset: 0.0, weight: 0.1 },
						extracting: { offset: 0.1, weight: 0.5 },
						parsing:    { offset: 0.6, weight: 0.4 }
					} as const;

					const { offset: stageOffset, weight: stageWeight } = STAGE_PROGRESS[stage] ?? STAGE_PROGRESS['extracting'];
					
					const overallProgress = fileBaseProgress + (stageOffset + (progress / 100) * stageWeight) * fileWeight;
					appState.setLoadingProgress(overallProgress);
				});
				
				appState.addChat(chatData);
				processedFiles++;
				appState.setLoadingProgress((processedFiles / totalFiles) * 100);
			}
		} catch (error) {
			console.error('Error parsing file:', error);
			appState.setError(error instanceof Error ? error.message : 'Failed to parse file');
		} finally {
			appState.setLoading(false);
		}
	}

	function handleSelectChat(index: number) {
		appState.selectChat(index);
	}

	function handleRemoveChat(index: number) {
		appState.removeChat(index);
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

	// Determine current user (first participant after the phone number pattern)
	const currentUser = $derived.by(() => {
		if (!appState.selectedChat) return undefined;
		// In most exports, "You" is not explicitly shown, so we try to guess
		// based on the most active participant
		return appState.selectedChat.participants[0];
	});
</script>

<div class="h-screen flex flex-col bg-gray-100 dark:bg-gray-950">
	<!-- Electron drag region for macOS titlebar -->
	<div class="electron-drag h-8 flex-shrink-0 bg-[var(--color-whatsapp-dark-green)]"></div>

	{#if !appState.hasChats}
		<!-- Empty state - show file upload -->
		<div class="flex-1 flex items-center justify-center p-8">
			<div class="max-w-xl w-full">
				<div class="text-center mb-8">
					<div class="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--color-whatsapp-green)] flex items-center justify-center">
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

				<FileDropZone onFilesSelected={handleFilesSelected} isLoading={appState.isLoading} loadingProgress={appState.loadingProgress} />

				{#if appState.error}
					<div class="mt-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
						<p class="text-red-700 dark:text-red-400 text-sm">
							{appState.error}
						</p>
					</div>
				{/if}

				<div class="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
					<h3 class="font-medium mb-2">How to export your WhatsApp chat:</h3>
					<ol class="text-left max-w-sm mx-auto space-y-1">
						<li>1. Open WhatsApp on your phone</li>
						<li>2. Go to the chat you want to export</li>
						<li>3. Tap ⋮ (menu) → More → Export chat</li>
						<li>4. Choose "Without media" or "Include media"</li>
						<li>5. Save the file and upload it here</li>
					</ol>
				</div>
			</div>
		</div>
	{:else}
		<!-- Main app layout -->
		<div class="flex-1 flex overflow-hidden">
			<!-- Sidebar toggle for mobile -->
			<button
				class="md:hidden fixed bottom-4 left-4 z-50 w-12 h-12 rounded-full bg-[var(--color-whatsapp-teal)] text-white shadow-lg flex items-center justify-center"
				onclick={toggleSidebar}
				aria-label="Toggle sidebar"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			</button>

			<!-- Sidebar -->
			<div
				class="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col {showSidebar ? 'fixed md:relative inset-y-0 left-0 z-40' : 'hidden'} md:flex"
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
						<!-- Toggle sidebar on mobile -->
						<button class="md:hidden" onclick={() => (showSidebar = true)} aria-label="Open sidebar">
							<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
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
							<button
								class="p-2 hover:bg-white/10 rounded-full transition-colors"
								onclick={toggleStats}
								title="View statistics"
								aria-label="View statistics"
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
								</svg>
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
						{currentUser}
						searchQuery={appState.searchQuery}
						searchResultSet={appState.searchResultSet}
						currentSearchResultId={appState.currentSearchResultId}
					/>
				</div>

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

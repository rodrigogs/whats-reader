<script lang="ts">
import { floating } from '$lib/actions/floating';
import * as m from '$lib/paraglide/messages';
import type { ChatData } from '$lib/state.svelte';
import { getAvailableLanguages } from '$lib/transcription.svelte';

interface LoadingChat {
	id: string;
	filename: string;
	progress: number;
	stage: 'reading' | 'extracting' | 'parsing';
}

interface Props {
	chats: ChatData[];
	selectedIndex: number | null;
	onSelect: (index: number) => void;
	onRemove: (index: number) => void;
	languageByChat?: Map<string, string>;
	onLanguageChange?: (chatTitle: string, language: string) => void;
	autoLoadMediaByChat?: Map<string, boolean>;
	onAutoLoadMediaChange?: (chatTitle: string, enabled: boolean) => void;
	loadingChats?: LoadingChat[];
}

let {
	chats,
	selectedIndex,
	onSelect,
	onRemove,
	languageByChat = new Map(),
	onLanguageChange,
	autoLoadMediaByChat = new Map(),
	onAutoLoadMediaChange,
	loadingChats = [],
}: Props = $props();

const stageLabels = {
	reading: m.loading_reading(),
	extracting: m.loading_extracting(),
	parsing: m.loading_parsing(),
};

// Context menu state
let contextMenuIndex = $state<number | null>(null);
let menuButtonRef = $state<HTMLButtonElement | null>(null);
let showLanguageSubmenu = $state(false);
let languageTriggerRef = $state<HTMLButtonElement | null>(null);
let submenuHideTimeout: ReturnType<typeof setTimeout> | null = null;

const availableLanguages = getAvailableLanguages();

function openContextMenu(
	e: MouseEvent,
	index: number,
	buttonEl: HTMLButtonElement,
) {
	e.preventDefault();
	e.stopPropagation();
	contextMenuIndex = index;
	menuButtonRef = buttonEl;
	showLanguageSubmenu = false;
}

function closeContextMenu() {
	contextMenuIndex = null;
	showLanguageSubmenu = false;
	menuButtonRef = null;
	languageTriggerRef = null;
}

function handleLanguageSelect(language: string) {
	if (contextMenuIndex !== null && onLanguageChange) {
		const chat = chats[contextMenuIndex];
		onLanguageChange(chat.title, language);
	}
	closeContextMenu();
}

function showSubmenu() {
	if (submenuHideTimeout) {
		clearTimeout(submenuHideTimeout);
		submenuHideTimeout = null;
	}
	showLanguageSubmenu = true;
}

function hideSubmenuDelayed() {
	submenuHideTimeout = setTimeout(() => {
		showLanguageSubmenu = false;
	}, 150); // Small delay to allow mouse to move between elements
}

function cancelHideSubmenu() {
	if (submenuHideTimeout) {
		clearTimeout(submenuHideTimeout);
		submenuHideTimeout = null;
	}
}

function getLanguageForChat(chatTitle: string): string {
	return languageByChat.get(chatTitle) || 'portuguese';
}

function getLanguageName(code: string): string {
	return availableLanguages.find((l) => l.code === code)?.name || code;
}

function isAutoLoadEnabled(chatTitle: string): boolean {
	return autoLoadMediaByChat.get(chatTitle) || false;
}

function handleAutoLoadToggle() {
	if (contextMenuIndex !== null && onAutoLoadMediaChange) {
		const chat = chats[contextMenuIndex];
		const currentEnabled = isAutoLoadEnabled(chat.title);
		onAutoLoadMediaChange(chat.title, !currentEnabled);
	}
	closeContextMenu();
}

function formatDate(date: Date | null): string {
	if (!date) return '';
	const now = new Date();
	const diff = now.getTime() - date.getTime();
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));

	if (days === 0) {
		return date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
		});
	} else if (days === 1) {
		return 'Yesterday';
	} else if (days < 7) {
		return date.toLocaleDateString('en-US', { weekday: 'short' });
	} else {
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
}

function getLastMessage(chat: ChatData): string {
	if (chat.messages.length === 0) return m.no_messages();
	const last = chat.messages[chat.messages.length - 1];
	if (last.isMediaMessage) return m.last_message_media();
	if (last.isSystemMessage) return last.content;
	return `${last.sender}: ${last.content}`;
}
</script>

<div class="flex flex-col h-full bg-white dark:bg-gray-900">
	<!-- Chat list -->
	<div class="flex-1 overflow-y-auto">
		{#if chats.length === 0 && loadingChats.length === 0}
			<div class="p-4 text-center text-gray-500 dark:text-gray-400">
			<p>{m.chats_no_loaded()}</p>
			<p class="text-sm mt-1">{m.chats_import_hint()}</p>
			</div>
		{:else}
			<!-- Loading chat placeholders -->
			{#each loadingChats as loadingChat (loadingChat.id)}
				<div
					class="w-full p-4 flex items-start gap-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50"
				>
					<!-- Animated avatar skeleton -->
					<div class="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
						<svg class="w-6 h-6 text-gray-400 dark:text-gray-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
						</svg>
					</div>

					<!-- Loading info -->
					<div class="flex-1 min-w-0 text-left">
						<div class="flex items-center justify-between">
							<h3 class="font-semibold text-gray-800 dark:text-white truncate">
								{loadingChat.filename}
							</h3>
							<span class="text-xs text-[var(--color-whatsapp-teal)] flex-shrink-0 ml-2">
								{Math.round(loadingChat.progress)}%
							</span>
						</div>
						<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
							{stageLabels[loadingChat.stage]}
						</p>
						<!-- Progress bar -->
						<div class="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
							<div 
								class="h-full bg-[var(--color-whatsapp-teal)] rounded-full transition-all duration-300 ease-out"
								style="width: {loadingChat.progress}%"
							></div>
						</div>
					</div>
				</div>
			{/each}

			<!-- Loaded chats -->
			{#each chats as chat, index}
				<div
					class="w-full p-4 flex items-start gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 cursor-pointer {selectedIndex === index ? 'bg-gray-100 dark:bg-gray-800' : ''}"
					onclick={() => onSelect(index)}
					onkeydown={(e) => e.key === 'Enter' && onSelect(index)}
					role="button"
					tabindex="0"
				>
					<!-- Avatar -->
					<div
						class="w-12 h-12 rounded-full bg-[var(--color-whatsapp-teal)] flex items-center justify-center text-white font-semibold flex-shrink-0"
					>
						{chat.title.charAt(0).toUpperCase()}
					</div>

					<!-- Chat info -->
					<div class="flex-1 min-w-0 text-left">
						<div class="flex items-center justify-between">
							<h3 class="font-semibold text-gray-800 dark:text-white truncate">
								{chat.title}
							</h3>
							<span class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
								{formatDate(chat.endDate)}
							</span>
						</div>
						<p class="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
							{getLastMessage(chat)}
						</p>
						<div class="flex items-center gap-2 mt-1">
							<span class="text-xs text-gray-400 dark:text-gray-500">
								{chat.messageCount} {m.count_messages()}
							</span>
							{#if chat.mediaCount > 0}
								<span class="text-xs text-gray-400 dark:text-gray-500">
									• {chat.mediaCount} {m.count_media()}
								</span>
							{/if}
						</div>
					</div>

					<!-- Action buttons -->
					<div class="flex flex-col gap-1 flex-shrink-0">
						<!-- Remove button -->
						<button
							class="p-1 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
							onclick={(e) => {
								e.stopPropagation();
								onRemove(index);
							}}
							title={m.chat_remove()}
							aria-label={m.chat_remove()}
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
						<!-- Menu button -->
						<button
							class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
							onclick={(e) => {
								e.stopPropagation();
								openContextMenu(e, index, e.currentTarget as HTMLButtonElement);
							}}
							title={m.chat_options()}
							aria-label={m.chat_options()}
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
							</svg>
						</button>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<!-- Context Menu -->
	{#if contextMenuIndex !== null && menuButtonRef}
		<!-- Backdrop -->
		<button
			type="button"
			class="fixed inset-0 z-40 cursor-default"
			onclick={closeContextMenu}
			aria-label={m.context_menu_close()}
		></button>
		
		<!-- Menu -->
		<div
			class="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 w-[200px]"
			use:floating={{ 
				reference: menuButtonRef, 
				placement: 'bottom-end', 
				fallbackPlacements: ['bottom-start', 'top-end', 'top-start', 'left-start', 'right-start'],
				offsetDistance: 4 
			}}
		>
			<!-- Auto-load media toggle -->
			{#if chats[contextMenuIndex]?.mediaCount > 0}
				<button
					type="button"
					class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-2 text-gray-700 dark:text-gray-300"
					onclick={handleAutoLoadToggle}
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
					<span class="flex-1">Auto-load Media</span>
					{#if isAutoLoadEnabled(chats[contextMenuIndex]?.title || '')}
						<svg class="w-4 h-4 text-[var(--color-whatsapp-teal)]" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
						</svg>
					{/if}
				</button>
			{/if}
			
			<!-- Language submenu trigger -->
			<div class="relative">
				<button
					bind:this={languageTriggerRef}
					type="button"
					class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center justify-between gap-2 text-gray-700 dark:text-gray-300"
					onmouseenter={showSubmenu}
					onmouseleave={hideSubmenuDelayed}
					onclick={() => showLanguageSubmenu = !showLanguageSubmenu}
				>
					<span class="flex items-center gap-2">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
						</svg>
						{m.transcription_language()}
					</span>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
				</button>
				
				<!-- Language submenu -->
				{#if showLanguageSubmenu && languageTriggerRef}
					<!-- svelte-ignore a11y_interactive_supports_focus -->
					<div
						class="fixed z-[60] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 w-[160px] overflow-y-auto"
						use:floating={{ 
							reference: languageTriggerRef, 
							placement: 'left-start', 
							fallbackPlacements: ['right-start', 'bottom-start', 'bottom-end', 'top-start'],
							offsetDistance: 4,
							enableSizeConstraint: true
						}}
						onmouseenter={cancelHideSubmenu}
						onmouseleave={hideSubmenuDelayed}
						role="menu"
					>
						<div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
							<span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{m.transcription_select_language()}</span>
						</div>
						{#each availableLanguages as lang}
							{@const currentLang = getLanguageForChat(chats[contextMenuIndex]?.title || '')}
							<button
								type="button"
								class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-2 {currentLang === lang.code ? 'text-[var(--color-whatsapp-teal)] font-medium bg-gray-50 dark:bg-gray-700/50' : 'text-gray-700 dark:text-gray-300'}"
								onclick={() => handleLanguageSelect(lang.code)}
							>
								<span class="w-5 text-center">{currentLang === lang.code ? '✓' : ''}</span>
								<span>{lang.name}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
			
			<!-- Divider -->
			<div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
			
			<!-- Remove chat -->
			<button
				type="button"
				class="w-full px-3 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer flex items-center gap-2 text-red-600 dark:text-red-400"
				onclick={() => {
					if (contextMenuIndex !== null) {
						onRemove(contextMenuIndex);
					}
					closeContextMenu();
				}}
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
				</svg>
				Remove Chat
			</button>
		</div>
	{/if}
</div>

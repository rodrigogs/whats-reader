<script lang="ts">
import { floating } from '$lib/actions/floating';
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
import type { ChatData } from '$lib/state.svelte';
import { getAvailableLanguages } from '$lib/transcription.svelte';
import Icon from './Icon.svelte';
import IconButton from './IconButton.svelte';
import ListItemButton from './ListItemButton.svelte';

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
	const locale = getLocale();
	const now = new Date();
	const diff = now.getTime() - date.getTime();
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));

	if (days === 0) {
		return date.toLocaleTimeString(locale, {
			hour: '2-digit',
			minute: '2-digit',
		});
	} else if (days === 1) {
		return m.time_yesterday();
	} else if (days < 7) {
		return date.toLocaleDateString(locale, { weekday: 'short' });
	} else {
		return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
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
						<Icon name="upload" size="lg" class="text-gray-400 dark:text-gray-500 animate-pulse" />
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
						<IconButton
							theme="subtle"
							size="sm"
							dangerHover
							onclick={(e) => {
								e.stopPropagation();
								onRemove(index);
							}}
							title={m.chat_remove()}
							aria-label={m.chat_remove()}
						>
							<Icon name="close" size="md" />
						</IconButton>
						<!-- Menu button -->
						<IconButton
							theme="subtle"
							size="sm"
							onclick={(e) => {
								e.stopPropagation();
								openContextMenu(e, index, e.currentTarget as HTMLButtonElement);
							}}
							title={m.chat_options()}
							aria-label={m.chat_options()}
						>
							<Icon name="dots-vertical" size="md" />
						</IconButton>
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
				<ListItemButton class="justify-between" onclick={handleAutoLoadToggle}>
					<span class="flex items-center gap-2">
					<Icon name="image" size="sm" />
						Auto-load Media
					</span>
					{#if isAutoLoadEnabled(chats[contextMenuIndex]?.title || '')}
						<Icon name="check" size="sm" class="text-[var(--color-whatsapp-teal)]" />
					{/if}
				</ListItemButton>
			{/if}
			
			<!-- Language submenu trigger -->
			<div class="relative">
				<ListItemButton
					bind:ref={languageTriggerRef}
					class="justify-between"
					onmouseenter={showSubmenu}
					onmouseleave={hideSubmenuDelayed}
					onclick={() => showLanguageSubmenu = !showLanguageSubmenu}
				>
					<span class="flex items-center gap-2">
						<Icon name="language" size="sm" />
						{m.transcription_language()}
					</span>
				<Icon name="chevron-right" size="sm" />
			</ListItemButton>
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
							<ListItemButton
								active={currentLang === lang.code}
								onclick={() => handleLanguageSelect(lang.code)}
							>
								<span class="w-5 text-center">{currentLang === lang.code ? '✓' : ''}</span>
								<span>{lang.name}</span>
							</ListItemButton>
						{/each}
					</div>
				{/if}
			</div>
			
			<!-- Divider -->
			<div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
			
			<!-- Remove chat -->
			<ListItemButton
				danger
				onclick={() => {
					if (contextMenuIndex !== null) {
						onRemove(contextMenuIndex);
					}
					closeContextMenu();
				}}
			>
				<Icon name="trash" size="sm" />
				Remove Chat
			</ListItemButton>
		</div>
	{/if}
</div>

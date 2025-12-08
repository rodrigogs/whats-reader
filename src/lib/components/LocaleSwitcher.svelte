<script lang="ts">
import { browser } from '$app/environment';
import * as m from '$lib/paraglide/messages';
import {
	getLocale,
	type Locale,
	locales,
	setLocale,
} from '$lib/paraglide/runtime';

const LOCALE_STORAGE_KEY = 'locale';

interface Props {
	variant?: 'default' | 'header';
}

let { variant = 'default' }: Props = $props();

let dropdownOpen = $state(false);
let currentLocale = $derived(getLocale());

const localeNames: Record<Locale, string> = {
	en: 'English',
	pt: 'Português',
};

// Restore locale from localStorage on mount
if (browser) {
	const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
	if (savedLocale && locales.includes(savedLocale)) {
		setLocale(savedLocale);
	}
}

function handleLocaleChange(locale: Locale) {
	setLocale(locale, { reload: false });
	if (browser) {
		localStorage.setItem(LOCALE_STORAGE_KEY, locale);
	}
	dropdownOpen = false;
}

function toggleDropdown(e: MouseEvent) {
	e.stopPropagation();
	dropdownOpen = !dropdownOpen;
}

function handleClickOutside() {
	dropdownOpen = false;
}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="locale-switcher relative">
	<button
		onclick={toggleDropdown}
		class="flex items-center justify-center text-xs font-medium uppercase transition-colors p-1.5 rounded-full cursor-pointer {variant === 'header' 
			? 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white' 
			: 'bg-gray-100/80 dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 backdrop-blur-sm'}"
		aria-haspopup="listbox"
		aria-expanded={dropdownOpen}
		aria-label={m.language_change()}
	>
		<span class="w-4 h-4 flex items-center justify-center text-[10px] font-semibold">{currentLocale.toUpperCase()}</span>
	</button>

	{#if dropdownOpen}
		<div
			class="absolute right-0 mt-1 py-1 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 min-w-[100px] z-50"
			role="listbox"
		>
			{#each locales as locale (locale)}
				<button
					onclick={(e) => { e.stopPropagation(); handleLocaleChange(locale); }}
					class="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between gap-2 transition-colors cursor-pointer {locale === currentLocale ? 'text-[var(--color-whatsapp-teal)] font-medium' : 'text-gray-700 dark:text-gray-300'}"
					role="option"
					aria-selected={locale === currentLocale}
				>
					<span>{localeNames[locale]}</span>
					{#if locale === currentLocale}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="20 6 9 17 4 12" />
						</svg>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

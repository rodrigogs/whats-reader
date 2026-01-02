<script lang="ts">
import { browser } from '$app/environment';
import Icon from './Icon.svelte';
import * as m from '$lib/paraglide/messages';
import {
	getLocale,
	type Locale,
	locales,
	setLocale,
} from '$lib/paraglide/runtime';
import ListItemButton from './ListItemButton.svelte';

const LOCALE_STORAGE_KEY = 'locale';

interface Props {
	variant?: 'default' | 'header';
}

let { variant = 'default' }: Props = $props();

let dropdownOpen = $state(false);
let currentLocale = $derived(getLocale());

// Memoize locale names to avoid calling message functions on every render
const localeNames = $derived.by(() => {
	return {
		en: m.language_english(),
		pt: m.language_portuguese(),
		es: m.language_spanish(),
		fr: m.language_french(),
		de: m.language_german(),
		it: m.language_italian(),
		nl: m.language_dutch(),
		ja: m.language_japanese(),
		zh: m.language_chinese(),
		ru: m.language_russian(),
	} as Record<Locale, string>;
});

// Restore locale from localStorage on mount
if (browser) {
	const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
	if (savedLocale && locales.includes(savedLocale)) {
		setLocale(savedLocale);
	}
}

function handleLocaleChange(locale: Locale) {
	// Skip if already on this locale
	if (locale === getLocale()) {
		dropdownOpen = false;
		return;
	}

	// Save to localStorage first (Paraglide also saves to its own key and cookie)
	if (browser) {
		localStorage.setItem(LOCALE_STORAGE_KEY, locale);
	}

	// Use setLocale which will save to PARAGLIDE_LOCALE localStorage and cookie,
	// then reload the page to reflect the new locale (required for static sites)
	setLocale(locale);
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
			? 'hover:bg-white/10 text-white/80 hover:text-white' 
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
				<ListItemButton
					size="sm"
					active={locale === currentLocale}
					class="justify-between"
					onclick={(e) => { e.stopPropagation(); handleLocaleChange(locale); }}
					role="option"
					aria-selected={locale === currentLocale}
				>
					<span>{localeNames[locale]}</span>
					{#if locale === currentLocale}
					<Icon name="check" size="xs" stroke-width="2.5" />
					{/if}
				</ListItemButton>
			{/each}
		</div>
	{/if}
</div>

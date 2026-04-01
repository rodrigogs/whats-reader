/**
 * Shared formatting utilities for UI components
 */

/**
 * Get initials from a title/name string.
 * - Single word: first two characters
 * - Multiple words: first char of first word + first char of last word
 */
export function getInitials(title: string): string {
	if (!title.trim()) return '';
	const words = title.trim().split(/\s+/);
	if (words.length === 1) {
		return words[0].substring(0, 2).toUpperCase();
	}
	return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Format a date relative to now (Today, Yesterday, weekday, or full date).
 *
 * @param mode 'label' = "Today" / long weekday / full date (for modal lists)
 *             'compact' = "HH:MM" / short weekday / short date (for chat lists)
 */
export function formatRelativeDate(
	date: Date | string | null,
	locale: string,
	todayLabel: string,
	yesterdayLabel: string,
	mode: 'label' | 'compact' = 'label',
): string {
	if (!date) return '';
	const d = typeof date === 'string' ? new Date(date) : date;
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) {
		return mode === 'compact'
			? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
			: todayLabel;
	}
	if (diffDays === 1) {
		return yesterdayLabel;
	}
	if (diffDays < 7) {
		return d.toLocaleDateString(locale, {
			weekday: mode === 'compact' ? 'short' : 'long',
		});
	}
	return mode === 'compact'
		? d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
		: d.toLocaleDateString(locale, {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
			});
}

/**
 * Strip .zip extension and WhatsApp prefix from a filename for display.
 */
export function sanitizeFilename(name: string): string {
	return name
		.replace(/\.zip$/i, '')
		.replace(/^WhatsApp Chat (with |com )/i, '');
}

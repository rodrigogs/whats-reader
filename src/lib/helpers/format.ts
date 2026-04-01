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
 * Strip .zip extension and WhatsApp prefix from a filename for display.
 */
export function sanitizeFilename(name: string): string {
	return name
		.replace(/\.zip$/i, '')
		.replace(/^WhatsApp Chat (with |com )/i, '');
}

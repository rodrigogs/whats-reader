/**
 * Shared formatting utilities for UI components
 */

/**
 * Get initials from a title/name string.
 * - Single word: first two characters
 * - Multiple words: first char of first word + first char of last word
 */
export function getInitials(title: string): string {
	const words = title.trim().split(/\s+/);
	if (words.length === 1) {
		return words[0].substring(0, 2).toUpperCase();
	}
	return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

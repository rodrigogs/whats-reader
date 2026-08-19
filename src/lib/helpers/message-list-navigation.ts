export type NavigationDirection = 'up' | 'down';

export interface NavigationItem {
	type: string;
}

/**
 * Given the flattened render list (messages interleaved with date separators),
 * return the index of the next message to focus when navigating with the arrow
 * keys, or -1 when there is no message to focus.
 *
 * - `currentIndex` is the index of the currently focused message, or -1 when
 *   nothing is focused yet. When nothing is focused, 'down' starts at the first
 *   message and 'up' starts at the last message.
 * - Date separators are never focusable targets: navigation skips them.
 * - Moving past either boundary keeps the current message focused.
 */
export function getNextMessageIndex(
	items: readonly NavigationItem[],
	currentIndex: number,
	direction: NavigationDirection,
): number {
	if (items.length === 0) return -1;

	const messageIndices = items
		.map((item, index) => (item.type === 'message' ? index : -1))
		.filter((index) => index !== -1);

	if (messageIndices.length === 0) return -1;

	// Nothing focused yet: start at the first message (down) or the last (up).
	if (currentIndex < 0) {
		return direction === 'down'
			? messageIndices[0]
			: messageIndices[messageIndices.length - 1];
	}

	const position = messageIndices.indexOf(currentIndex);
	// Current index is not a message (e.g. a date separator): fall back to the
	// nearest message in the requested direction.
	const basePosition =
		position === -1
			? direction === 'down'
				? -1
				: messageIndices.length
			: position;

	const targetPosition =
		direction === 'down'
			? Math.min(basePosition + 1, messageIndices.length - 1)
			: Math.max(basePosition - 1, 0);

	return messageIndices[targetPosition];
}

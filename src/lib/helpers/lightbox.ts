/**
 * Pure resolver for the shared media lightbox.
 *
 * Lives here (not in gallery.svelte.ts) so it can be unit tested in Node
 * without instantiating the Svelte 5 rune state factory, which reads
 * `appState` and therefore needs a component context.
 *
 * Callers MUST pass the UNFILTERED item list (e.g. `galleryState.allItems`)
 * so a lightbox opened from a chat bubble still resolves while the Media
 * Gallery has an active participant/type filter (GH-92 decision 2) — a
 * filtered `items` list would silently return null for a filtered-out path.
 */

export interface LightboxResolvable {
	path: string;
}

/**
 * Find the item matching `path` in `items`, or null when there is no
 * active path or no match.
 */
export function resolveLightboxItem<T extends LightboxResolvable>(
	items: readonly T[],
	path: string | null,
): T | null {
	if (!path) return null;
	return items.find((item) => item.path === path) ?? null;
}

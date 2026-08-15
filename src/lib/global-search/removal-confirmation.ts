/**
 * GH-67 §5 — Confirmation gate for destructive library removal.
 *
 * "Remover da biblioteca" (remove from library) must never execute without an
 * explicit confirmation step, on every surface that triggers it. This module
 * owns that intent as a small consumable state machine: a surface *requests*
 * removal for an archiveId, the user confirms or cancels, and `confirm()`
 * hands back the archiveId exactly once. A consumed or cancelled request can
 * never re-execute the cascade.
 *
 * Purely rune-free so both the sidebar surface (page) and the global-search
 * panel can drive it; the UI layer owns rendering the dialog.
 */

export type RemovalConfirmation = {
	/** Archive whose removal was requested and is awaiting confirmation. */
	readonly requestedArchiveId: string | null;
	/** Ask the user to confirm removal of `archiveId`. */
	request(archiveId: string): void;
	/** Dismiss the pending request without removing anything. */
	cancel(): void;
	/**
	 * Consume the confirmation. Returns the confirmed archiveId exactly once;
	 * null when nothing is pending (nothing may execute then).
	 */
	confirm(): string | null;
};

export function createRemovalConfirmation(): RemovalConfirmation {
	let requestedArchiveId: string | null = null;

	return {
		get requestedArchiveId() {
			return requestedArchiveId;
		},
		request(archiveId: string): void {
			requestedArchiveId = archiveId;
		},
		cancel(): void {
			requestedArchiveId = null;
		},
		confirm(): string | null {
			if (requestedArchiveId === null) return null;
			const confirmed = requestedArchiveId;
			requestedArchiveId = null;
			return confirmed;
		},
	};
}

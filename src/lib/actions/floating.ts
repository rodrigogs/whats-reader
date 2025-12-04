/**
 * Floating UI action for Svelte
 * Handles automatic positioning of floating elements with flip/shift
 */

import {
	computePosition,
	flip,
	shift,
	offset,
	autoUpdate,
	size,
	type Placement
} from '@floating-ui/dom';

export interface FloatingOptions {
	/** The reference element to anchor to */
	reference: HTMLElement | null;
	/** Preferred placement */
	placement?: Placement;
	/** Fallback placements to try if preferred doesn't fit */
	fallbackPlacements?: Placement[];
	/** Offset from the reference element in pixels */
	offsetDistance?: number;
	/** Whether to flip when there's not enough space */
	enableFlip?: boolean;
	/** Whether to shift to stay within viewport */
	enableShift?: boolean;
	/** Whether to constrain size to fit viewport */
	enableSizeConstraint?: boolean;
	/** Callback when position is updated */
	onPositioned?: (data: { x: number; y: number; placement: Placement }) => void;
}

/**
 * Svelte action for floating element positioning
 * Usage: <div use:floating={{ reference: buttonEl, placement: 'bottom-end' }}>
 */
export function floating(node: HTMLElement, options: FloatingOptions) {
	let cleanup: (() => void) | undefined;

	function update(opts: FloatingOptions) {
		// Clean up previous auto-update
		cleanup?.();

		if (!opts.reference) return;

		const {
			reference,
			placement = 'bottom-start',
			fallbackPlacements,
			offsetDistance = 4,
			enableFlip = true,
			enableShift = true,
			enableSizeConstraint = true,
			onPositioned
		} = opts;

		const middleware = [
			offset(offsetDistance),
			...(enableFlip ? [flip({ 
				padding: 8,
				fallbackPlacements: fallbackPlacements,
				fallbackStrategy: 'bestFit'
			})] : []),
			...(enableShift ? [shift({ padding: 8, crossAxis: true })] : []),
			...(enableSizeConstraint ? [size({
				padding: 8,
				apply({ availableWidth, availableHeight, elements }) {
					Object.assign(elements.floating.style, {
						maxWidth: `${Math.max(120, availableWidth)}px`,
						maxHeight: `${Math.max(120, availableHeight)}px`,
					});
				}
			})] : [])
		];

		// Set up auto-update which handles scroll, resize, etc.
		cleanup = autoUpdate(reference, node, () => {
			computePosition(reference, node, {
				placement,
				middleware
			}).then(({ x, y, placement: finalPlacement }) => {
				Object.assign(node.style, {
					left: `${x}px`,
					top: `${y}px`
				});
				onPositioned?.({ x, y, placement: finalPlacement });
			});
		});
	}

	// Initial positioning
	update(options);

	return {
		update,
		destroy() {
			cleanup?.();
		}
	};
}

<script lang="ts">
import Icon from './Icon.svelte';

interface Props {
	/**
	 * Search input value (use bind:value)
	 */
	value: string;
	/**
	 * Placeholder text
	 */
	placeholder: string;
	/**
	 * Callback when value changes
	 */
	onInput?: (value: string) => void;
	/**
	 * Reference to the input element
	 */
	ref?: HTMLInputElement | null;
	/**
	 * Additional CSS classes
	 */
	class?: string;
}

let {
	value = $bindable(''),
	placeholder,
	onInput,
	ref = $bindable(null),
	class: className = '',
}: Props = $props();
</script>

<div class="p-2 border-b border-gray-100 dark:border-gray-700 {className}">
	<div class="relative">
		<div class="absolute left-2.5 top-1/2 -translate-y-1/2">
			<Icon name="search" size="sm" class="text-gray-400" />
		</div>
		<input
			bind:this={ref}
			bind:value
			type="text"
			{placeholder}
			oninput={() => onInput?.(value)}
			class="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border-0 rounded-md focus:ring-2 focus:ring-[var(--color-whatsapp-teal)] focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
		/>
	</div>
</div>

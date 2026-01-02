<script lang="ts">
interface Props {
	/**
	 * Header text
	 */
	title: string;
	/**
	 * Additional CSS classes
	 */
	class?: string;
}

let { title, class: className = '' }: Props = $props();
</script>

<div
	class="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 {className}"
>
	{title}
</div>

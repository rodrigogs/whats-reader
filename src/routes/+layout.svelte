<script lang="ts">
import favicon from '$lib/assets/favicon.svg';
import * as m from '$lib/paraglide/messages';
import '../app.css';

let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{m.app_title()}</title>
</svelte:head>

{@render children()}

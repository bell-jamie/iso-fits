<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Footer from '$lib/components/Footer.svelte';
	import Settings from '$lib/components/Settings.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex min-h-screen flex-col">
	<header class="border-b bg-card">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
			<h1 class="text-xl font-semibold text-foreground">Precision Fit Studio</h1>
			<Settings />
		</div>
	</header>
	<div class="flex flex-1 flex-col bg-background py-6 text-foreground">
		<div class="mx-auto w-full max-w-5xl flex-1 px-6 pb-16">
			{@render children()}
		</div>

		<Footer />
	</div>
</div>

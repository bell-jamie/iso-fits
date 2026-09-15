<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Footer from '$lib/components/Footer.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex min-h-screen flex-col">
	<header class="border-b border-(--jb-border-color) bg-(--jb-bg-card)">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
			<h1 class="text-foreground text-xl font-semibold text-(--jb-text-primary)">
				Precision Fit Studio
			</h1>
		</div>
	</header>
	<div class="flex flex-1 flex-col bg-(--jb-bg-dark) p-6 text-(--jb-text-primary)">
		<div class="flex-1 pb-16">
			{@render children()}
		</div>

		<Footer />
	</div>
</div>

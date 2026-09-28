<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import { Input } from '$lib/components/ui/input';
	import { buttonVariants } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { gridFlow } from '$lib/settings.svelte';

	let {
		items,
		value = $bindable(''),
		placeholder = 'Select...',
		emptyText = 'No match found.',
		columns = 4,
		class: className,
		title
	}: {
		items: string[];
		value?: string;
		placeholder?: string;
		emptyText?: string;
		columns?: number;
		class?: string;
		title?: string;
	} = $props();

	let open = $state(false);
	let search = $state(value);
	let browsing = $state(true);
	let triggerRef = $state<HTMLInputElement>(null!);

	// guards against stale/invalid persisted values (e.g. a lowercase shaft
	// deviation left over in the hole card's letter field) that never went
	// through select() below, so were never validated against this list.
	$effect(() => {
		if (value && !items.includes(value)) {
			value = '';
			search = '';
		}
	});

	// closing without an explicit click (blur, Escape, Enter): accept whatever
	// was typed if it case-insensitively matches an item (e.g. "js" -> "JS"),
	// otherwise revert to the last committed value. Gated on an actual
	// open -> closed transition (via wasOpen, a plain non-reactive flag) so
	// that external changes to `value` while already closed (e.g. an "apply
	// match" action elsewhere) sync into `search` below instead of being
	// mistaken for unsaved typed text and reverted.
	let wasOpen = false;
	$effect(() => {
		if (open) {
			browsing = true;
			wasOpen = true;
			return;
		}

		if (wasOpen) {
			wasOpen = false;
			if (search !== value) {
				const match = items.find((item) => item.toLowerCase() === search.toLowerCase());
				if (match) {
					value = match;
					search = match;
					return;
				}
			}
		}

		search = value;
	});

	let filtered = $derived(
		browsing ? items : items.filter((item) => item.toLowerCase().includes(search.toLowerCase()))
	);

	let rows = $derived(Math.ceil(filtered.length / columns));

	let gridStyle = $derived(
		gridFlow.current === 'row'
			? `grid-auto-flow: row; grid-template-columns: repeat(${columns}, minmax(0, 1fr));`
			: `grid-auto-flow: column; grid-template-rows: repeat(${rows}, minmax(0, 1fr)); grid-template-columns: repeat(${columns}, minmax(0, 1fr));`
	);

	function select(item: string) {
		value = item;
		search = item;
		open = false;
		triggerRef.focus();
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger bind:ref={triggerRef}>
		{#snippet child({ props })}
			<Input
				{...props}
				type="text"
				bind:value={search}
				{placeholder}
				{title}
				autocomplete="off"
				class={cn(
					buttonVariants({ variant: 'outline' }),
					'w-full bg-background text-left dark:bg-background',
					className
				)}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						open = false;
					} else if (e.key !== 'Escape') {
						open = true;
					}
				}}
				oninput={() => {
					browsing = false;
				}}
				onfocus={(e) => e.currentTarget.select()}
			/>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content
		class="w-56 p-2"
		trapFocus={false}
		onOpenAutoFocus={(e) => e.preventDefault()}
		onCloseAutoFocus={(e) => e.preventDefault()}
	>
		{#if filtered.length === 0}
			<p class="px-2 py-1.5 text-sm text-muted-foreground">{emptyText}</p>
		{:else}
			<div class="grid gap-1" style={gridStyle}>
				{#each filtered as item (item)}
					<button
						type="button"
						class={cn(
							'flex items-center justify-center rounded-none py-1.5 text-sm hover:bg-accent hover:text-accent-foreground',
							value === item && 'bg-accent text-accent-foreground'
						)}
						onclick={() => select(item)}
					>
						{item}
					</button>
				{/each}
			</div>
		{/if}
	</Popover.Content>
</Popover.Root>

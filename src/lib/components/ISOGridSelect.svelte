<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import { Input } from '$lib/components/ui/input';
	import { cn } from '$lib/utils';
	import { gridFlow } from '$lib/settings.svelte';

	let {
		items,
		value = $bindable(''),
		placeholder = 'Select...',
		emptyText = 'No match found.',
		columns = 4,
		class: className
	}: {
		items: string[];
		value?: string;
		placeholder?: string;
		emptyText?: string;
		columns?: number;
		class?: string;
	} = $props();

	let open = $state(false);
	let search = $state(value);
	let browsing = $state(true);
	let triggerRef = $state<HTMLInputElement>(null!);

	$effect(() => {
		if (open) {
			browsing = true;
		} else if (search !== value) {
			search = value;
		}
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
				autocomplete="off"
				class={cn('w-full', className)}
				onkeydown={(e) => {
					if (e.key !== 'Escape') open = true;
				}}
				oninput={() => {
					browsing = false;
				}}
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
			<p class="text-muted-foreground px-2 py-1.5 text-sm">{emptyText}</p>
		{:else}
			<div class="grid gap-1" style={gridStyle}>
				{#each filtered as item (item)}
					<button
						type="button"
						class={cn(
							'hover:bg-accent hover:text-accent-foreground flex items-center justify-center rounded-none py-1.5 text-sm',
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

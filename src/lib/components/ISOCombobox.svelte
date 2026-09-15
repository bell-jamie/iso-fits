<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import { Input } from '$lib/components/ui/input';
	import CheckIcon from '@lucide/svelte/icons/check';

	let {
		items,
		value = $bindable(''),
		placeholder = 'Select...',
		emptyText = 'No match found.'
	}: {
		items: string[];
		value?: string;
		placeholder?: string;
		emptyText?: string;
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
		class="w-(--bits-popover-anchor-width) max-h-60 overflow-y-auto p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
		trapFocus={false}
		onOpenAutoFocus={(e) => e.preventDefault()}
		onCloseAutoFocus={(e) => e.preventDefault()}
	>
		{#if filtered.length === 0}
			<p class="text-muted-foreground px-2 py-1.5 text-sm">{emptyText}</p>
		{:else}
			{#each filtered as item (item)}
				<button
					type="button"
					class="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-none px-2 py-1.5 text-sm"
					onclick={() => select(item)}
				>
					<CheckIcon class={value !== item ? 'text-transparent' : ''} />
					{item}
				</button>
			{/each}
		{/if}
	</Popover.Content>
</Popover.Root>

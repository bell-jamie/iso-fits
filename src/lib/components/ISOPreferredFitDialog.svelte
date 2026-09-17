<script lang="ts">
	import { findPreferredFit, type Iso286Match } from '$lib/iso286';
	import { formatSign, formatMicrons } from '$lib/format';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';

	let {
		open = $bindable(false),
		initialSize = '',
		initialClass = '',
		onApply,
		trigger
	}: {
		open?: boolean;
		initialSize?: string;
		initialClass?: string;
		onApply?: (match: Iso286Match) => void;
		trigger?: Snippet;
	} = $props();

	let size = $state(untrack(() => initialSize));
	let toleranceClass = $state(untrack(() => initialClass));

	$effect(() => {
		if (open) {
			size = initialSize;
			toleranceClass = initialClass;
		}
	});

	let nominal = $derived(parseFloat(size));

	let result = $derived.by(() => {
		if (!nominal || !toleranceClass) return null;

		try {
			const match = findPreferredFit(nominal, toleranceClass);
			return { match, error: null };
		} catch (e) {
			return { match: null, error: e instanceof Error ? e.message : 'Invalid input' };
		}
	});

	function apply() {
		if (result?.match) {
			onApply?.(result.match);
			open = false;
		}
	}
</script>

<Dialog.Root bind:open>
	{#if trigger}
		<Dialog.Trigger>
			{@render trigger()}
		</Dialog.Trigger>
	{/if}
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Find nearest preferred fit</Dialog.Title>
		</Dialog.Header>

		<div class="flex items-center gap-2">
			<div class="flex-1 space-y-1.5">
				<Label for="preferred-size">Nominal size (mm)</Label>
				<Input id="preferred-size" type="number" bind:value={size} class="bg-background" />
			</div>
			<div class="flex-1 space-y-1.5">
				<Label for="preferred-class">Tolerance class</Label>
				<Input
					id="preferred-class"
					type="text"
					bind:value={toleranceClass}
					placeholder="e.g. H7"
					class="bg-background"
				/>
			</div>
		</div>

		{#if result?.match}
			{@const match = result.match}
			<div class="flex items-center justify-between rounded-md border p-3 text-sm">
				<div>
					<p class="font-medium">{match.class}</p>
					<p class="text-muted-foreground tabular-nums">
						{formatSign(match.upper)}{formatMicrons(Math.abs(match.upper * 1000))} /
						{formatSign(match.lower)}{formatMicrons(Math.abs(match.lower * 1000))} µm
					</p>
				</div>
				<p class="text-muted-foreground tabular-nums">
					error {formatMicrons(match.error * 1000)} µm
				</p>
			</div>
		{:else if result?.error}
			<p class="text-sm text-destructive">{result.error}</p>
		{:else}
			<p class="text-sm text-muted-foreground">Enter a size and tolerance class</p>
		{/if}

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button disabled={!result?.match} onclick={apply}>Apply</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

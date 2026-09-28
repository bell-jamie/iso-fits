<script lang="ts">
	import { findPreferredFit, type Iso286Match } from '$lib/iso286';
	import { formatSign, formatMicrons, decimalPlaces } from '$lib/format';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import * as ButtonGroup from '$lib/components/ui/button-group';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';

	interface Context {
		size: number;
		toleranceClass: string;
		sizeDecimals: number;
	}

	let {
		open = $bindable(false),
		context,
		initialSize = '',
		initialClass = '',
		onApply,
		trigger
	}: {
		open?: boolean;
		context?: Context;
		initialSize?: string;
		initialClass?: string;
		onApply?: (match: Iso286Match) => void;
		trigger?: Snippet;
	} = $props();

	let size = $state(untrack(() => initialSize));
	let toleranceClass = $state(untrack(() => initialClass));
	let strict = $state(true);
	let decimalsValue = $state(3);

	$effect(() => {
		if (open) {
			strict = true;
			if (!context) {
				size = initialSize;
				toleranceClass = initialClass;
			}
		}
	});

	let nominal = $derived(context ? context.size : parseFloat(size));
	let activeClass = $derived(context ? context.toleranceClass : toleranceClass);

	let inheritedDecimals = $derived(context ? context.sizeDecimals : decimalPlaces(size));

	const MAX_DECIMALS = 3;

	// seed the precision stepper with the size's own decimal places each time
	// it's revealed, rather than leaving it at a stale or arbitrary default
	$effect(() => {
		if (!strict) {
			decimalsValue = Math.min(MAX_DECIMALS, inheritedDecimals);
		}
	});

	let decimals = $derived(strict ? inheritedDecimals : decimalsValue);

	let sizeAtPrecision = $derived(Number.isFinite(nominal) ? nominal.toFixed(decimals) : '—');
	let effectiveSize = $derived(Number.isFinite(nominal) ? Number(nominal.toFixed(decimals)) : NaN);

	function decrementDecimals() {
		decimalsValue = Math.max(0, decimalsValue - 1);
	}

	function incrementDecimals() {
		decimalsValue = Math.min(MAX_DECIMALS, decimalsValue + 1);
	}

	let result = $derived.by(() => {
		if (!effectiveSize || !activeClass) return null;

		try {
			const match = findPreferredFit(effectiveSize, activeClass);
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
	<Dialog.Content showCloseButton={false}>
		<Dialog.Header>
			<div class="flex items-center justify-between gap-4">
				<Dialog.Title class="text-lg">Find nearest preferred fit</Dialog.Title>
				<div class="flex items-center gap-2">
					<Label for="preferred-strict">Strict</Label>
					<Switch id="preferred-strict" bind:checked={strict} />
				</div>
			</div>

			{#if !strict}
				<div class="flex items-center justify-between gap-4">
					<Label>Size precision</Label>
					<ButtonGroup.Root>
						<Button
							variant="outline"
							size="icon-sm"
							aria-label="Fewer decimal places"
							onclick={decrementDecimals}
						>
							<MinusIcon class="size-3.5" />
						</Button>
						<ButtonGroup.Text class="w-20 justify-center tabular-nums">
							{sizeAtPrecision}
						</ButtonGroup.Text>
						<Button
							variant="outline"
							size="icon-sm"
							aria-label="More decimal places"
							onclick={incrementDecimals}
						>
							<PlusIcon class="size-3.5" />
						</Button>
					</ButtonGroup.Root>
				</div>
			{/if}
		</Dialog.Header>

		{#if !context}
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
		{/if}

		{#if result?.match}
			{@const match = result.match}
			<div class="flex items-center justify-between rounded-md border p-3 text-sm">
				<div>
					<p class="font-medium">{match.size.toFixed(decimals)} {match.class}</p>
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

<script lang="ts">
	import { listClosestFits, type Iso286Match } from '$lib/iso286';
	import { holePreferredTolerances, shaftPreferredTolerances } from 'iso-286';
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
		upper: number;
		lower: number;
		feature: 'hole' | 'shaft';
		sizeDecimals: number;
		mode: 'iso' | 'manual';
	}

	let {
		open = $bindable(false),
		context,
		feature = 'hole',
		initialSize = '',
		initialUpper = '',
		initialLower = '',
		onApply,
		trigger
	}: {
		open?: boolean;
		context?: Context;
		feature?: 'hole' | 'shaft';
		initialSize?: string;
		initialUpper?: string;
		initialLower?: string;
		onApply?: (match: Iso286Match) => void;
		trigger?: Snippet;
	} = $props();

	let size = $state(untrack(() => initialSize));
	let upperInput = $state(untrack(() => initialUpper));
	let lowerInput = $state(untrack(() => initialLower));
	let manualFeature = $state(untrack(() => feature));
	let strict = $state(true);
	let preferredOnly = $state(false);
	let decimalsValue = $state(3);

	$effect(() => {
		if (open) {
			strict = true;
			preferredOnly = false;
			if (!context) {
				size = initialSize;
				upperInput = initialUpper;
				lowerInput = initialLower;
				manualFeature = feature;
			}
		}
	});

	let nominal = $derived(context ? context.size : parseFloat(size));
	let upper = $derived(context ? context.upper : parseFloat(upperInput));
	let lower = $derived(context ? context.lower : parseFloat(lowerInput));
	let activeFeature = $derived(context ? context.feature : manualFeature);

	// browsing near an already-picked ISO class is "Preferred tolerances"; starting
	// from raw limits (manual mode, or the standalone tool) is a "Lookup tolerance"
	// and gets a toggle to narrow the search to the curated preferred series.
	let isIsoSource = $derived(context?.mode === 'iso');
	let showPreferredToggle = $derived(!isIsoSource);
	let dialogTitle = $derived(isIsoSource ? 'Preferred tolerances' : 'Lookup tolerance');

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

	function decrementDecimals() {
		decimalsValue = Math.max(0, decimalsValue - 1);
	}

	function incrementDecimals() {
		decimalsValue = Math.min(MAX_DECIMALS, decimalsValue + 1);
	}

	let preferredSet = $derived.by(() => {
		if (!preferredOnly) return null;
		const list = activeFeature === 'hole' ? holePreferredTolerances() : shaftPreferredTolerances();
		return new Set(list);
	});

	let result = $derived.by(() => {
		if (!nominal || Number.isNaN(upper) || Number.isNaN(lower)) return null;
		if (upper < lower) return { matches: null, error: 'Upper limit must not be below lower limit' };

		try {
			const fetchCount = preferredSet ? 30 : 5;
			const matches = listClosestFits(
				nominal,
				upper,
				lower,
				activeFeature,
				strict,
				fetchCount,
				decimals
			);
			const filtered = preferredSet ? matches.filter((m) => preferredSet.has(m.class)) : matches;
			return { matches: filtered.slice(0, 5), error: null };
		} catch (e) {
			return { matches: null, error: e instanceof Error ? e.message : 'Invalid input' };
		}
	});

	function apply(match: Iso286Match) {
		onApply?.(match);
		open = false;
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
				<Dialog.Title class="text-lg">{dialogTitle}</Dialog.Title>
				<div class="flex items-center gap-2">
					{#if showPreferredToggle}
						<Label for="reverse-preferred">Preferred</Label>
						<Switch id="reverse-preferred" bind:checked={preferredOnly} />
					{/if}
					<Label for="reverse-strict">Strict</Label>
					<Switch id="reverse-strict" bind:checked={strict} />
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
					<Label for="reverse-size">Nominal size (mm)</Label>
					<Input id="reverse-size" type="number" bind:value={size} class="bg-background" />
				</div>
				<div class="flex-1 space-y-1.5">
					<Label for="reverse-upper">Upper limit (mm)</Label>
					<Input id="reverse-upper" type="number" bind:value={upperInput} class="bg-background" />
				</div>
				<div class="flex-1 space-y-1.5">
					<Label for="reverse-lower">Lower limit (mm)</Label>
					<Input id="reverse-lower" type="number" bind:value={lowerInput} class="bg-background" />
				</div>
			</div>

			<div class="flex items-center gap-2">
				<Label id="reverse-feature-label">Feature</Label>
				<div class="flex gap-1" aria-labelledby="reverse-feature-label">
					<Button
						variant={manualFeature === 'hole' ? 'default' : 'outline'}
						size="sm"
						onclick={() => (manualFeature = 'hole')}
					>
						Hole
					</Button>
					<Button
						variant={manualFeature === 'shaft' ? 'default' : 'outline'}
						size="sm"
						onclick={() => (manualFeature = 'shaft')}
					>
						Shaft
					</Button>
				</div>
			</div>
		{/if}

		{#if result?.matches}
			<div class="flex flex-col gap-2">
				{#each result.matches as match (match.class)}
					<button
						type="button"
						class="flex items-center justify-between rounded-md border p-3 text-left text-sm hover:bg-accent hover:text-accent-foreground"
						onclick={() => apply(match)}
					>
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
					</button>
				{:else}
					<p class="text-sm text-muted-foreground">No matches found</p>
				{/each}
			</div>
		{:else if result?.error}
			<p class="text-sm text-destructive">{result.error}</p>
		{:else}
			<p class="text-sm text-muted-foreground">Enter a size and limits</p>
		{/if}

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

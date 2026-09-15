<script lang="ts">
	import { lookupIso286 } from '$lib/iso286';
	import { holeDeviations, shaftDeviations, grades } from 'iso-286';
	// import { onMount } from 'svelte';
	import { untrack } from 'svelte';
	import { PersistedState } from 'runed';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import ISOCombobox from '$lib/components/ISOCombobox.svelte';
	import ISOGridSelect from '$lib/components/ISOGridSelect.svelte';
	import ISOSizeInput from '$lib/components/ISOSizeInput.svelte';
	import LinkIcon from '@lucide/svelte/icons/link';
	import UnlinkIcon from '@lucide/svelte/icons/unlink';

	const holeSize = new PersistedState('holeSize', '');
	const holeLetter = new PersistedState('holeLetter', '');
	const holeGrade = new PersistedState('holeGrade', '');

	const shaftSize = new PersistedState('shaftSize', '');
	const shaftLetter = new PersistedState('shaftLetter', '');
	const shaftGrade = new PersistedState('shaftGrade', '');

	const sizeSynced = new PersistedState('sizeSynced', false);

	$effect(() => {
		const size = holeSize.current;
		if (!sizeSynced.current) return;
		if (untrack(() => shaftSize.current) !== size) shaftSize.current = size;
	});

	$effect(() => {
		const size = shaftSize.current;
		if (!sizeSynced.current) return;
		if (untrack(() => holeSize.current) !== size) holeSize.current = size;
	});

	let holeNom = $derived(parseFloat(holeSize.current));
	let shaftNom = $derived(parseFloat(shaftSize.current));

	let holeClass = $derived(
		holeLetter.current && holeGrade.current ? `${holeLetter.current}${holeGrade.current}` : ''
	); // makes H 7 -> H7

	let shaftClass = $derived(
		shaftLetter.current && shaftGrade.current ? `${shaftLetter.current}${shaftGrade.current}` : ''
	);

	let lookupHole = $derived.by(() => {
		if (!holeNom || !holeClass) return null;

		try {
			const tolerance = lookupIso286(holeNom, holeClass);
			return { tolerance, error: null };
		} catch (e) {
			return { tolerance: null, error: e instanceof Error ? e.message : 'Invalid input' };
		}
	});

	let lookupShaft = $derived.by(() => {
		if (!shaftNom || !shaftClass) return null;

		try {
			const tolerance = lookupIso286(shaftNom, shaftClass);
			return { tolerance, error: null };
		} catch (e) {
			return { tolerance: null, error: e instanceof Error ? e.message : 'Invalid input' };
		}
	});

	let holeLimits = $derived.by(() => {
		if (!lookupHole || lookupHole.error) return null;

		const max = holeNom + lookupHole.tolerance!.upper;
		const mid = holeNom + lookupHole.tolerance!.middle;
		const min = holeNom + lookupHole.tolerance!.lower;
		return {
			max,
			mid,
			min
		};
	});

	let shaftLimits = $derived.by(() => {
		if (!lookupShaft || lookupShaft.error) return null;

		const max = shaftNom + lookupShaft.tolerance!.upper;
		const mid = shaftNom + lookupShaft.tolerance!.middle;
		const min = shaftNom + lookupShaft.tolerance!.lower;
		return {
			max,
			mid,
			min
		};
	});

	let fit = $derived.by(() => {
		if (!holeLimits || !shaftLimits) return null;

		const maxClearance = holeLimits.max - shaftLimits.min;
		const minClearance = holeLimits.min - shaftLimits.max;
		const midClearance = (maxClearance + minClearance) / 2;
		const type = minClearance >= 0 ? 'Clearance' : maxClearance < 0 ? 'Interference' : 'Transition';
		return {
			minClearance,
			midClearance,
			maxClearance,
			type
		};
	});

	let fitBadgeVariant: 'default' | 'secondary' | 'destructive' = $derived(
		fit?.type === 'Interference'
			? 'destructive'
			: fit?.type === 'Transition'
				? 'secondary'
				: 'default'
	);
</script>

<div class="flex flex-col gap-6">
	<div class="flex gap-6">
		<Card.Root class="flex-1">
			<Card.Header>
				<Card.Title class="text-2xl font-bold">Hole</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="flex items-center gap-2">
					<Button variant="outline">ISO</Button>

					<ISOSizeInput bind:value={holeSize.current} class="flex-1">
						{#snippet icon()}
							<button
								type="button"
								class="hover:text-foreground"
								aria-pressed={sizeSynced.current}
								aria-label="Sync hole and shaft sizes"
								title="Sync hole and shaft sizes"
								onclick={() => (sizeSynced.current = !sizeSynced.current)}
							>
								{#if sizeSynced.current}
									<LinkIcon class="size-3.5" />
								{:else}
									<UnlinkIcon class="size-3.5" />
								{/if}
							</button>
						{/snippet}
					</ISOSizeInput>

					<ISOGridSelect
						items={holeDeviations()}
						bind:value={holeLetter.current}
						placeholder="Letter..."
						class="flex-1"
					/>

					<ISOGridSelect
						items={grades()}
						bind:value={holeGrade.current}
						placeholder="Grade..."
						class="flex-1"
					/>

					<Button variant="outline">P</Button>
				</div>

				{#if holeLimits && !lookupHole?.error}
					<p>Max: {holeLimits.max.toFixed(4)} mm</p>
					<p>Mid: {holeLimits.mid.toFixed(4)} mm</p>
					<p>Min: {holeLimits.min.toFixed(4)} mm</p>
				{:else if lookupHole?.error}
					<p class="text-destructive">{lookupHole.error}</p>
				{:else}
					<p>Complete input selection</p>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root class="flex-1">
			<Card.Header>
				<Card.Title class="text-2xl font-bold">Shaft</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="flex items-center gap-2">
					<Button variant="outline">ISO</Button>

					<ISOSizeInput bind:value={shaftSize.current} class="flex-1">
						{#snippet icon()}
							<button
								type="button"
								class="hover:text-foreground"
								aria-pressed={sizeSynced.current}
								aria-label="Sync hole and shaft sizes"
								title="Sync hole and shaft sizes"
								onclick={() => (sizeSynced.current = !sizeSynced.current)}
							>
								{#if sizeSynced.current}
									<LinkIcon class="size-3.5" />
								{:else}
									<UnlinkIcon class="size-3.5" />
								{/if}
							</button>
						{/snippet}
					</ISOSizeInput>

					<ISOGridSelect
						items={shaftDeviations()}
						bind:value={shaftLetter.current}
						placeholder="Letter..."
						class="flex-1"
					/>

					<ISOGridSelect
						items={grades()}
						bind:value={shaftGrade.current}
						placeholder="Grade..."
						class="flex-1"
					/>

					<Button variant="outline">P</Button>
				</div>

				{#if shaftLimits && !lookupShaft?.error}
					<p>Max: {shaftLimits.max.toFixed(4)} mm</p>
					<p>Mid: {shaftLimits.mid.toFixed(4)} mm</p>
					<p>Min: {shaftLimits.min.toFixed(4)} mm</p>
				{:else if lookupShaft?.error}
					<p class="text-destructive">{lookupShaft.error}</p>
				{:else}
					<p>Complete input selection</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<Card.Root>
		<Card.Header>
			<div class="flex items-center justify-between">
				<Card.Title class="text-2xl font-bold">Fit</Card.Title>
				{#if fit}
					<Badge variant={fitBadgeVariant}>{fit.type}</Badge>
				{/if}
			</div>
		</Card.Header>
		<Card.Content>
			{#if fit}
				<div class="grid grid-cols-3 gap-6">
					<div>
						<p class="text-xs tracking-wide text-muted-foreground uppercase">Min</p>
						<p class="text-lg font-semibold">{fit.minClearance.toFixed(4)} mm</p>
					</div>
					<div>
						<p class="text-xs tracking-wide text-muted-foreground uppercase">Mid</p>
						<p class="text-lg font-semibold">{fit.midClearance.toFixed(4)} mm</p>
					</div>
					<div>
						<p class="text-xs tracking-wide text-muted-foreground uppercase">Max</p>
						<p class="text-lg font-semibold">{fit.maxClearance.toFixed(4)} mm</p>
					</div>
				</div>
			{:else}
				<p class="text-sm text-muted-foreground">Complete input selection</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>

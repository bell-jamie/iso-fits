<script lang="ts">
	import { lookupIso286 } from '$lib/iso286';
	import { holeDeviations, shaftDeviations, grades } from 'iso-286';
	// import { onMount } from 'svelte';
	import { PersistedState } from 'runed';

	const holeSize = new PersistedState('holeSize', '');
	const holeLetter = new PersistedState('holeLetter', '');
	const holeGrade = new PersistedState('holeGrade', '');

	const shaftSize = new PersistedState('shaftSize', '');
	const shaftLetter = new PersistedState('shaftLetter', '');
	const shaftGrade = new PersistedState('shaftGrade', '');

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
</script>

<div class="flex flex-col gap-6">
	<div class="flex gap-6">
		<div
			class="flex-1 rounded-(--jb-radius-lg) border border-(--jb-border-color) bg-(--jb-bg-card) p-6"
		>
			<label for="hole" class="text-2xl font-bold"> Hole </label>
			<hr />

			<button type="button"> ISO </button>

			<input
				type="number"
				bind:value={holeSize.current}
				class="w-30 rounded-(--jb-radius-md) border border-(--jb-border-color) bg-(--jb-bg-dark) px-3 py-2 text-(--jb-text-primary)"
			/>
			<select
				bind:value={holeLetter.current}
				class="rounded-(--jb-radius-md) border border-(--jb-border-color) bg-(--jb-bg-dark) px-3 py-2 text-(--jb-text-primary)"
			>
				<option value="">-</option>
				{#each holeDeviations() as letter (letter)}
					<option value={letter}>{letter}</option>
				{/each}
			</select>

			<select
				bind:value={holeGrade.current}
				class="rounded-(--jb-radius-md) border border-(--jb-border-color) bg-(--jb-bg-dark) px-3 py-2 text-(--jb-text-primary)"
			>
				<option value="">-</option>
				{#each grades() as grade (grade)}
					<option value={grade}>{grade}</option>
				{/each}
			</select>

			{#if holeLimits && !lookupHole?.error}
				<p>Max: {holeLimits.max.toFixed(4)} mm</p>
				<p>Mid: {holeLimits.mid.toFixed(4)} mm</p>
				<p>Min: {holeLimits.min.toFixed(4)} mm</p>
			{:else if lookupHole?.error}
				<p style="color: red">{lookupHole.error}</p>
			{:else}
				<p>Complete input selection</p>
			{/if}
		</div>

		<div
			class="flex-1 rounded-(--jb-radius-lg) border border-(--jb-border-color) bg-(--jb-bg-card) p-6"
		>
			<label for="shaft" class="text-2xl font-bold"> Shaft </label>
			<hr />

			<button type="button"> ISO </button>
			<input
				type="number"
				bind:value={shaftSize.current}
				class="w-30 rounded-(--jb-radius-md) border border-(--jb-border-color) bg-(--jb-bg-dark) px-3 py-2 text-(--jb-text-primary)"
			/>
			<select
				bind:value={shaftLetter.current}
				class="rounded-(--jb-radius-md) border border-(--jb-border-color) bg-(--jb-bg-dark) px-3 py-2 text-(--jb-text-primary)"
			>
				<option value="">-</option>
				{#each shaftDeviations() as letter (letter)}
					<option value={letter}>{letter}</option>
				{/each}
			</select>

			<select
				bind:value={shaftGrade.current}
				class="rounded-(--jb-radius-md) border border-(--jb-border-color) bg-(--jb-bg-dark) px-3 py-2 text-(--jb-text-primary)"
			>
				<option value="">-</option>
				{#each grades() as grade (grade)}
					<option value={grade}>{grade}</option>
				{/each}
			</select>

			{#if shaftLimits && !lookupShaft?.error}
				<p>Max: {shaftLimits.max.toFixed(4)} mm</p>
				<p>Mid: {shaftLimits.mid.toFixed(4)} mm</p>
				<p>Min: {shaftLimits.min.toFixed(4)} mm</p>
			{:else if lookupShaft?.error}
				<p style="color: red">{lookupShaft.error}</p>
			{:else}
				<p>Complete input selection</p>
			{/if}
		</div>
	</div>

	<div class="rounded-(--jb-radius-lg) border border-(--jb-border-color) bg-(--jb-bg-card) p-6">
		<label for="fit" class="text-2xl font-bold"> Fit </label>
		<hr />

		{#if fit}
			<p>Min: {fit.minClearance.toFixed(4)} mm</p>
			<p>Mid: {fit.midClearance.toFixed(4)} mm</p>
			<p>Max: {fit.maxClearance.toFixed(4)} mm</p>
			<p>Fit type: {fit.type}</p>
		{/if}
	</div>
</div>

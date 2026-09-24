<script lang="ts">
	import { lookupIso286, listClosestFits, type Iso286Match } from '$lib/iso286';
	import { formatSign, formatMicrons, decimalPlaces } from '$lib/format';
	import { tone } from '$lib/tone';
	import { cn } from '$lib/utils';
	import { holeDeviations, shaftDeviations, grades } from 'iso-286';
	// import { onMount } from 'svelte';
	import { untrack } from 'svelte';
	import { PersistedState } from 'runed';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import ISOGridSelect from '$lib/components/ISOGridSelect.svelte';
	import ISOSizeInput from '$lib/components/ISOSizeInput.svelte';
	import ISOFitGlyph from '$lib/components/ISOFitGlyph.svelte';
	import ISOFitBand from '$lib/components/ISOFitBand.svelte';
	import ISOReverseLookupDialog from '$lib/components/ISOReverseLookupDialog.svelte';
	import LinkIcon from '@lucide/svelte/icons/link';
	import UnlinkIcon from '@lucide/svelte/icons/unlink';
	import SearchIcon from '@lucide/svelte/icons/search';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	const holeSize = new PersistedState('holeSize', '');
	const holeLetter = new PersistedState('holeLetter', '');
	const holeGrade = new PersistedState('holeGrade', '');
	const holeMode = new PersistedState<'iso' | 'manual'>('holeMode', 'iso');
	const holeManualUpper = new PersistedState('holeManualUpper', '');
	const holeManualLower = new PersistedState('holeManualLower', '');
	const holeName = new PersistedState('holeName', 'Hole');

	const shaftSize = new PersistedState('shaftSize', '');
	const shaftLetter = new PersistedState('shaftLetter', '');
	const shaftGrade = new PersistedState('shaftGrade', '');
	const shaftMode = new PersistedState<'iso' | 'manual'>('shaftMode', 'iso');
	const shaftManualUpper = new PersistedState('shaftManualUpper', '');
	const shaftManualLower = new PersistedState('shaftManualLower', '');
	const shaftName = new PersistedState('shaftName', 'Shaft');

	const sizeSynced = new PersistedState('sizeSynced', true);

	let holeReverseOpen = $state(false);
	let shaftReverseOpen = $state(false);

	// editable card headings: commit on Enter (no newlines in a heading), and
	// fall back to the default name rather than leaving it blank on blur
	function handleNameKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		(event.currentTarget as HTMLElement).blur();
	}

	function handleNameBlur(name: PersistedState<string>, fallback: string) {
		name.current = name.current.trim() || fallback;
	}

	function applyMatch(
		match: Iso286Match,
		letter: PersistedState<string>,
		grade: PersistedState<string>,
		mode: PersistedState<'iso' | 'manual'>
	) {
		const letterGrade = /^([A-Za-z]+)(\d+)$/.exec(match.class);
		if (letterGrade) {
			letter.current = letterGrade[1];
			grade.current = letterGrade[2];
		}
		mode.current = 'iso';
	}

	function applyHoleMatch(match: Iso286Match) {
		applyMatch(match, holeLetter, holeGrade, holeMode);
	}

	function applyShaftMatch(match: Iso286Match) {
		applyMatch(match, shaftLetter, shaftGrade, shaftMode);
	}

	// mm are rounded to 5 decimals (0.01 µm) to avoid noisy floating point tails
	function formatMm(n: number): string {
		return (Math.round(n * 1e5) / 1e5).toString();
	}

	// toggling ISO <-> manual carries the current fit across via lookup, rather
	// than resetting it, so the user doesn't lose their place.
	function toggleMode(
		mode: PersistedState<'iso' | 'manual'>,
		nominal: number,
		tolerance: { upper: number; lower: number } | null | undefined,
		manualUpper: PersistedState<string>,
		manualLower: PersistedState<string>,
		letter: PersistedState<string>,
		grade: PersistedState<string>,
		feature: 'hole' | 'shaft'
	) {
		if (mode.current === 'iso') {
			if (tolerance) {
				manualUpper.current = formatMm(tolerance.upper);
				manualLower.current = formatMm(tolerance.lower);
			}
			mode.current = 'manual';
			return;
		}

		if (tolerance && nominal) {
			try {
				const [match] = listClosestFits(
					nominal,
					tolerance.upper,
					tolerance.lower,
					feature,
					true,
					1,
					3
				);
				if (match) {
					const letterGrade = /^([A-Za-z]+)(\d+)$/.exec(match.class);
					if (letterGrade) {
						letter.current = letterGrade[1];
						grade.current = letterGrade[2];
					}
				}
			} catch {
				// no close match found; fall through and switch modes unchanged
			}
		}
		mode.current = 'iso';
	}

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

	function manualTolerance(upperInput: string, lowerInput: string) {
		const upper = parseFloat(upperInput);
		const lower = parseFloat(lowerInput);
		if (Number.isNaN(upper) || Number.isNaN(lower)) return null;
		if (upper < lower) {
			return { tolerance: null, error: 'Upper limit must not be below lower limit' };
		}
		const middle = (upper + lower) / 2;
		return { tolerance: { upper, middle, lower }, error: null };
	}

	let lookupHole = $derived.by(() => {
		if (holeMode.current === 'manual') {
			if (!holeNom || (!holeManualUpper.current && !holeManualLower.current)) return null;
			return manualTolerance(holeManualUpper.current, holeManualLower.current);
		}

		if (!holeNom || !holeClass) return null;

		try {
			const tolerance = lookupIso286(holeNom, holeClass);
			return { tolerance, error: null };
		} catch (e) {
			return { tolerance: null, error: e instanceof Error ? e.message : 'Invalid input' };
		}
	});

	let lookupShaft = $derived.by(() => {
		if (shaftMode.current === 'manual') {
			if (!shaftNom || (!shaftManualUpper.current && !shaftManualLower.current)) return null;
			return manualTolerance(shaftManualUpper.current, shaftManualLower.current);
		}

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

	// mm values need at least 3 decimals (µm resolution); finer grades need extra
	// decimals to represent fractional µm deviations (e.g. 7.5 µm -> 0.0075 mm).
	function requiredDecimals(micronValues: number[]): number {
		let extra = 0;
		for (const value of micronValues) {
			const rounded = Math.round(value * 100) / 100;
			const decimalDigits = rounded.toString().split('.')[1]?.length ?? 0;
			extra = Math.max(extra, decimalDigits);
		}
		return 3 + extra;
	}

	const TAG_TEXT_CLASS = {
		on: 'text-red-500 dark:text-red-400',
		off: 'text-blue-500 dark:text-blue-400',
		neutral: 'text-muted-foreground'
	} as const;

	// structural role — independent of sign: a shaft's larger (max) limit is
	// MMC (most material); a hole's smaller (min) limit is MMC. Color instead
	// follows the sign-based tone, matching the glyph's slice for that limit.
	function limitRows(
		limits: { max: number; mid: number; min: number } | null,
		tolerance: { upper: number; lower: number } | null | undefined,
		kind: 'hole' | 'shaft'
	) {
		if (!limits || !tolerance) return null;
		const { upper, lower } = tolerance;
		const upperUm = upper * 1000;
		const lowerUm = lower * 1000;
		const halfUm = ((upper - lower) / 2) * 1000;
		const decimals = requiredDecimals([upperUm, lowerUm, halfUm]);
		const maxTag = kind === 'shaft' ? 'MMC' : 'LMC';
		const minTag = kind === 'shaft' ? 'LMC' : 'MMC';
		return [
			{
				label: 'max',
				tag: maxTag,
				tagClass: TAG_TEXT_CLASS[tone(upper, kind)],
				value: limits.max.toFixed(decimals),
				sign: formatSign(upper),
				deviation: formatMicrons(Math.abs(upperUm))
			},
			{
				label: 'mid',
				tag: 'dash' as const,
				tagClass: TAG_TEXT_CLASS.neutral,
				value: limits.mid.toFixed(decimals),
				sign: '±',
				deviation: formatMicrons(Math.abs(halfUm))
			},
			{
				label: 'min',
				tag: minTag,
				tagClass: TAG_TEXT_CLASS[tone(lower, kind)],
				value: limits.min.toFixed(decimals),
				sign: formatSign(lower),
				deviation: formatMicrons(Math.abs(lowerUm))
			}
		];
	}

	let holeRows = $derived(limitRows(holeLimits, lookupHole?.tolerance, 'hole'));
	let shaftRows = $derived(limitRows(shaftLimits, lookupShaft?.tolerance, 'shaft'));

	let holeContext = $derived(
		lookupHole?.tolerance
			? {
					size: holeNom,
					upper: lookupHole.tolerance.upper,
					lower: lookupHole.tolerance.lower,
					feature: 'hole' as const,
					sizeDecimals: decimalPlaces(holeSize.current),
					mode: holeMode.current
				}
			: undefined
	);

	let shaftContext = $derived(
		lookupShaft?.tolerance
			? {
					size: shaftNom,
					upper: lookupShaft.tolerance.upper,
					lower: lookupShaft.tolerance.lower,
					feature: 'shaft' as const,
					sizeDecimals: decimalPlaces(shaftSize.current),
					mode: shaftMode.current
				}
			: undefined
	);

	let fit = $derived.by(() => {
		if (!holeLimits || !shaftLimits) return null;

		const maxClearance = holeLimits.max - shaftLimits.min;
		const minClearance = holeLimits.min - shaftLimits.max;
		const midClearance = (maxClearance + minClearance) / 2;
		const type: 'Clearance' | 'Interference' | 'Transition' =
			minClearance >= 0 ? 'Clearance' : maxClearance < 0 ? 'Interference' : 'Transition';
		return {
			minClearance,
			midClearance,
			maxClearance,
			type
		};
	});

	// same blue/red convention as the fit glyph's clearance/interference zones
	const CLEARANCE_TEXT_CLASS = 'text-blue-500 dark:text-blue-400';
	const INTERFERENCE_TEXT_CLASS = 'text-red-500 dark:text-red-400';

	function clearanceLabel(value: number) {
		return value >= 0
			? { text: 'Clearance', class: CLEARANCE_TEXT_CLASS }
			: { text: 'Interference', class: INTERFERENCE_TEXT_CLASS };
	}

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
				<div class="flex items-center justify-between">
					<Card.Title class="text-2xl font-bold">
						<span
							contenteditable="true"
							role="textbox"
							tabindex="0"
							aria-label="Hole name"
							bind:textContent={holeName.current}
							onkeydown={handleNameKeydown}
							onblur={() => handleNameBlur(holeName, 'Hole')}
							class="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
						></span>
					</Card.Title>
					<Button
						variant="outline"
						size="icon"
						class="bg-background dark:bg-background"
						disabled={!lookupHole?.tolerance}
						aria-label="Find nearby tolerance classes"
						title="Find nearby tolerance classes"
						onclick={() => (holeReverseOpen = true)}
					>
						<SearchIcon class="size-4" />
					</Button>
				</div>
			</Card.Header>
			<Card.Content>
				<div class="flex items-center gap-2">
					<Button
						variant="outline"
						class="w-14 bg-background dark:bg-background"
						title="Toggle ISO / custom"
						onclick={() =>
							toggleMode(
								holeMode,
								holeNom,
								lookupHole?.tolerance,
								holeManualUpper,
								holeManualLower,
								holeLetter,
								holeGrade,
								'hole'
							)}
					>
						{holeMode.current === 'iso' ? 'ISO' : '±'}
					</Button>

					<ISOSizeInput bind:value={holeSize.current} title="Size (mm)" class="w-20 shrink-0">
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

					{#if holeMode.current === 'iso'}
						<ISOGridSelect
							items={holeDeviations()}
							bind:value={holeLetter.current}
							placeholder="Deviation..."
							title="Deviation"
							class="flex-1"
						/>

						<ISOGridSelect
							items={grades()}
							bind:value={holeGrade.current}
							placeholder="Grade..."
							title="Grade"
							class="flex-1"
						/>
					{:else}
						<ISOSizeInput
							bind:value={holeManualUpper.current}
							aria-label="Upper limit (mm)"
							title="Upper limit"
							class="flex-1"
						>
							{#snippet icon()}
								<ChevronUpIcon class="size-3.5" aria-hidden="true" />
							{/snippet}
						</ISOSizeInput>

						<ISOSizeInput
							bind:value={holeManualLower.current}
							aria-label="Lower limit (mm)"
							title="Lower limit"
							class="flex-1"
						>
							{#snippet icon()}
								<ChevronDownIcon class="size-3.5" aria-hidden="true" />
							{/snippet}
						</ISOSizeInput>
					{/if}
				</div>

				{#if holeRows && lookupHole?.tolerance}
					<div class="mt-3 flex items-center gap-10">
						<ISOFitGlyph
							kind="hole"
							upper={lookupHole.tolerance.upper}
							lower={lookupHole.tolerance.lower}
							class="size-20 shrink-0"
						/>
						<div
							class="grid flex-1 grid-cols-[auto_auto_auto] items-center gap-x-3 gap-y-1.5 text-sm"
						>
							{#each holeRows as row (row.label)}
								{#if row.tag === 'dash'}
									<span class="h-px w-4 justify-self-start bg-muted-foreground"></span>
								{:else}
									<span class={cn('justify-self-start text-xs font-medium', row.tagClass)}
										>{row.tag}</span
									>
								{/if}
								<span class="justify-self-end tabular-nums">{row.value} mm</span>
								<span class="justify-self-start text-muted-foreground tabular-nums"
									>{row.sign}{row.deviation} µm</span
								>
							{/each}
						</div>
					</div>
				{:else if lookupHole?.error}
					<p class="text-destructive">{lookupHole.error}</p>
				{:else}
					<p>Complete input selection</p>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root class="flex-1">
			<Card.Header>
				<div class="flex items-center justify-between">
					<Card.Title class="text-2xl font-bold">
						<span
							contenteditable="true"
							role="textbox"
							tabindex="0"
							aria-label="Shaft name"
							bind:textContent={shaftName.current}
							onkeydown={handleNameKeydown}
							onblur={() => handleNameBlur(shaftName, 'Shaft')}
							class="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
						></span>
					</Card.Title>
					<Button
						variant="outline"
						size="icon"
						class="bg-background dark:bg-background"
						disabled={!lookupShaft?.tolerance}
						aria-label="Find nearby tolerance classes"
						title="Find nearby tolerance classes"
						onclick={() => (shaftReverseOpen = true)}
					>
						<SearchIcon class="size-4" />
					</Button>
				</div>
			</Card.Header>
			<Card.Content>
				<div class="flex items-center gap-2">
					<Button
						variant="outline"
						class="w-14 bg-background dark:bg-background"
						title="Toggle ISO / custom"
						onclick={() =>
							toggleMode(
								shaftMode,
								shaftNom,
								lookupShaft?.tolerance,
								shaftManualUpper,
								shaftManualLower,
								shaftLetter,
								shaftGrade,
								'shaft'
							)}
					>
						{shaftMode.current === 'iso' ? 'ISO' : '±'}
					</Button>

					<ISOSizeInput bind:value={shaftSize.current} title="Size (mm)" class="w-20 shrink-0">
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

					{#if shaftMode.current === 'iso'}
						<ISOGridSelect
							items={shaftDeviations()}
							bind:value={shaftLetter.current}
							placeholder="Deviation..."
							title="Deviation"
							class="flex-1"
						/>

						<ISOGridSelect
							items={grades()}
							bind:value={shaftGrade.current}
							placeholder="Grade..."
							title="Grade"
							class="flex-1"
						/>
					{:else}
						<ISOSizeInput
							bind:value={shaftManualUpper.current}
							aria-label="Upper limit (mm)"
							title="Upper limit"
							class="flex-1"
						>
							{#snippet icon()}
								<ChevronUpIcon class="size-3.5" aria-hidden="true" />
							{/snippet}
						</ISOSizeInput>

						<ISOSizeInput
							bind:value={shaftManualLower.current}
							aria-label="Lower limit (mm)"
							title="Lower limit"
							class="flex-1"
						>
							{#snippet icon()}
								<ChevronDownIcon class="size-3.5" aria-hidden="true" />
							{/snippet}
						</ISOSizeInput>
					{/if}
				</div>

				{#if shaftRows && lookupShaft?.tolerance}
					<div class="mt-3 flex items-center gap-10">
						<ISOFitGlyph
							kind="shaft"
							upper={lookupShaft.tolerance.upper}
							lower={lookupShaft.tolerance.lower}
							class="size-20 shrink-0"
						/>
						<div
							class="grid flex-1 grid-cols-[auto_auto_auto] items-center gap-x-3 gap-y-1.5 text-sm"
						>
							{#each shaftRows as row (row.label)}
								{#if row.tag === 'dash'}
									<span class="h-px w-4 justify-self-start bg-muted-foreground"></span>
								{:else}
									<span class={cn('justify-self-start text-xs font-medium', row.tagClass)}
										>{row.tag}</span
									>
								{/if}
								<span class="justify-self-end tabular-nums">{row.value} mm</span>
								<span class="justify-self-start text-muted-foreground tabular-nums"
									>{row.sign}{row.deviation} µm</span
								>
							{/each}
						</div>
					</div>
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
			{#if fit && holeLimits && shaftLimits}
				<ISOFitBand
					holeMin={holeLimits.min}
					holeMax={holeLimits.max}
					holeNominal={holeNom}
					{holeClass}
					holeName={holeName.current}
					shaftMin={shaftLimits.min}
					shaftMax={shaftLimits.max}
					shaftNominal={shaftNom}
					{shaftClass}
					shaftName={shaftName.current}
					class="mb-6"
				/>
				<div class="grid grid-cols-3 gap-6">
					<div>
						<p class="text-xs tracking-wide text-muted-foreground uppercase">Min</p>
						<p class="text-lg font-semibold">{fit.minClearance.toFixed(4)} mm</p>
						<p class="text-xs font-medium {clearanceLabel(fit.minClearance).class}">
							{clearanceLabel(fit.minClearance).text}
						</p>
					</div>
					<div>
						<p class="text-xs tracking-wide text-muted-foreground uppercase">Mid</p>
						<p class="text-lg font-semibold">{fit.midClearance.toFixed(4)} mm</p>
						<p class="text-xs font-medium {clearanceLabel(fit.midClearance).class}">
							{clearanceLabel(fit.midClearance).text}
						</p>
					</div>
					<div>
						<p class="text-xs tracking-wide text-muted-foreground uppercase">Max</p>
						<p class="text-lg font-semibold">{fit.maxClearance.toFixed(4)} mm</p>
						<p class="text-xs font-medium {clearanceLabel(fit.maxClearance).class}">
							{clearanceLabel(fit.maxClearance).text}
						</p>
					</div>
				</div>
			{:else}
				<p class="text-sm text-muted-foreground">Complete input selection</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>

<ISOReverseLookupDialog
	bind:open={holeReverseOpen}
	context={holeContext}
	onApply={applyHoleMatch}
/>
<ISOReverseLookupDialog
	bind:open={shaftReverseOpen}
	context={shaftContext}
	onApply={applyShaftMatch}
/>

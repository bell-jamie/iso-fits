<script lang="ts">
  import {lookupIso286 } from '$lib/iso286';

  let nominal = $state('');
  let holeClass = $state('');
  let shaftClass = $state('');
  let nom = $derived(parseFloat(nominal));

  let fit = $derived.by(() => { // derived.by() for function instead of expression
    if (!nom || !holeClass || !shaftClass) return null;

    try {
      const hole = lookupIso286(nom, holeClass);
      const shaft = lookupIso286(nom, shaftClass);
      return { hole, shaft, error: null };
    } catch (e) {
      return { hole: null, shaft: null, error: e instanceof Error ? e.message : 'Invalid input' };
    }
  })

  let limits = $derived.by(() => {
    if (!fit || fit.error) return null;

    const holeMax = nom + fit.hole!.upper;
    const holeMin = nom + fit.hole!.lower;
    const shaftMax = nom + fit.shaft!.upper;
    const shaftMin = nom + fit.shaft!.lower;
    const maxClearance = holeMax - shaftMin;
    const minClearance = holeMin - shaftMax;
    const type = minClearance > 0 ? 'Clearance': maxClearance < 0 ? 'Interference' : 'Transition';
    return { holeMax, holeMin, shaftMax, shaftMin, minClearance, maxClearance, type };
  })

  function formatSign(n: number): string {
    if (n === 0) return '0';
    return n >= 0 ? `+${n}` : `${n}`;
  }
</script>

<div>
    <label>
        Nominal size (mm)
        <input type="number" bind:value={nominal} />
    </label>

    <label>
        Hole tolerance class
        <input type="text" placeholder="e.g. H7" bind:value={holeClass} />
    </label>

    <label>
        Shaft tolerance class
        <input type="text" placeholder="e.g. h6" bind:value={shaftClass} />
    </label>
</div>

{#if fit?.error}
    <p style='color: red'>{fit.error}</p>
{:else if fit}
    <p>Hole: {formatSign(fit.hole?.upper ?? 0)} / {formatSign(fit.hole?.lower ?? 0)}</p>
    <p>Shaft: {formatSign(fit.shaft?.upper ?? 0)} / {formatSign(fit.shaft?.lower ?? 0)}</p>
{/if}

{#if limits}
    <p>Hole: {limits.holeMax.toFixed(3)} - {limits.holeMin.toFixed(3)} mm</p>
    <p>Shaft: {limits.shaftMax.toFixed(3)} - {limits.shaftMin.toFixed(3)} mm</p>
    <p>Clearance: {limits.minClearance.toFixed(3)} - {limits.maxClearance.toFixed(3)}</p>
    <p>Fit type: {limits.type}</p>
{/if}

<script lang="ts">
	import { cn } from '$lib/utils';

	let {
		upper,
		lower,
		middle,
		class: className
	}: {
		upper: number;
		lower: number;
		middle: number;
		class?: string;
	} = $props();

	let domainMin = $derived(Math.min(lower, 0));
	let domainMax = $derived(Math.max(upper, 0));
	let range = $derived(domainMax - domainMin || 1);

	function pct(value: number): number {
		return ((value - domainMin) / range) * 100;
	}

	let zoneLeft = $derived(pct(lower));
	let zoneRight = $derived(pct(upper));
	let zeroPos = $derived(pct(0));
	let midPos = $derived(pct(middle));
</script>

<div class={cn('relative h-2 w-full rounded-full bg-muted', className)}>
	<div
		class="absolute inset-y-0 rounded-full bg-primary/40"
		style={`left: ${zoneLeft}%; width: ${zoneRight - zoneLeft}%;`}
	></div>
	<div
		class="absolute inset-y-0 w-px bg-foreground/50"
		style={`left: ${zeroPos}%;`}
		title="Nominal"
	></div>
	<div
		class="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
		style={`left: ${midPos}%;`}
		title="Mid"
	></div>
</div>

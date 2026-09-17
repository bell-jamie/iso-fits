<script lang="ts">
	import { cn } from '$lib/utils';
	import { formatSign, formatMicrons } from '$lib/format';
	import { tone } from '$lib/tone';

	const NOMINAL_RADIUS = 32;
	const MAX_OFFSET = 14;
	const CENTER = 50;

	// three 120° sectors: lower (bottom-right), nominal (left), upper (top-right)
	const LOWER_SECTOR: [number, number] = [0, 120];
	const NOMINAL_SECTOR: [number, number] = [120, 240];
	const UPPER_SECTOR: [number, number] = [240, 360];

	let {
		kind,
		upper,
		lower,
		class: className
	}: {
		kind: 'hole' | 'shaft';
		upper: number;
		lower: number;
		class?: string;
	} = $props();

	let scale = $derived(MAX_OFFSET / (Math.max(Math.abs(upper), Math.abs(lower)) || 1));

	let lowerRadius = $derived(NOMINAL_RADIUS + lower * scale);
	let upperRadius = $derived(NOMINAL_RADIUS + upper * scale);

	const SLICE_CLASS = {
		on: 'fill-red-500/40 stroke-red-500 dark:fill-red-400/30 dark:stroke-red-400',
		off: 'fill-blue-500/40 stroke-blue-500 dark:fill-blue-400/30 dark:stroke-blue-400',
		neutral: 'fill-foreground/10 stroke-foreground/70'
	} as const;

	let upperTone = $derived(tone(upper, kind));
	let lowerTone = $derived(tone(lower, kind));

	let nominalTooltip = 'Nominal';
	let upperTooltip = $derived(
		`Upper limit: ${formatSign(upper)}${formatMicrons(Math.abs(upper * 1000))} µm`
	);
	let lowerTooltip = $derived(
		`Lower limit: ${formatSign(lower)}${formatMicrons(Math.abs(lower * 1000))} µm`
	);

	function polarPoint(radius: number, deg: number): { x: number; y: number } {
		const rad = (deg * Math.PI) / 180;
		return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
	}

	// float direction: each slice nudges outward along its own sector's bisector.
	function floatOffset(bisectorDeg: number): { x: number; y: number } {
		const rad = (bisectorDeg * Math.PI) / 180;
		return { x: 4 * Math.cos(rad), y: 4 * Math.sin(rad) };
	}

	const nominalFloat = floatOffset(180);
	const upperFloat = floatOffset(300);
	const lowerFloat = floatOffset(60);

	function slicePath(radius: number, [startDeg, endDeg]: [number, number]): string {
		const start = polarPoint(radius, startDeg);
		const end = polarPoint(radius, endDeg);
		return `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y} Z`;
	}
</script>

<svg viewBox="0 0 100 100" class={cn('size-full', className)}>
	<path
		d={slicePath(NOMINAL_RADIUS, NOMINAL_SECTOR)}
		class={cn('glyph-slice', SLICE_CLASS.neutral)}
		style={`--float-x: ${nominalFloat.x}px; --float-y: ${nominalFloat.y}px;`}
		stroke-width="1"
	>
		<title>{nominalTooltip}</title>
	</path>
	<path
		d={slicePath(upperRadius, UPPER_SECTOR)}
		class={cn('glyph-slice', SLICE_CLASS[upperTone])}
		style={`--float-x: ${upperFloat.x}px; --float-y: ${upperFloat.y}px;`}
		stroke-width="1.5"
	>
		<title>{upperTooltip}</title>
	</path>
	<path
		d={slicePath(lowerRadius, LOWER_SECTOR)}
		class={cn('glyph-slice', SLICE_CLASS[lowerTone])}
		style={`--float-x: ${lowerFloat.x}px; --float-y: ${lowerFloat.y}px;`}
		stroke-width="1.5"
	>
		<title>{lowerTooltip}</title>
	</path>
</svg>

<style>
	.glyph-slice {
		transition: transform 150ms ease-out;
		transform-box: fill-box;
		transform-origin: center;
	}
	.glyph-slice:hover {
		transform: translate(var(--float-x), var(--float-y));
	}
</style>

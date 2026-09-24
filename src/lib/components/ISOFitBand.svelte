<script lang="ts">
	import { cn } from '$lib/utils';
	import { shaftDeviations } from 'iso-286';

	let {
		holeMin,
		holeMax,
		holeNominal,
		holeClass,
		holeName,
		shaftMin,
		shaftMax,
		shaftNominal,
		shaftClass,
		shaftName,
		class: className
	}: {
		holeMin: number;
		holeMax: number;
		holeNominal: number;
		holeClass: string;
		holeName: string;
		shaftMin: number;
		shaftMax: number;
		shaftNominal: number;
		shaftClass: string;
		shaftName: string;
		class?: string;
	} = $props();

	// The zone bar shows the sub-range of actual sizes where clearance is still
	// possible, and the sub-range where interference is still possible, for the
	// fit as a whole — the union of the hole's-eye and shaft's-eye views of the
	// same zone math as the original egui fit_display. Hole and shaft are NOT
	// mirror images of each other (a hole growing is clearance-favourable, a
	// shaft growing is interference-favourable), so the two component-level
	// zones are combined into one rather than drawn as separate rows.
	type Zone = { bottom: number; top: number } | null;

	// top capped by the other component's max; bottom is this component's own min
	function cappedTopZone(ownMin: number, ownMax: number, otherMax: number): Zone {
		const top = Math.min(ownMax, otherMax);
		return top > ownMin ? { bottom: ownMin, top } : null;
	}

	// top is this component's own max; bottom raised to the other component's min
	function raisedBottomZone(ownMin: number, ownMax: number, otherMin: number): Zone {
		const bottom = Math.max(ownMin, otherMin);
		return ownMax > bottom ? { bottom, top: ownMax } : null;
	}

	// the combined span covered by either zone, since both are expressed on the
	// same actual-size axis
	function unionZone(a: Zone, b: Zone): Zone {
		if (!a) return b;
		if (!b) return a;
		return { bottom: Math.min(a.bottom, b.bottom), top: Math.max(a.top, b.top) };
	}

	// hole clearance: hole could be larger than the shaft (raised bottom, own top)
	let holeClearance = $derived(raisedBottomZone(holeMin, holeMax, shaftMin));
	// hole interference: hole could be smaller than the shaft (own bottom, capped top)
	let holeInterference = $derived(cappedTopZone(holeMin, holeMax, shaftMax));
	// shaft clearance: shaft could be smaller than the hole (own bottom, capped top)
	let shaftClearance = $derived(cappedTopZone(shaftMin, shaftMax, holeMax));
	// shaft interference: shaft could be larger than the hole (raised bottom, own top)
	let shaftInterference = $derived(raisedBottomZone(shaftMin, shaftMax, holeMin));

	let clearanceZone = $derived(unionZone(holeClearance, shaftClearance));
	let interferenceZone = $derived(unionZone(holeInterference, shaftInterference));

	// pad the domain so the bars don't touch the chart edges
	const PAD_FRACTION = 0.2;

	let domainMin = $derived(Math.min(holeMin, shaftMin));
	let domainMax = $derived(Math.max(holeMax, shaftMax));
	let span = $derived(domainMax - domainMin || 1);
	let pad = $derived(span * PAD_FRACTION);

	let viewMin = $derived(domainMin - pad);
	let viewSpan = $derived(domainMax + pad - viewMin || 1);

	function pct(value: number): number {
		return ((value - viewMin) / viewSpan) * 100;
	}

	// inverse of pct: a 0-100 x position back to an actual size
	function unpct(x: number): number {
		return viewMin + (x / 100) * viewSpan;
	}

	// hover crosshair: hoverFraction is 0-1 across the svg's rendered width,
	// tracked from pointer events so it works regardless of the viewBox's
	// non-uniform scaling
	let hoverFraction: number | null = $state(null);
	let hoverX = $derived(hoverFraction === null ? null : hoverFraction * 100);
	let hoverValue = $derived(hoverX === null ? null : unpct(hoverX));

	// how close the cursor needs to be to a comb tooth (in screen pixels) before
	// the crosshair snaps to it — outside that range it just follows the cursor
	const SNAP_THRESHOLD_PX = 10;

	function handlePointerMove(event: PointerEvent) {
		const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
		const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
		const rawX = fraction * 100;
		const nearest = combSnapEdges.reduce((closest, edge) =>
			Math.abs(edge - rawX) < Math.abs(closest - rawX) ? edge : closest
		);
		const snapThresholdX = (SNAP_THRESHOLD_PX / rect.width) * 100;
		hoverFraction = (Math.abs(nearest - rawX) <= snapThresholdX ? nearest : rawX) / 100;
	}

	function handlePointerLeave() {
		hoverFraction = null;
	}

	function zoneRect(zone: Zone): { left: number; width: number } | null {
		if (!zone) return null;
		const left = pct(zone.bottom);
		return { left, width: pct(zone.top) - left };
	}

	// a comb: min/max teeth joined by a spine, plus a nominal tooth (both full
	// height) and a shorter mid tooth, all reaching away from the spine toward
	// the bar — direction -1 points up (spine below, teeth above, for the
	// shaft's comb sitting just above the zone), +1 points down (spine above,
	// teeth hanging below, for the hole's comb sitting just below the zone)
	function combPath(
		minX: number,
		maxX: number,
		nominalX: number,
		spineY: number,
		direction: 1 | -1
	): string {
		const midX = (minX + maxX) / 2;
		const tipY = spineY + direction * COMB_HEIGHT;
		const midTipY = spineY + direction * COMB_MID_HEIGHT;
		return `M ${minX},${tipY} L ${minX},${spineY} L ${maxX},${spineY} L ${maxX},${tipY} M ${nominalX},${spineY} L ${nominalX},${tipY} M ${midX},${spineY} L ${midX},${midTipY}`;
	}

	let clearanceRect = $derived(zoneRect(clearanceZone));
	let interferenceRect = $derived(zoneRect(interferenceZone));

	// plain rectangles: shaft's free edge at the chart's low edge, bounded by
	// its upper limit; hole's free edge at the chart's high edge, bounded by
	// its lower limit.
	let shaftEdge = $derived(pct(shaftMax));
	let holeEdge = $derived(pct(holeMin));

	const CLEARANCE_CLASS = 'fill-blue-500/70 dark:fill-blue-400/60';
	const INTERFERENCE_CLASS = 'fill-red-500/70 dark:fill-red-400/60';
	const OUTLINE_CLASS = 'fill-none stroke-foreground/70';
	const HATCH_CLASS = 'stroke-foreground/70';
	const HATCH_LINE_CLASS = 'stroke-foreground/60';

	// row layout, top to bottom
	const OUTLINE_HEIGHT = 20;
	const ZONE_HEIGHT = 8;

	// min/max/nominal comb teeth reach COMB_HEIGHT away from their spine; the
	// gap on either side of the zone row needs to fit COMB_ZONE_GAP (spine to
	// zone), the teeth themselves, and COMB_BAR_GAP (tips to the bar)
	const COMB_HEIGHT = 6;
	const COMB_MID_HEIGHT = 3;
	const COMB_ZONE_GAP = 2;
	const COMB_BAR_GAP = 2;
	const ZONE_GAP = COMB_ZONE_GAP + COMB_HEIGHT + COMB_BAR_GAP;

	const shaftOutlineY = 1;
	const shaftBottom = shaftOutlineY + OUTLINE_HEIGHT;
	const zoneY = shaftBottom + ZONE_GAP;
	const holeOutlineY = zoneY + ZONE_HEIGHT + ZONE_GAP;
	const holeBottomY = holeOutlineY + OUTLINE_HEIGHT;
	const VIEW_HEIGHT = holeBottomY + 1;

	let shaftLabel = $derived(`${shaftName} ${shaftNominal} ${shaftClass}`);
	let holeLabel = $derived(`${holeName} ${holeNominal} ${holeClass}`);

	// the chart is scaled non-uniformly (preserveAspectRatio="none" on a viewBox
	// that's much wider than it is tall), so a viewBox-unit square isn't a
	// screen-pixel square — we measure the rendered svg to find the actual x/y
	// scale factors, so diagonals (the chamfer, the hatching) can be sized in
	// viewBox units to still come out at a true 45 degrees on screen
	let svgWidth = $state(0);
	let svgHeight = $state(0);
	let xScale = $derived(svgWidth / 100 || 1);
	let yScale = $derived(svgHeight / VIEW_HEIGHT || 1);

	// chamfer size: CHAMFER_Y is the real "how far it reaches" control, in
	// viewBox y-units; CHAMFER_X is derived so that, once scaled to screen
	// pixels, both legs are equal and the cut is a true 45-degree diagonal
	const CHAMFER_Y = 4;
	let CHAMFER_X = $derived(CHAMFER_Y * (yScale / xScale));

	// section-view hatching for the hole's solid material; same derivation as
	// the chamfer above so the hatch lines read at a true 45 degrees too
	const HATCH_SPACING_Y = 15;
	let HATCH_SPACING_X = $derived(HATCH_SPACING_Y * (yScale / xScale));

	let shaftPath = $derived(
		`M 0,${shaftOutlineY} L ${shaftEdge},${shaftOutlineY} L ${shaftEdge},${shaftBottom - CHAMFER_Y} L ${shaftEdge - CHAMFER_X},${shaftBottom} L 0,${shaftBottom} Z`
	);
	let shaftMinEdge = $derived(pct(shaftMin));
	let shaftMaxEdge = $derived(pct(shaftMax));
	let shaftMidEdge = $derived((shaftMinEdge + shaftMaxEdge) / 2);
	let shaftNominalEdge = $derived(pct(shaftNominal));
	// spine sits COMB_ZONE_GAP above the zone, teeth point up toward the shaft bar
	let shaftLimits = $derived(
		combPath(shaftMinEdge, shaftMaxEdge, shaftNominalEdge, zoneY - COMB_ZONE_GAP, -1)
	);
	let holePath = $derived(
		`M ${holeEdge + CHAMFER_X},${holeOutlineY} L 100,${holeOutlineY} L 100,${holeBottomY} L ${holeEdge},${holeBottomY} L ${holeEdge},${holeOutlineY + CHAMFER_Y} Z`
	);
	let holeBackground = $derived(
		`M ${holeEdge + CHAMFER_X},${holeOutlineY}, L 0,${holeOutlineY} L 0,${holeBottomY} L ${holeEdge},${holeBottomY} M 0,${holeOutlineY + CHAMFER_Y} L ${holeEdge},${holeOutlineY + CHAMFER_Y}`
	);
	let holeMinEdge = $derived(pct(holeMin));
	let holeMaxEdge = $derived(pct(holeMax));
	let holeMidEdge = $derived((holeMinEdge + holeMaxEdge) / 2);
	let holeNominalEdge = $derived(pct(holeNominal));
	// spine sits COMB_ZONE_GAP below the zone, teeth hang down toward the hole bar
	let holeLimits = $derived(
		combPath(holeMinEdge, holeMaxEdge, holeNominalEdge, zoneY + ZONE_HEIGHT + COMB_ZONE_GAP, 1)
	);

	// every comb tooth position (both bars' min/mid/max/nominal), for the
	// hover crosshair to snap to
	let combSnapEdges = $derived([
		shaftMinEdge,
		shaftMidEdge,
		shaftMaxEdge,
		shaftNominalEdge,
		holeMinEdge,
		holeMidEdge,
		holeMaxEdge,
		holeNominalEdge
	]);
</script>

<div class={cn('flex flex-col gap-1', className)}>
	<div class="text-xs font-bold whitespace-nowrap">
		{shaftLabel}
	</div>
	<div class="relative">
		<svg
			viewBox={`0 0 100 ${VIEW_HEIGHT}`}
			preserveAspectRatio="none"
			class="h-20 w-full"
			bind:clientWidth={svgWidth}
			bind:clientHeight={svgHeight}
			onpointermove={handlePointerMove}
			onpointerleave={handlePointerLeave}
		>
			<defs>
				<pattern
					id="hole-hatch"
					patternUnits="userSpaceOnUse"
					width={HATCH_SPACING_X}
					height={HATCH_SPACING_Y}
				>
					<line
						x1="0"
						y1={HATCH_SPACING_Y}
						x2={HATCH_SPACING_X}
						y2="0"
						class={HATCH_LINE_CLASS}
						stroke-width="0.4"
						vector-effect="non-scaling-stroke"
					/>
				</pattern>
				<pattern
					id="shaft-hatch"
					patternUnits="userSpaceOnUse"
					width={HATCH_SPACING_X}
					height={HATCH_SPACING_Y}
				>
					<line
						x1="0"
						y1="0"
						x2={HATCH_SPACING_X}
						y2={HATCH_SPACING_Y}
						class={HATCH_LINE_CLASS}
						stroke-width="0.4"
						vector-effect="non-scaling-stroke"
					/>
				</pattern>
			</defs>
			<path
				d={shaftPath}
				class={HATCH_CLASS}
				fill="url(#shaft-hatch)"
				stroke-width="0.75"
				vector-effect="non-scaling-stroke"
			/>
			<path
				d={shaftLimits}
				class={OUTLINE_CLASS}
				stroke-width="0.75"
				vector-effect="non-scaling-stroke"
			/>

			{#if clearanceRect}
				<rect
					x={clearanceRect.left}
					y={zoneY}
					width={clearanceRect.width}
					height={ZONE_HEIGHT}
					class={CLEARANCE_CLASS}
				/>
			{/if}
			{#if interferenceRect}
				<rect
					x={interferenceRect.left}
					y={zoneY}
					width={interferenceRect.width}
					height={ZONE_HEIGHT}
					class={INTERFERENCE_CLASS}
				/>
			{/if}

			<path
				d={holePath}
				class={HATCH_CLASS}
				fill="url(#hole-hatch)"
				stroke-width="0.75"
				vector-effect="non-scaling-stroke"
			/>
			<path
				d={holeBackground}
				class={OUTLINE_CLASS}
				stroke-width="0.75"
				vector-effect="non-scaling-stroke"
			/>
			<path
				d={holeLimits}
				class={OUTLINE_CLASS}
				stroke-width="0.75"
				vector-effect="non-scaling-stroke"
			/>

			{#if hoverX !== null}
				<line
					x1={hoverX}
					y1="0"
					x2={hoverX}
					y2={VIEW_HEIGHT}
					class="stroke-foreground/70"
					stroke-width="1"
					vector-effect="non-scaling-stroke"
					pointer-events="none"
				/>
			{/if}
		</svg>

		{#if hoverValue !== null && hoverFraction !== null}
			<div
				class="pointer-events-none absolute -top-6 -translate-x-1/2 rounded border border-border bg-popover px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-popover-foreground tabular-nums shadow-sm"
				style={`left: ${hoverFraction * 100}%`}
			>
				{hoverValue.toFixed(3)} mm
			</div>
		{/if}
	</div>
	<div class="text-right text-xs font-bold whitespace-nowrap">
		{holeLabel}
	</div>
	<!-- <div class="flex justify-between pl-12 text-xs text-muted-foreground tabular-nums">
		<span>{domainMin.toFixed(4)} mm</span>
		<span>{domainMax.toFixed(4)} mm</span>
	</div> -->
</div>

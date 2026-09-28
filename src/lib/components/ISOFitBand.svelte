<script lang="ts">
	import { cn } from '$lib/utils';
	import { formatClearance, clearanceLabel } from '$lib/format';
	// import { shaftDeviations } from 'iso-286';

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
		shaftActualDrag = $bindable(null),
		holeActualDrag = $bindable(null),
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
		// bindable "what if the actual size were X" drag position for each
		// draggable edge — exposed so callers (e.g. the Min/Mid/Max buttons in
		// the Fit card) can snap the visualisation to a scenario from outside
		shaftActualDrag?: number | null;
		holeActualDrag?: number | null;
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
	const PAD_FRACTION = 0.3;

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

	// which comb tooth/teeth (if any) the crosshair is currently snapped to, so
	// the tooltip can name them (e.g. "Hole Max") instead of just showing a
	// number — an array since coincident points (e.g. Hole Max == Shaft Min)
	// should all be named together, not have one silently win; each keeps its
	// group so the tooltip can put shaft and hole labels on separate lines
	let snappedLabels: { label: string; group: 'shaft' | 'hole' }[] = $state([]);

	// how close the cursor needs to be to a comb tooth (in screen pixels) before
	// the crosshair snaps to it — outside that range it just follows the cursor
	const SNAP_THRESHOLD_PX = 10;
	// two tooth positions this close together (in viewBox x-units) count as the
	// same point, rather than two distinct points that happen to be near each
	// other — guards against float noise when they're mathematically coincident
	const SNAP_TIE_EPSILON = 1e-6;

	// finds the comb tooth/teeth (if any) nearest x, within snapping distance
	function findSnap(
		x: number,
		snapThresholdX: number
	): { x: number; labels: { label: string; group: 'shaft' | 'hole' }[] } {
		const distances = combSnapPoints.map((point) => ({ point, dist: Math.abs(point.x - x) }));
		const minDist = Math.min(...distances.map((d) => d.dist));
		if (minDist > snapThresholdX) return { x, labels: [] };
		const matches = distances.filter((d) => d.dist - minDist <= SNAP_TIE_EPSILON);
		return {
			x: matches[0].point.x,
			labels: matches.map((m) => ({ label: m.point.label, group: m.point.group }))
		};
	}

	function handlePointerMove(event: PointerEvent) {
		const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
		const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
		const rawX = fraction * 100;
		const snapThresholdX = (SNAP_THRESHOLD_PX / rect.width) * 100;

		// figure out the snapped (or raw) x position first, then drive both the
		// crosshair and any active drag off that same value — so dragging a
		// handle near a comb tooth snaps the handle itself, not just the cursor
		let snap = findSnap(rawX, snapThresholdX);

		// while dragging, clamp to that component's own comb range — if that
		// clamp actually kicks in (dragged past the limit), the crosshair would
		// otherwise keep following the cursor while the handle stays put,
		// visually tearing apart; snapping both to the clamped position instead
		// gives the "stops at the edge of its comb, like elastic" feel. Re-run
		// the tooth search around that clamped spot too, so if it lands on (or
		// next to) another tooth — e.g. the hole's, sitting right where the
		// shaft's limit is — that tooltip still shows instead of going blank
		if (draggingKind === 'shaft' || draggingKind === 'hole') {
			const min = draggingKind === 'shaft' ? shaftMin : holeMin;
			const max = draggingKind === 'shaft' ? shaftMax : holeMax;
			const clamped = clamp(unpct(snap.x), min, max);
			const clampedX = pct(clamped);
			if (clampedX !== snap.x) snap = findSnap(clampedX, snapThresholdX);
			if (draggingKind === 'shaft') shaftActualDrag = clamped;
			else holeActualDrag = clamped;
			hoverFraction = snap.x / 100;
			snappedLabels = snap.labels;
			return;
		}

		hoverFraction = snap.x / 100;
		snappedLabels = snap.labels;
	}

	function handlePointerLeave() {
		if (draggingKind) return;
		hoverFraction = null;
		snappedLabels = [];
	}

	function clamp(value: number, min: number, max: number): number {
		return Math.min(max, Math.max(min, value));
	}

	// draggable "what if the actual size were X" markers for the shaft's right
	// (chamfered) edge and the hole's left (chamfered) edge — clamped to that
	// component's own min/max; null means "not dragged, sit at the default
	// position". Bindable (see $props above) so callers can drive it too.
	let shaftActual = $derived(
		clamp(shaftActualDrag ?? (shaftMin + shaftMax) / 2, shaftMin, shaftMax)
	);
	let holeActual = $derived(clamp(holeActualDrag ?? (holeMin + holeMax) / 2, holeMin, holeMax));

	// the fit this drag position would actually produce — defaults to each
	// component sitting at its own mid tolerance until either is dragged
	let currentClearance = $derived(holeActual - shaftActual);

	let draggingKind: 'shaft' | 'hole' | null = $state(null);

	function startDrag(kind: 'shaft' | 'hole', event: PointerEvent) {
		draggingKind = kind;
		(event.currentTarget as Element).setPointerCapture(event.pointerId);
		event.preventDefault();
	}

	function endDrag() {
		draggingKind = null;
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
	let shaftEdge = $derived(pct(shaftActual));
	let holeEdge = $derived(pct(holeActual));

	const CLEARANCE_CLASS = 'fill-blue-500/70 dark:fill-blue-400/60';
	const INTERFERENCE_CLASS = 'fill-red-500/70 dark:fill-red-400/60';
	const OUTLINE_CLASS = 'fill-none stroke-foreground/70';
	// the free (uncut) edges — shaft's top+left, hole's bottom+right — get a
	// dashed "break line" treatment, the engineering-drawing convention for
	// "this part continues, we're just not drawing the rest of it", as
	// opposed to the solid data-bounded edges which are real measurements
	const BREAK_EDGE_CLASS = 'fill-none stroke-foreground/70';
	const BREAK_DASH = '4 3';
	const HATCH_LINE_CLASS = 'stroke-foreground/60';

	// row layout, top to bottom
	const OUTLINE_HEIGHT = 20;
	const ZONE_HEIGHT = 3;

	// min/max/nominal comb teeth reach COMB_HEIGHT away from their spine; the
	// gap on either side of the zone row needs to fit COMB_ZONE_GAP (spine to
	// zone), the teeth themselves, and COMB_BAR_GAP (tips to the bar)
	const COMB_HEIGHT = 5;
	const COMB_MID_HEIGHT = 3;
	const COMB_ZONE_GAP = 2;
	const COMB_BAR_GAP = 7;
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
	const CHAMFER_Y = 5;
	let CHAMFER_X = $derived(CHAMFER_Y * (yScale / xScale));

	// width of the invisible drag handle over the draggable edges, sized in
	// screen pixels (via xScale) so it's a comfortable grab target regardless
	// of how wide the chart is actually rendered
	const DRAG_HANDLE_WIDTH_PX = 14;
	let dragHandleWidth = $derived(DRAG_HANDLE_WIDTH_PX / xScale);

	// section-view hatching for the hole's solid material; same derivation as
	// the chamfer above so the hatch lines read at a true 45 degrees too
	const HATCH_SPACING_Y = 15;
	let HATCH_SPACING_X = $derived(HATCH_SPACING_Y * (yScale / xScale));

	let shaftPath = $derived(
		`M 0,${shaftOutlineY} L ${shaftEdge},${shaftOutlineY} L ${shaftEdge},${shaftBottom - CHAMFER_Y} L ${shaftEdge - CHAMFER_X},${shaftBottom} L 0,${shaftBottom} Z`
	);
	// the outline split into its two arcs: free (top+left, break line, dashed)
	// and data-bounded (right chamfer+bottom, real measurement, solid)
	let shaftBreakEdge = $derived(
		`M 0,${shaftBottom} L 0,${shaftOutlineY} L ${shaftEdge},${shaftOutlineY}`
	);
	let shaftSolidEdge = $derived(
		`M ${shaftEdge},${shaftOutlineY} L ${shaftEdge},${shaftBottom - CHAMFER_Y} L ${shaftEdge - CHAMFER_X},${shaftBottom} L 0,${shaftBottom}`
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
	// the outline split into its two arcs: free (bottom+right, break line,
	// dashed) and data-bounded (left chamfer+top, real measurement, solid)
	let holeSolidEdge = $derived(
		`M ${holeEdge},${holeBottomY} L ${holeEdge},${holeOutlineY + CHAMFER_Y} L ${holeEdge + CHAMFER_X},${holeOutlineY} L 100,${holeOutlineY}`
	);
	let holeBreakEdge = $derived(
		`M 100,${holeOutlineY} L 100,${holeBottomY} L ${holeEdge},${holeBottomY}`
	);
	// top edge (solid, continues the main hole's top surface) and the chamfer
	// shelf line stay solid; left+bottom are the background's own free edges
	let holeBackgroundTop = $derived(`M ${holeEdge + CHAMFER_X},${holeOutlineY} L 0,${holeOutlineY}`);
	let holeBackgroundShelf = $derived(
		`M 0,${holeOutlineY + CHAMFER_Y} L ${holeEdge},${holeOutlineY + CHAMFER_Y}`
	);
	let holeBackgroundBreakEdge = $derived(
		`M 0,${holeOutlineY} L 0,${holeBottomY} L ${holeEdge},${holeBottomY}`
	);
	let holeMinEdge = $derived(pct(holeMin));
	let holeMaxEdge = $derived(pct(holeMax));
	let holeMidEdge = $derived((holeMinEdge + holeMaxEdge) / 2);
	let holeNominalEdge = $derived(pct(holeNominal));
	// spine sits COMB_ZONE_GAP below the zone, teeth hang down toward the hole bar
	let holeLimits = $derived(
		combPath(holeMinEdge, holeMaxEdge, holeNominalEdge, zoneY + ZONE_HEIGHT + COMB_ZONE_GAP, 1)
	);

	// tooltip labels split by group, so shaft and hole each get their own line
	let shaftSnapLabels = $derived(
		snappedLabels.filter((l) => l.group === 'shaft').map((l) => l.label)
	);
	let holeSnapLabels = $derived(
		snappedLabels.filter((l) => l.group === 'hole').map((l) => l.label)
	);
	// how many lines the tooltip needs: one per non-empty label group, plus
	// the value line, controls how far above the crosshair it's offset
	let tooltipTopClass = $derived(
		(shaftSnapLabels.length ? 1 : 0) + (holeSnapLabels.length ? 1 : 0) === 2
			? '-top-14'
			: snappedLabels.length
				? '-top-10'
				: '-top-6'
	);

	// every comb tooth position (both bars' min/mid/max/nominal), labelled, for
	// the hover crosshair to snap to and name in the tooltip — grouped by which
	// bar it belongs to, so coincident shaft/hole teeth can be shown on
	// separate lines rather than run together
	let combSnapPoints = $derived([
		{ x: shaftMinEdge, label: `${shaftName} Min`, group: 'shaft' as const },
		{ x: shaftMidEdge, label: `${shaftName} Mid`, group: 'shaft' as const },
		{ x: shaftMaxEdge, label: `${shaftName} Max`, group: 'shaft' as const },
		{ x: shaftNominalEdge, label: `${shaftName} Nom`, group: 'shaft' as const },
		{ x: holeMinEdge, label: `${holeName} Min`, group: 'hole' as const },
		{ x: holeMidEdge, label: `${holeName} Mid`, group: 'hole' as const },
		{ x: holeMaxEdge, label: `${holeName} Max`, group: 'hole' as const },
		{ x: holeNominalEdge, label: `${holeName} Nom`, group: 'hole' as const }
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
			class="h-40 w-full overflow-visible"
			bind:clientWidth={svgWidth}
			bind:clientHeight={svgHeight}
			onpointermove={handlePointerMove}
			onpointerleave={handlePointerLeave}
			onpointerup={endDrag}
			onpointercancel={endDrag}
			role="figure"
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
			<path d={shaftPath} fill="url(#shaft-hatch)" />
			<path
				d={shaftBreakEdge}
				class={BREAK_EDGE_CLASS}
				stroke-width="0.75"
				stroke-dasharray={BREAK_DASH}
				vector-effect="non-scaling-stroke"
			/>
			<path
				d={shaftSolidEdge}
				class={OUTLINE_CLASS}
				stroke-width="0.75"
				vector-effect="non-scaling-stroke"
			/>
			<path
				d={shaftLimits}
				class={OUTLINE_CLASS}
				stroke-width="0.75"
				vector-effect="non-scaling-stroke"
			/>
			<rect
				x={shaftEdge - dragHandleWidth / 2}
				y={shaftOutlineY}
				width={dragHandleWidth}
				height={OUTLINE_HEIGHT}
				fill="transparent"
				pointer-events="all"
				class="cursor-ew-resize"
				role="slider"
				aria-label="{shaftName} actual size"
				aria-valuemin={shaftMin}
				aria-valuemax={shaftMax}
				aria-valuenow={shaftActual}
				tabindex="0"
				onpointerdown={(event) => startDrag('shaft', event)}
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

			<path d={holePath} fill="url(#hole-hatch)" />
			<path
				d={holeSolidEdge}
				class={OUTLINE_CLASS}
				stroke-width="0.75"
				vector-effect="non-scaling-stroke"
			/>
			<path
				d={holeBreakEdge}
				class={BREAK_EDGE_CLASS}
				stroke-width="0.75"
				stroke-dasharray={BREAK_DASH}
				vector-effect="non-scaling-stroke"
			/>
			<path
				d={holeBackgroundTop}
				class={OUTLINE_CLASS}
				stroke-width="0.75"
				vector-effect="non-scaling-stroke"
			/>
			<path
				d={holeBackgroundShelf}
				class={OUTLINE_CLASS}
				stroke-width="0.75"
				vector-effect="non-scaling-stroke"
			/>
			<path
				d={holeBackgroundBreakEdge}
				class={BREAK_EDGE_CLASS}
				stroke-width="0.75"
				stroke-dasharray={BREAK_DASH}
				vector-effect="non-scaling-stroke"
			/>
			<path
				d={holeLimits}
				class={OUTLINE_CLASS}
				stroke-width="0.75"
				vector-effect="non-scaling-stroke"
			/>
			<rect
				x={holeEdge - dragHandleWidth / 2}
				y={holeOutlineY}
				width={dragHandleWidth}
				height={OUTLINE_HEIGHT}
				fill="transparent"
				pointer-events="all"
				class="cursor-ew-resize"
				role="slider"
				aria-label="{holeName} actual size"
				aria-valuemin={holeMin}
				aria-valuemax={holeMax}
				aria-valuenow={holeActual}
				tabindex="0"
				onpointerdown={(event) => startDrag('hole', event)}
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
				class="pointer-events-none absolute {tooltipTopClass} -translate-x-1/2 rounded border border-border bg-popover px-1.5 py-0.5 text-xs whitespace-nowrap text-popover-foreground shadow-sm"
				style={`left: ${hoverFraction * 100}%`}
			>
				{#if shaftSnapLabels.length}
					<p class="font-semibold">{shaftSnapLabels.join(' / ')}</p>
				{/if}
				{#if holeSnapLabels.length}
					<p class="font-semibold">{holeSnapLabels.join(' / ')}</p>
				{/if}
				<p class="font-medium tabular-nums">{hoverValue.toFixed(4)} mm</p>
			</div>
		{/if}
	</div>
	<div class="text-right text-xs font-bold whitespace-nowrap">
		{holeLabel}
	</div>
	<div class="mt-1 flex items-center justify-center gap-1.5 text-xs">
		<span class="text-muted-foreground">Current fit</span>
		<span class="font-semibold tabular-nums">{formatClearance(currentClearance)}</span>
		<span class="font-medium {clearanceLabel(currentClearance).class}">
			{clearanceLabel(currentClearance).text}
		</span>
	</div>
	<!-- <div class="flex justify-between pl-12 text-xs text-muted-foreground tabular-nums">
		<span>{domainMin.toFixed(4)} mm</span>
		<span>{domainMax.toFixed(4)} mm</span>
	</div> -->
</div>

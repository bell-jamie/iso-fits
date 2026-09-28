export function formatSign(n: number): string {
	return n < 0 ? '−' : '+';
}

export function formatMicrons(n: number): string {
	const rounded = Math.round(n * 10) / 10;
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

// native number inputs bind their value as a number (or undefined when empty),
// not the string their `type="text"` siblings use, despite the shared prop type
export function decimalPlaces(value: string | number | undefined | null): number {
	if (value === undefined || value === null) return 0;
	const str = String(value);
	const idx = str.indexOf('.');
	return idx === -1 ? 0 : str.length - idx - 1;
}

// same blue/red convention as the fit glyph's clearance/interference zones
export const CLEARANCE_TEXT_CLASS = 'text-blue-500 dark:text-blue-400';
export const INTERFERENCE_TEXT_CLASS = 'text-red-500 dark:text-red-400';

// fit clearances are usually well under a millimetre, where microns read far
// more naturally than a string of leading zeros in mm. Shown unsigned since
// the accompanying clearanceLabel already conveys clearance vs interference
// ("30 µm interference" reads naturally; "-30 µm interference" doesn't)
export function formatClearance(mm: number): string {
	const abs = Math.abs(mm);
	return abs < 1 ? `${formatMicrons(abs * 1000)} µm` : `${abs.toFixed(4)} mm`;
}

export function clearanceLabel(value: number): { text: string; class: string } {
	return value >= 0
		? { text: 'Clearance', class: CLEARANCE_TEXT_CLASS }
		: { text: 'Interference', class: INTERFERENCE_TEXT_CLASS };
}

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

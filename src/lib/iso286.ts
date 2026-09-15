import { limits } from 'iso-286';

export interface Iso286Tolerance {
	upper: number;
	middle: number;
	lower: number;
}

export function lookupIso286(nominal: number, toleranceClass: string): Iso286Tolerance {
	const tol = limits(nominal, toleranceClass);
	const result: Iso286Tolerance = { upper: tol.upper, middle: tol.middle, lower: tol.lower };
	tol.free(); // because Rust doesn't have a garbage collector, this would leak
	return result;
}

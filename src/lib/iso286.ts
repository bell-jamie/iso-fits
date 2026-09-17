import { limits, findPreferred, listClosest, Feature } from 'iso-286';

export interface Iso286Tolerance {
	upper: number;
	middle: number;
	lower: number;
}

export interface Iso286Match {
	class: string;
	size: number;
	upper: number;
	middle: number;
	lower: number;
	error: number;
}

export function lookupIso286(nominal: number, toleranceClass: string): Iso286Tolerance {
	const tol = limits(nominal, toleranceClass);
	const result: Iso286Tolerance = { upper: tol.upper, middle: tol.middle, lower: tol.lower };
	tol.free(); // because Rust doesn't have a garbage collector, this would leak
	return result;
}

function copyMatch(match: {
	class: string;
	size: number;
	upper: number;
	middle: number;
	lower: number;
	error: number;
}): Iso286Match {
	return {
		class: match.class,
		size: match.size,
		upper: match.upper,
		middle: match.middle,
		lower: match.lower,
		error: match.error
	};
}

export function findPreferredFit(size: number, toleranceClass: string): Iso286Match {
	const match = findPreferred(size, toleranceClass);
	const result = copyMatch(match);
	match.free(); // because Rust doesn't have a garbage collector, this would leak
	return result;
}

export function listClosestFits(
	size: number,
	upper: number,
	lower: number,
	feature: 'hole' | 'shaft',
	strict: boolean,
	results: number,
	decimals: number
): Iso286Match[] {
	const matches = listClosest(
		size,
		upper,
		lower,
		feature === 'hole' ? Feature.Hole : Feature.Shaft,
		strict,
		results,
		decimals
	);
	const list = matches.map(copyMatch);
	for (const match of matches) match.free(); // because Rust doesn't have a garbage collector, this would leak
	return list;
}

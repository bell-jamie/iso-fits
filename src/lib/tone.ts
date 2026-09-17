export type Tone = 'on' | 'off' | 'neutral';

// a hole's positive deviation removes material (mass-off); a shaft's positive
// deviation adds material (mass-on). Zero deviation is neutral — that limit
// sits exactly on nominal, neither on nor off.
export function tone(deviation: number, kind: 'hole' | 'shaft'): Tone {
	if (deviation === 0) return 'neutral';
	const positive = deviation > 0;
	const massOn = kind === 'shaft' ? positive : !positive;
	return massOn ? 'on' : 'off';
}

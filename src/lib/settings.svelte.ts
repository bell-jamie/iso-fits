import { PersistedState } from 'runed';

export const gridFlow = new PersistedState<'row' | 'column'>('isoGridSelectFlow', 'row');

// the localStorage keys backing +page.svelte's hole/shaft PersistedState
// inputs — kept here so the reset button can clear them without needing to
// reach into the page's local state
export const CALCULATOR_STORAGE_KEYS = [
	'holeSize',
	'holeLetter',
	'holeGrade',
	'holeMode',
	'holeManualUpper',
	'holeManualLower',
	'holeName',
	'shaftSize',
	'shaftLetter',
	'shaftGrade',
	'shaftMode',
	'shaftManualUpper',
	'shaftManualLower',
	'shaftName',
	'sizeSynced'
];

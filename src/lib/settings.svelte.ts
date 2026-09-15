import { PersistedState } from 'runed';

export const gridFlow = new PersistedState<'row' | 'column'>('isoGridSelectFlow', 'row');

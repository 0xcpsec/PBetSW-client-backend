import { FetchEndpointDef } from './types';

export const casinoRoyaleStatusV3: FetchEndpointDef = {
  path: '/api/Casino/CasinoRoyaleStatusV3',
  method: 'GET',
  originType: 'sports',
  needsSessionInPath: false,
  pollIntervalMs: null,
  cronSchedule: '0 */6 * * *',
};

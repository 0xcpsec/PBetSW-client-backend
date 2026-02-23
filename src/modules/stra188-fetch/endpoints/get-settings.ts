import { FetchEndpointDef } from './types';

export const getSettings: FetchEndpointDef = {
  path: '/api/Config/GetSettings',
  method: 'GET',
  originType: 'sports',
  needsSessionInPath: false,
  pollIntervalMs: 30 * 1000,
  cronSchedule: undefined,
};

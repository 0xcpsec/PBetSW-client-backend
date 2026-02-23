import { FetchEndpointDef } from './types';

export const getLabel: FetchEndpointDef = {
  path: '/NewIndex/GetLabel',
  method: 'GET',
  originType: 'newIndex',
  needsSessionInPath: true,
  pollIntervalMs: null,
  cronSchedule: '0 */6 * * *',
};

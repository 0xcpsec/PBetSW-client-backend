import { FetchEndpointDef } from './types';

export const getJSResource: FetchEndpointDef = {
  path: '/JSResourceApi/GetJSResource',
  method: 'POST',
  originType: 'sports',
  needsSessionInPath: true,
  pollIntervalMs: null,
  cronSchedule: '0 */6 * * *',
};

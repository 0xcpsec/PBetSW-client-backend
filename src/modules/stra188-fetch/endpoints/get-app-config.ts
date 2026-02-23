import { FetchEndpointDef } from './types';

export const getAppConfig: FetchEndpointDef = {
  path: '/NewIndex/GetAppConfig',
  method: 'GET',
  originType: 'newIndex',
  needsSessionInPath: true,
  pollIntervalMs: null,
  cronSchedule: '0 */6 * * *',
};

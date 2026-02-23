import { FetchEndpointDef } from './types';

export const getMoneyLineMappingOddsList: FetchEndpointDef = {
  path: '/api/SpreadSetting/GetMoneyLineMappingOddsList',
  method: 'POST',
  originType: 'sports',
  needsSessionInPath: false,
  pollIntervalMs: null,
  cronSchedule: '0 */6 * * *',
};

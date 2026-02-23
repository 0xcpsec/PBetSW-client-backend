import { FetchEndpointDef } from './types';

export const desktopMenu: FetchEndpointDef = {
  path: '/api/menu/desktopMenu',
  method: 'POST',
  originType: 'sports',
  needsSessionInPath: false,
  pollIntervalMs: 30 * 1000,
  cronSchedule: undefined,
  postBody: 9,
};

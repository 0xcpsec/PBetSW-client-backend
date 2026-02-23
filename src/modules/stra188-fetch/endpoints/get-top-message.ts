import { FetchEndpointDef } from './types';

export const getTopMessage: FetchEndpointDef = {
  path: '/api/Message/GetTopMessage',
  method: 'GET',
  originType: 'sports',
  needsSessionInPath: false,
  pollIntervalMs: 30 * 1000,
  cronSchedule: undefined,
  getDefaultQuery: (service) => service.buildGetTopMessageQuery(),
};

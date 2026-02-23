/**
 * Stra188 fetch endpoints. Origin: newIndex = newIndexUrl, sports = sportsUrl (from Stra188 context).
 */
import { getAppConfig } from './get-app-config';
import { getLabel } from './get-label';
import { getSettings } from './get-settings';
import { getJSResource } from './get-js-resource';
import { casinoRoyaleStatusV3 } from './casino-royale-status-v3';
import { getTopMessage } from './get-top-message';
import { getMoneyLineMappingOddsList } from './get-money-line-mapping-odds-list';
import { desktopMenu } from './desktop-menu';
import { FetchEndpointDef } from './types';

export { getAppConfig, getLabel, getSettings, getJSResource, casinoRoyaleStatusV3, getTopMessage, getMoneyLineMappingOddsList, desktopMenu };
export type { FetchEndpointDef } from './types';

export const FETCH_ENDPOINTS: FetchEndpointDef[] = [
  desktopMenu,
  getAppConfig,
  getLabel,
  getSettings,
  getJSResource,
  casinoRoyaleStatusV3,
  getTopMessage,
  getMoneyLineMappingOddsList,
];

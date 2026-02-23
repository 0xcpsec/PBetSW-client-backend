/**
 * originType: use Stra188 context as-is.
 * - newIndex: GetAppConfig, GetLabel (newIndexUrl)
 * - sports: DesktopMenu, GetTopMessage, GetSettings, GetMoneyLineMappingOddsList, CasinoRoyaleStatusV3, GetJSResource (sportsUrl)
 */
export interface FetchEndpointDef {
  path: string;
  method: 'GET' | 'POST';
  originType: 'sports' | 'newIndex';
  needsSessionInPath: boolean;
  pollIntervalMs: number | null;
  cronSchedule?: string;
  postBody?: any;
  getDefaultQuery?: (service: any) => string;
}

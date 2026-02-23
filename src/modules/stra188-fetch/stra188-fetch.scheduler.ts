import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { Stra188FetchService } from './stra188-fetch.service';
import { FETCH_ENDPOINTS } from './stra188-fetch.config';
import { Stra188Service } from '../stra188/stra188.service';

@Injectable()
export class Stra188FetchScheduler implements OnModuleInit {
  constructor(
    private readonly stra188FetchService: Stra188FetchService,
    private readonly stra188Service: Stra188Service,
  ) {}

  async onModuleInit() {
    setTimeout(() => this.stra188FetchService.pollAll().catch((e) => console.error('[Stra188Fetch] Initial poll failed:', e?.message)), 45000);
  }

  @Interval(30 * 1000)
  async pollIntervalEndpoints() {
    for (const def of FETCH_ENDPOINTS) {
      if (def.pollIntervalMs != null) {
        try {
          await this.stra188FetchService.pollEndpoint(def);
        } catch (err: any) {
          if (err?.response?.status === 401) {
            console.log('[Stra188Fetch] 401 Unauthorized, reinitializing...');
            this.stra188Service.reinitialize();
          }
        }
      }
    }
  }

  @Cron('0 */6 * * *')
  async pollCronEndpoints() {
    for (const def of FETCH_ENDPOINTS) {
      if (def.cronSchedule) {
        const query = def.path === '/JSResourceApi/GetJSResource' ? 'lang=vn' : undefined;
        await this.stra188FetchService.pollEndpoint(def, query);
      }
    }
  }
}

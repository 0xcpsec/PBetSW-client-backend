import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import axios from 'axios';
import { FETCH_ENDPOINTS, FetchEndpointDef } from './stra188-fetch.config';
import { desktopMenu } from './endpoints/desktop-menu';
import { Stra188Service } from '../stra188/stra188.service';

const CACHE_COLLECTION = 'stra188_fetch_cache';

const EMPTY_DESKTOP = { Next: 30, Data: [] };

const DATA_PARSER_SERVER_URL = process.env.DATA_PASER_SERVER_URL || 'http://127.0.0.1:5000';

@Injectable()
export class Stra188FetchService implements OnModuleInit {
  constructor(
    @InjectConnection() private connection: Connection,
    @Inject(forwardRef(() => Stra188Service)) private stra188Service: Stra188Service,
  ) {}

  async onModuleInit() {
    try {
      await this.connection.createCollection(CACHE_COLLECTION);
    } catch (_) {}
  }

  private cacheKey(def: FetchEndpointDef, query?: string): string {
    if (def.method === 'GET' && query) {
      const params = new URLSearchParams(query);
      params.delete('_');
      const sorted = [...params.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      return `${def.path}?${new URLSearchParams(sorted).toString()}`;
    }
    return def.path;
  }

  private async save(def: FetchEndpointDef, query: string | undefined, data: any): Promise<void> {
    const key = this.cacheKey(def, query);
    await this.connection.collection(CACHE_COLLECTION).updateOne(
      { key },
      { $set: { key, path: def.path, method: def.method, response: data, fetchedAt: new Date() } },
      { upsert: true },
    );
  }

  /**
   * Fetch from parser server and cache. Throws on failure.
   * POST body is always {} when calling parser server to avoid "9 is not valid JSON" (parser ignores body).
   */
  private async fetch(def: FetchEndpointDef, query?: string): Promise<any> {
    const effectiveQuery = query ?? def.getDefaultQuery?.(this);
    const fullUrl = effectiveQuery
      ? `${DATA_PARSER_SERVER_URL}${def.path}?${effectiveQuery}`
      : `${DATA_PARSER_SERVER_URL}${def.path}`;
    const opts: any = {
      timeout: 30000,
      headers: { 'User-Agent': 'Stra188-Fetch/1', Accept: 'application/json, */*' },
    };
    if (def.method === 'POST') opts.headers['Content-Type'] = 'application/json';
    const body = def.method === 'POST' ? {} : undefined;
    const res =
      def.method === 'GET'
        ? await axios.get(fullUrl, opts)
        : await axios.post(`${DATA_PARSER_SERVER_URL}${def.path}`, body, opts);
    await this.save(def, effectiveQuery, res.data);
    return res.data;
  }

  /**
   * Get data: from cache, or fetch from parser server and cache. Returns empty on error (never throws).
   * Desktop menu path returns { Next: 30, Data: [] } on empty/error.
   */
  async getCached(def: FetchEndpointDef, query?: string): Promise<any> {
    const effectiveQuery = query ?? def.getDefaultQuery?.(this);
    const key = this.cacheKey(def, effectiveQuery);
    const doc = await this.connection.collection(CACHE_COLLECTION).findOne({ key });
    if (doc?.response != null) return doc.response;
    try {
      const data = await this.fetch(def, effectiveQuery);
      return data ?? (def.path === '/api/menu/desktopMenu' ? EMPTY_DESKTOP : {});
    } catch (err: any) {
      console.error(`[Stra188Fetch] ${def.path}: ${err?.message}`);
      return def.path === '/api/menu/desktopMenu' ? EMPTY_DESKTOP : {};
    }
  }

  buildGetTopMessageQuery(): string {
    const userName = process.env.STRA188_GET_TOP_MESSAGE_USERNAME ?? '568WinSWINH01S42310';
    return new URLSearchParams({
      UserName: userName,
      IsNewEu: 'false',
      IsFirstLoad: 'false',
      _: String(Date.now()),
    }).toString();
  }

  async pollEndpoint(def: FetchEndpointDef, query?: string): Promise<void> {
    try {
      const q = query ?? def.getDefaultQuery?.(this);
      await this.fetch(def, q);
      console.log(`[Stra188Fetch] Polled ${def.path}`);
    } catch (err: any) {
      console.error(`[Stra188Fetch] Poll failed ${def.path}: ${err?.message}`);
    }
  }

  async pollAll(): Promise<void> {
    for (const def of FETCH_ENDPOINTS) {
      if (def.pollIntervalMs != null || def.cronSchedule) await this.pollEndpoint(def);
    }
  }

  getEndpoints(): FetchEndpointDef[] {
    return FETCH_ENDPOINTS;
  }

  getStatus(): { stra188Ready: boolean; hint: string | null } {
    return { stra188Ready: !!DATA_PARSER_SERVER_URL, hint: null };
  }

  async getMarketGroups(filters?: { mode?: string; sportType?: number; betTypeGroup?: string }) {
    const res = await this.getCached(desktopMenu);
    if (!res?.Data) return [];
    let items = res.Data;
    if (filters?.mode) items = items.filter((g: any) => g.Mode === filters.mode);
    if (filters?.sportType != null) items = items.filter((g: any) => g.SportType === filters.sportType);
    if (filters?.betTypeGroup) items = items.filter((g: any) => g.BetTypeGroup === filters.betTypeGroup);
    return items.sort((a: any, b: any) => (b.Count ?? 0) - (a.Count ?? 0));
  }
}

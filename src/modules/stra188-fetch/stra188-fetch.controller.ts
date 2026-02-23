import { Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from 'src/security/decorators/public.decorator';
import { Stra188FetchService } from './stra188-fetch.service';
import { FETCH_ENDPOINTS } from './stra188-fetch.config';

/**
 * Stra188 fetch API – endpoints match original server paths exactly
 * so clients can switch base URL with minimal code change.
 */
@Controller()
export class Stra188FetchController {
  constructor(private readonly stra188FetchService: Stra188FetchService) {}

  @Get('stra188-fetch/status')
  @Public()
  getStatus() {
    return this.stra188FetchService.getStatus();
  }

  @Post('stra188-fetch/refresh')
  @Public()
  async refresh() {
    await this.stra188FetchService.pollAll();
    return { success: true };
  }

  @Get('stra188-fetch/market-groups')
  @Public()
  async getMarketGroups(
    @Req() req: Request,
  ) {
    const mode = req.query?.mode as string | undefined;
    const sportType = req.query?.sportType != null ? parseInt(String(req.query.sportType)) : undefined;
    const betTypeGroup = req.query?.betTypeGroup as string | undefined;
    const items = await this.stra188FetchService.getMarketGroups({ mode, sportType, betTypeGroup });
    return { Body: items, Count: items.length };
  }

  private getQuery(req: Request): string | undefined {
    const idx = req.url?.indexOf('?');
    return idx >= 0 ? req.url.slice(idx + 1) : undefined;
  }

  @Get('/NewIndex/GetAppConfig')
  @Public()
  async getAppConfig(@Req() req: Request) {
    return this.handle('/NewIndex/GetAppConfig', req);
  }

  @Get('/NewIndex/GetLabel')
  @Public()
  async getLabel(@Req() req: Request) {
    return this.handle('/NewIndex/GetLabel', req);
  }

  @Get('/api/Config/GetSettings')
  @Public()
  async getSettings(@Req() req: Request) {
    return this.handle('/api/Config/GetSettings', req);
  }

  @Get('/Config/GetSettings')
  @Public()
  async getSettingsNoApi(@Req() req: Request) {
    return this.handle('/api/Config/GetSettings', req);
  }

  @Post('/JSResourceApi/GetJSResource')
  @Public()
  async getJSResource(@Req() req: Request) {
    return this.handle('/JSResourceApi/GetJSResource', req);
  }

  @Get('/api/Casino/CasinoRoyaleStatusV3')
  @Public()
  async casinoRoyaleStatusV3(@Req() req: Request) {
    return this.handle('/api/Casino/CasinoRoyaleStatusV3', req);
  }

  @Get('/Casino/CasinoRoyaleStatusV3')
  @Public()
  async casinoRoyaleStatusV3NoApi(@Req() req: Request) {
    return this.handle('/api/Casino/CasinoRoyaleStatusV3', req);
  }

  @Get('/api/Message/GetTopMessage')
  @Public()
  async getTopMessage(@Req() req: Request) {
    return this.handle('/api/Message/GetTopMessage', req);
  }

  @Get('/Message/GetTopMessage')
  @Public()
  async getTopMessageNoApi(@Req() req: Request) {
    return this.handle('/api/Message/GetTopMessage', req);
  }

  @Post('/api/SpreadSetting/GetMoneyLineMappingOddsList')
  @Public()
  async getMoneyLineMappingOddsList(@Req() req: Request) {
    return this.handle('/api/SpreadSetting/GetMoneyLineMappingOddsList', req);
  }

  @Post('/SpreadSetting/GetMoneyLineMappingOddsList')
  @Public()
  async getMoneyLineMappingOddsListNoApi(@Req() req: Request) {
    return this.handle('/api/SpreadSetting/GetMoneyLineMappingOddsList', req);
  }

  @Post('/api/menu/desktopMenu')
  @Public()
  async desktopMenu(@Req() req: Request) {
    return this.handle('/api/menu/desktopMenu', req);
  }

  @Post('/menu/desktopMenu')
  @Public()
  async desktopMenuNoApi(@Req() req: Request) {
    return this.handle('/api/menu/desktopMenu', req);
  }

  private async handle(path: string, req: Request) {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const endpoint = FETCH_ENDPOINTS.find((e) => e.path === normalized);
    if (!endpoint) return {};
    return await this.stra188FetchService.getCached(endpoint, this.getQuery(req));
  }
}

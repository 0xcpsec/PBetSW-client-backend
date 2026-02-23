import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  GetBalanceBodyDto,
  DeductBodyDto,
  SettleBodyDto,
  RollbackBodyDto,
  CancelBodyDto,
  GetTicketsBodyDto,
  ProcessBetBodyDto,
} from 'src/dto';

const CHANNEL_REGISTRY_COLLECTION = 'stra188_channel_registry';
const BETS_COLLECTION = 'stra188_bets';

/** Bet status: waiting (before deduct) → running (after deduct). Later: won | lost | void | refunded when settled. */

/** BetType + BetTeam → odds document field name for DisplayOdds. */
const ODDS_FIELD_BY_BETTYPE_BETTEAM: Record<string, string> = {
  '1_h': 'odds1a', '1_a': 'odds2a',
  '2_h': 'odds1a', '2_a': 'odds2a',
  '3_h': 'odds1a', '3_a': 'odds2a',
  '5_1': 'com1', '5_2': 'com2', '5_x': 'comx',
  '7_h': 'odds1a', '7_a': 'odds2a',
  '8_h': 'odds1a', '8_a': 'odds2a',
  '12_h': 'odds1a', '12_a': 'odds2a',
  '15_1': 'com1', '15_2': 'com2', '15_x': 'comx',
  '6_0-1': 'cs00', '6_2-3': 'cs01', '6_4-6': 'cs10', '6_7-over': 'cs11',
  '14_0:0': 'cs00', '14_1:1': 'cs11', '14_1:2': 'cs12', '14_2:1': 'cs21', '14_2:2': 'cs22',
  '16_0:0': 'cs00', '16_0:1': 'cs01', '16_0:2': 'cs02', '16_1:0': 'cs10', '16_1:1': 'cs11', '16_1:2': 'cs12', '16_2:0': 'cs20', '16_2:1': 'cs21', '16_2:2': 'cs22',
  '126_0-1': 'cs00', '126_2-3': 'cs01', '126_4-over': 'cs10',
  '127_0:0': 'cs00', '127_1:1': 'cs11', '127_1:2': 'cs12', '127_2:1': 'cs21', '127_2:2': 'cs22',
  '128_oo': 'cs11', '128_oe': 'cs12', '128_eo': 'cs21', '128_ee': 'cs22',
  '413_0:0': 'cs00', '413_0:1': 'cs01', '413_0:2': 'cs02', '413_0:3': 'cs03', '413_0:4': 'cs04',
  '413_1:0': 'cs10', '413_1:1': 'cs11', '413_1:2': 'cs12', '413_1:3': 'cs13', '413_1:4': 'cs14',
  '413_2:0': 'cs20', '413_2:1': 'cs21', '413_2:2': 'cs22', '413_2:3': 'cs23', '413_2:4': 'cs24',
  '413_3:0': 'cs30', '413_3:1': 'cs31', '413_3:2': 'cs32', '413_3:3': 'cs33', '413_3:4': 'cs34',
  '413_4:0': 'cs40', '413_4:1': 'cs41', '413_4:2': 'cs42', '413_4:3': 'cs43', '413_4:4': 'cs44',
  '413_aos': 'cs99',
};

function getOddsFieldName(betType: unknown, betTeam: unknown): string | null {
  if (betType == null) return null;
  const k = `${String(betType).trim()}_${String(betTeam ?? '').trim().toLowerCase()}`;
  return ODDS_FIELD_BY_BETTYPE_BETTEAM[k] ?? null;
}

function channelCollectionPrefix(channelId: string): string {
  const safe = String(channelId).replace(/[^a-zA-Z0-9_]/g, '_');
  return `ch_${safe}`;
}

@Injectable()
export class BettingService {
  private readonly client: AxiosInstance;
  private readonly basePath = 'pbetsw';

  constructor(
    private readonly config: ConfigService,
    @InjectConnection() private readonly connection: Connection,
  ) {
    const baseURL = this.config.get<string>('ADMIN_BACKEND_URL');
    if (!baseURL) {
      throw new Error('ADMIN_BACKEND_URL is required in .env');
    }
    this.client = axios.create({
      baseURL: baseURL.replace(/\/$/, ''),
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /** Normalize ItemList from array or object (form-encoded 0, 1, 2...) to a single array. */
  private normalizeItemList(raw: unknown): Record<string, unknown>[] {
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw as Record<string, unknown>[];
    if (typeof raw === 'object') {
      return Object.keys(raw)
        .filter((k) => /^\d+$/.test(k))
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => (raw as Record<string, unknown>)[k] as Record<string, unknown>);
    }
    return [];
  }

  /** Strip "Bearer " prefix so admin always receives raw token (query param). */
  private normalizeToken(token: string): string {
    if (!token || typeof token !== 'string') return token;
    const t = token.trim();
    if (t.toLowerCase().startsWith('bearer ')) return t.slice(7).trim();
    return t;
  }

  private post<T>(path: string, token: string, body: object): Promise<T> {
    const rawToken = this.normalizeToken(token);
    return this.client
      .post<T>(path, body, { params: { token: rawToken } })
      .then((res) => res.data);
  }

  async getBalance(
    token: string,
    body: GetBalanceBodyDto,
  ): Promise<unknown> {
    return this.post(`${this.basePath}/GetBalance`, token, body);
  }

  async deduct(token: string, body: DeductBodyDto): Promise<unknown> {
    return this.post(`${this.basePath}/Deduct`, token, body);
  }

  async settle(token: string, body: SettleBodyDto): Promise<unknown> {
    return this.post(`${this.basePath}/Settle`, token, body);
  }

  async rollback(token: string, body: RollbackBodyDto): Promise<unknown> {
    return this.post(`${this.basePath}/Rollback`, token, body);
  }

  async cancel(token: string, body: CancelBodyDto): Promise<unknown> {
    return this.post(`${this.basePath}/Cancel`, token, body);
  }

  async getTickets(
    token: string,
    body: GetTicketsBodyDto,
  ): Promise<unknown> {
    const payload: Record<string, unknown> = { ...body };
    const itemList = this.normalizeItemList(payload.ItemList);
    payload.ItemList = itemList;

    const fromDb = await this.getTicketsFromChannelOdds(itemList, body.lastReq);
    if (fromDb != null) return fromDb;

    return this.post(`${this.basePath}/GetTickets`, token, payload);
  }

  async processBet(
    token: string,
    body: ProcessBetBodyDto,
  ): Promise<unknown> {
    if (!token || String(token).trim() === '') {
      throw new HttpException(
        { message: 'token is required (query ?token= or body token)' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const itemList = this.normalizeItemList(body.ItemList);

    const totalStake = itemList.reduce((sum, item) => {
      const s = item.Stake;
      const n = typeof s === 'number' ? s : s != null && s !== '' ? Number(s) : 0;
      return sum + (Number.isNaN(n) ? 0 : n);
    }, 0);

    const transferCode = crypto.randomUUID?.() ?? `bet-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const betTime = new Date().toISOString();

    const betRecord = {
      transferCode,
      transactionId: transferCode,
      licUserName: body.LicUserName,
      itemList,
      totalStake,
      oddsType: body.OddsType,
      webSkinType: body.WebSkinType,
      status: 'waiting',
      createdAt: new Date(),
      deductRequestedAt: null as Date | null,
      deductResponse: null as unknown,
      deductError: null as string | null,
    };

    const betsColl = this.connection.collection(BETS_COLLECTION);
    await betsColl.insertOne(betRecord);

    const productType = 1;
    const gameType = (itemList[0]?.Gameid != null ? Number(itemList[0].Gameid) : null) ?? 1;

    const deductBody: DeductBodyDto = {
      amount: totalStake,
      transferCode,
      transactionId: transferCode,
      betInfo: itemList,
      betTime,
      productType,
      gameType,
    };

    try {
      const deductResult = await this.deduct(token, deductBody);
      const deductData = deductResult as Record<string, unknown> | null;
      const dataObj = deductData?.data ?? deductData?.Data ?? deductData;
      const dataRecord = (typeof dataObj === 'object' && dataObj !== null ? dataObj : {}) as Record<string, unknown>;
      const balanceVal = deductData?.balance ?? deductData?.Balance ?? deductData?.finalBalance ?? deductData?.FinalBalance
        ?? dataRecord?.balance ?? dataRecord?.Balance ?? dataRecord?.finalBalance ?? dataRecord?.FinalBalance;
      const finalBalance = balanceVal != null ? String(balanceVal) : '';

      const dataItemList = itemList.map((item) =>
        this.buildProcessBetDataItem(item, transferCode, finalBalance),
      );

      const response = {
        ErrorCode: 0,
        Data: {
          ItemList: dataItemList,
          ErrorMsg: null,
          Common: null,
        },
      };

      await betsColl.updateOne(
        { transferCode },
        {
          $set: {
            status: 'running',
            deductRequestedAt: new Date(),
            deductResponse: deductResult,
            deductError: null,
          },
        },
      );
      return response;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const axiosErr = err as AxiosError<{ message?: string; error?: string; statusCode?: number }>;
      const adminStatus = axiosErr.response?.status;
      const adminData = axiosErr.response?.data;
      console.error(
        `[Betting] Admin Deduct failed: status=${adminStatus} transferCode=${transferCode}`,
      );
      console.error('[Betting] Deduct request body we sent:', JSON.stringify(deductBody));
      console.error('[Betting] Admin response:', JSON.stringify(adminData ?? axiosErr.message));

      await betsColl.updateOne(
        { transferCode },
        {
          $set: {
            status: 'deduct_failed',
            deductRequestedAt: new Date(),
            deductError: errMsg,
            deductResponse: adminData ?? null,
          },
        },
      );

      if (axiosErr.response != null) {
        const status = adminStatus && adminStatus >= 400 && adminStatus < 600 ? adminStatus : HttpStatus.BAD_GATEWAY;
        const message = typeof adminData === 'object' && adminData !== null
          ? (adminData.message ?? adminData.error ?? errMsg)
          : (adminData ?? errMsg) as string;
        throw new HttpException(
          { message, adminResponse: adminData, transferCode },
          status,
        );
      }
      throw err;
    }
  }

  /**
   * Build one ItemList entry for ProcessBet response (after deduct succeeds).
   */
  private buildProcessBetDataItem(
    item: Record<string, unknown>,
    transferCode: string,
    finalBalance: string,
  ): Record<string, unknown> {
    const oddsid = item.Oddsid != null ? Number(item.Oddsid) : 0;
    const betteam = item.Betteam != null ? String(item.Betteam) : '';
    const key = `${oddsid}_${betteam}`;
    const stake = item.Stake != null && item.Stake !== '' ? String(item.Stake) : '0';
    const stakeNum = Number(stake) || 0;
    const odds = item.Odds != null ? Number(item.Odds) : 0;
    const hdp1 = item.Hdp1 != null ? Number(item.Hdp1) : 0;
    const hdp2 = item.Hdp2 != null ? Number(item.Hdp2) : 0;

    return {
      Key: key,
      OddsId: oddsid,
      DisplayOdds: odds !== 0 ? String(odds) : '',
      OddsBeforeOddsBoost: '',
      OddsBoost: '',
      MRPercentage: 0,
      DisplayHDP: hdp1 !== 0 || hdp2 !== 0 ? String(hdp1) : '',
      Hdp1: hdp1,
      Hdp2: hdp2,
      OddsInfo: '',
      sinfo: (item.sinfo != null ? String(item.sinfo) : '') || '',
      SrcOddsInfo: item.SrcOddsInfo != null ? String(item.SrcOddsInfo) : '',
      SrcOdds: odds,
      BetID: '',
      LeagueGroupId: 4,
      BetTeam: betteam,
      ChoiceValue: item.ChoiceValue != null ? String(item.ChoiceValue) : '',
      TransId_Cash: transferCode,
      TransId_Bonus: '0',
      Code: 1,
      Message: 'Đơn cược đã được chấp nhận.',
      isOddsChange: false,
      isLineChange: false,
      isScoreChange: false,
      Stake: stake,
      Stake_Cash: stakeNum.toFixed(2),
      Stake_Bonus: null,
      ActualStake_Cash: stakeNum.toFixed(2),
      ActualStake_Bonus: null,
      LiveHomeScore: item.Hscore != null ? Number(item.Hscore) : 0,
      LiveAwayScore: item.Ascore != null ? Number(item.Ascore) : 0,
      TicketStatus: 1,
      IsInPlay: item.IsInPlay === true || item.IsInPlay === 'true',
      IsLive: true,
      PriceType: 0,
      TotalPerBet: 0,
      FinalBalance: finalBalance || '0.00',
      AdjustedMaxBet: 34059,
      CheckWaitingTicket: false,
      BetDelaySec: 8,
      ErrorCode: 0,
      TicketJson: null,
      BetRecommendation: [],
      BetRecommends: null,
      Common: { ErrorCode: 0, ErrorMsg: 'Success' },
      ACCode: null,
      OddsType: item.OddsType != null ? Number(item.OddsType) : 4,
      IsLuckyDrawBet: false,
    };
  }

  /**
   * GetLiveScoreAndTimer: for each matchId in the payload, find the first match in any registered
   * channel's ch_*_matches (same pattern as odds lookup: return on first channel that has it).
   */
  async getLiveScoreAndTimer(
    matchIdsPayload: unknown,
  ): Promise<{ ErrorCode: number; ErrorMessages: string; Data: Record<string, unknown>[] }> {
    const matchIds = this.normalizeMatchIdArray(matchIdsPayload);
    if (matchIds.length === 0) {
      return { ErrorCode: 0, ErrorMessages: 'Success', Data: [] };
    }

    const stableIds = await this.getStableIds();

    const data: Record<string, unknown>[] = [];
    for (const matchId of matchIds) {
      let match: Record<string, unknown> | null = null;
      for (const stableId of stableIds) {
        const prefix = channelCollectionPrefix(stableId);
        const matchesColl = this.connection.collection(prefix + '_matches');
        const doc = (await matchesColl.findOne({
          matchid: matchId,
          _removedAt: { $exists: false },
        })) as Record<string, unknown> | null;
        if (doc) {
          match = doc;
          break;
        }
      }
      data.push(this.buildLiveScoreAndTimerEntry(matchId, match));
    }

    return { ErrorCode: 0, ErrorMessages: 'Success', Data: data };
  }

  private normalizeMatchIdArray(payload: unknown): number[] {
    if (Array.isArray(payload)) {
      return payload
        .map((v) => (v != null && v !== '' ? Number(v) : NaN))
        .filter((n) => !Number.isNaN(n));
    }
    if (payload != null && payload !== '') {
      const n = Number(payload);
      if (!Number.isNaN(n)) return [n];
    }
    return [];
  }

  private buildLiveScoreAndTimerEntry(
    matchId: number,
    match: Record<string, unknown> | null,
  ): Record<string, unknown> {
    return {
      sportType: match?.sporttype ?? match?.sportType ?? 1,
      matchId,
      liveHomeScore: match?.livehomescore,
      liveAwayScore: match?.liveawayscore,
      hls: match?.hls ?? 0,
      llp: match?.llp ?? 0,
      timerSuspend: match?.timerSuspend ?? false,
      timeStatus: match?.timeStatus ?? 0,
      gameStatus: match?.gameStatus ?? 0,
      delayLive: match?.delayLive ?? false,
      displayShowTime: match?.displayShowTime ?? 'Ref_htime',
      isCountDownTimer: match?.isCountDownTimer ?? false,
      livePeriod: match?.livePeriod ?? 0,
      sessionTime: match?.sessionTime ?? null,
      liveTimer: match?.liveTimer ?? null,
      pausePeriod: match?.pausePeriod ?? null,
    };
  }

  /**
   * BetListMini: return recent running bets (balance already deducted) as Tickets.
   * Status flow: waiting → running (after deduct). Later: won | lost | void | refunded when settled.
   */
  async getBetListMini(licUserName?: string): Promise<{ ErrorCode: number; Data: { Tickets: unknown[] } }> {
    const betsColl = this.connection.collection(BETS_COLLECTION);
    const filter: Record<string, unknown> = { status: 'running' };
    if (licUserName != null && String(licUserName).trim() !== '') {
      filter.licUserName = String(licUserName).trim();
    }
    const bets = await betsColl
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    const tickets = (bets as Record<string, unknown>[]).map((bet) => this.betRecordToTicket(bet));
    return { ErrorCode: 0, Data: { Tickets: tickets } };
  }

  private betRecordToTicket(bet: Record<string, unknown>): Record<string, unknown> {
    const itemList = (bet.itemList as Record<string, unknown>[]) ?? [];
    const first = itemList[0] ?? {};
    const transferCodeStr = String(bet.transferCode ?? '');
    const totalStake = Number(bet.totalStake) ?? 0;
    const createdAt = bet.createdAt instanceof Date ? bet.createdAt : new Date();

    const choiceDetails = itemList.map((item: Record<string, unknown>) => ({
      SportType: '1',
      SportName: 'Bóng đá /',
      BetTypeName: 'Tài/Xỉu',
      BetType: item.Bettype != null ? String(item.Bettype) : '3',
      HomeName: item.Home != null ? String(item.Home) : '',
      AwayName: item.Away != null ? String(item.Away) : '',
      Choice: item.ChoiceValue != null ? String(item.ChoiceValue) : '',
      Hdp2_1: item.Line != null ? String(item.Line) : (item.Hdp1 != null ? String(item.Hdp1) : ''),
      MRPercentage: '',
      LiveScore: `[${item.Hscore}-${item.Ascore}]`,
      LeagueName: '',
      OddsInfo: '',
      OddsInfo_HT: '',
      OddsInfo_FT: '',
      MixParlayOdds: '',
      MixParlayStatusId: '',
      MixParlayStatus: '',
      GlobalShowTime: '',
      MatchId: item.Matchid != null ? String(item.Matchid) : '',
      HasScoreMap: true,
      Extension1: '',
      Extension3: '',
      LegueGroupId: 4,
      TriggerMatchId: item.Matchid != null ? String(item.Matchid) : '',
      HashCode: '',
      LiveStatus: 'Trực tiếp',
      OriginLiveScore: `[${item.Hscore}-${item.Ascore}]`,
      Liveindicator: true,
    }));

    const odds = first.Odds != null ? String(first.Odds) : '0';
    const hdp1 = first.Hdp1 != null ? Number(first.Hdp1) : 0;
    const hdp2 = first.Hdp2 != null ? Number(first.Hdp2) : 0;

    return {
      BetDaqID: null,
      TransId: transferCodeStr,
      TxID: `TxID:4252700_${transferCodeStr.slice(0, 8)}`,
      choiceDetails,
      Odds: odds,
      Stake: String(totalStake),
      Status: 'running',
      IsParlay: itemList.length > 1,
      IsCashOut: false,
      BetTeam: first.Betteam != null ? String(first.Betteam) : 'a',
      Hdp1: hdp1,
      Hdp2: hdp2,
      SportType: 1,
      IsBetBuilder: false,
      OrgStake: '',
      RefNo: '',
      MixParlayBetTypeName: '',
      AutoAcceptSec: 0,
      HasBonus: false,
      HasRebate: false,
      HasPromotion: false,
      Discount: null,
      ComboList: [],
      BonusList: [],
      SelectionList: [],
      HashCode: '',
      TransDate: createdAt.toLocaleString('en-US', { timeZone: 'UTC' }),
      OddsType: String(bet.oddsType ?? 4),
      CashOutStatus: 1,
      CashOutPrice: totalStake * 0.9,
      GoalLine: hdp1,
      Margin: 1,
      OddsId: first.Oddsid != null ? Number(first.Oddsid) : 0,
      winProb: 0,
      winProbId: 0,
      CashOutHashCode: '',
      BetId: '',
      PbHasLiveScore: false,
      LiveHomeScore: null,
      LiveAwayScore: null,
      ParentMatchId: null,
      CanDelete: false,
      BetCheck: null,
      RewardVoucherInfo: null,
      Spread: '0.14',
      IsLuckyDrawWinnerTicket: false,
      IsLuckyDrawEligibility: false,
      IsBetBuilderPlus: false,
      BetBuilderPlusMOdds: 0,
      BetBuilderPlusOdds: null,
      BetBuilderPlusInfoModel: { OddsOrig: 0, Odds: 0, LegOdds: null },
    };
  }

  /**
   * Load channel registry from DB, then search ch_*_odds for each ItemList entry by oddsid and bettype.
   * If all items are found, build and return GetTickets response from DB; otherwise return null (caller will proxy).
   */
  /** Non-spread channel stableIds from registry (for odds/matches lookups). */
  private async getStableIds(): Promise<string[]> {
    const registryColl = this.connection.collection(CHANNEL_REGISTRY_COLLECTION);
    const channels = (await registryColl
      .find({ type: { $ne: 'spread' } }, { projection: { stableId: 1 } })
      .toArray()) as { stableId?: string }[];
    return channels.map((c) => c.stableId).filter((id): id is string => id != null);
  }

  private async getTicketsFromChannelOdds(
    itemList: Record<string, unknown>[],
    lastReq: number,
  ): Promise<{ ErrorCode: number; Serial: string; Data: unknown[] } | null> {
    if (itemList.length === 0) return null;

    const stableIds = await this.getStableIds();

    const data: unknown[] = [];
    for (const item of itemList) {
      const oddsid = item.Oddsid != null ? Number(item.Oddsid) : undefined;
      const bettype = item.Bettype != null ? Number(item.Bettype) : item.Bettype;
      const matchid = item.Matchid != null ? Number(item.Matchid) : undefined;
      if (oddsid === undefined && bettype === undefined) continue;

      const filter: Record<string, unknown> = {
        _removedAt: { $exists: false },
      };
      if (oddsid !== undefined) filter.oddsid = oddsid;
      if (bettype !== undefined) filter.bettype = bettype;
      if (matchid !== undefined) filter.matchid = matchid;

      let found: { odds: Record<string, unknown>; match: Record<string, unknown> | null; stableId: string } | null = null;
      for (const stableId of stableIds) {
        const prefix = channelCollectionPrefix(stableId);
        const oddsColl = this.connection.collection(prefix + '_odds');
        const oddsDoc = (await oddsColl.findOne(filter)) as Record<string, unknown> | null;
        if (!oddsDoc) continue;

        const oddsMatchId = oddsDoc.matchid != null ? Number(oddsDoc.matchid) : matchid ?? null;
        let match: Record<string, unknown> | null = null;
        if (oddsMatchId != null) {
          const matchesColl = this.connection.collection(prefix + '_matches');
          match = (await matchesColl.findOne({ matchid: oddsMatchId, _removedAt: { $exists: false } })) as Record<string, unknown> | null;
          if (!match) continue;
        }

        found = { odds: oddsDoc, match, stableId };
        break;
      }
      if (!found) return null;

      const ticket = await this.buildTicketFromOddsAndMatch(
        found.odds,
        found.match,
        found.stableId,
        item,
      );
      data.push(ticket);
    }

    return {
      ErrorCode: 0,
      Serial: String(lastReq),
      Data: data,
    };
  }

  private async buildTicketFromOddsAndMatch(
    odds: Record<string, unknown>,
    match: Record<string, unknown> | null,
    stableId: string,
    requestItem: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const prefix = channelCollectionPrefix(stableId);
    const matchid = odds.matchid != null ? Number(odds.matchid) : null;
    let league: Record<string, unknown> | null = null;

    if (match != null) {
      const leagueid = match.leagueid ?? match.leagueId;
      if (leagueid != null) {
        const leaguesColl = this.connection.collection(prefix + '_leagues');
        league = (await leaguesColl.findOne({ leagueid: Number(leagueid), _removedAt: { $exists: false } })) as Record<string, unknown> | null;
      }
    }

    const betType = requestItem.Bettype ?? odds.bettype;
    const betTeam = requestItem.Betteam ?? odds.betteam;
    const oddsFieldName = getOddsFieldName(betType, betTeam);
    const dbOddsRaw = oddsFieldName != null ? odds[oddsFieldName] : undefined;
    const dbOddsVal = dbOddsRaw != null && dbOddsRaw !== '' ? Number(dbOddsRaw) : (odds.odds ?? odds.Odds ?? odds.price);
    const displayOddsStr = dbOddsVal != null && !Number.isNaN(Number(dbOddsVal)) ? String(Number(dbOddsVal)) : (odds.odds != null ? String(Number(odds.odds)) : '0');

    const requestOdds = requestItem.Odds;
    const requestOddsStr = requestOdds != null && requestOdds !== '' ? String(Number(requestOdds)) : null;
    const oddsChanged = requestOddsStr != null && requestOddsStr !== displayOddsStr;
    const message = oddsChanged
      ? `Tỷ lệ cược đã thay đổi từ ${requestOddsStr} thành ${displayOddsStr}.`
      : (odds.message ?? odds.Message ?? null);

    const oddsVal = dbOddsVal ?? odds.odds ?? odds.Odds ?? odds.price;
    const oddsNum = oddsVal != null ? Number(oddsVal) : 0;
    const line = requestItem.Line ?? odds.line ?? 0;
    const lineNum = typeof line === 'number' ? line : Number(line) || 0;
    const hdp1 = odds.hdp1 ?? odds.Hdp1 ?? 0;
    const hdp2 = odds.hdp2 ?? odds.Hdp2 ?? 0;
    const hdp1Num = typeof hdp1 === 'number' ? hdp1 : Number(hdp1) || 0;
    const hdp2Num = typeof hdp2 === 'number' ? hdp2 : Number(hdp2) || 0;

    const homeName = match?.home ?? match?.Home ?? match?.homename ?? '';
    const awayName = match?.away ?? match?.Away ?? match?.awayname ?? '';
    const leagueName = league?.name ?? league?.Name ?? league?.leaguename ?? '';
    const displayTime = match?.displayTime ?? match?.DisplayTime ?? match?.matchTime ?? '';
    const isLive = (match?.kickofftime != null && Number(match?.kickofftime) <= Math.floor(Date.now() / 1000)) || false;
    const betStake = requestItem.Stake != null && requestItem.Stake !== '' ? String(requestItem.Stake) : '30';
    const minbet = odds.minbet ?? odds.Minbet ?? '30';
    const maxbet = odds.maxbet ?? odds.Maxbet ?? '54,495';
    const bettypeName = odds.bettypeName ?? odds.BettypeName ?? 'Tài/Xỉu';
    const oddsStatus = odds.oddsStatus ?? odds.status ?? odds.OddsStatus ?? 'running';
    const leagueId = league?.leagueid ?? league?.leagueId ?? 0;

    return {
      TicketType: requestItem.Type ?? odds.type ?? 'OU',
      Minbet: minbet != null ? String(minbet) : '30',
      Maxbet: maxbet != null ? String(maxbet) : '54,495',
      Bet: betStake,
      QuickBet: '1::::',
      SeqNo: 0,
      Line: lineNum,
      DisplayHDP: hdp1Num !== 0 || hdp2Num !== 0 ? String(lineNum) : null,
      Hdp1: hdp1Num,
      Hdp2: hdp2Num,
      DisplayOdds: displayOddsStr,
      DisplayOddsPair: odds.displayOddsPair ?? odds.DisplayOddsPair ?? null,
      SrcOdds: oddsNum,
      OddsBeforeOddsBoost: odds.oddsBeforeOddsBoost ?? odds.OddsBeforeOddsBoost ?? null,
      OddsBoost: odds.oddsBoost ?? odds.OddsBoost ?? null,
      sinfo: odds.sinfo ?? requestItem.sinfo ?? null,
      OddsID: odds.oddsid ?? requestItem.Oddsid,
      Betteam: requestItem.Betteam ?? odds.betteam ?? 'a',
      LiveScore: isLive === true,
      LiveHomeScore: requestItem.Hscore ?? match?.liveHomeScore ?? match?.homescore ?? 0,
      LiveAwayScore: requestItem.Ascore ?? match?.liveAwayScore ?? match?.awayscore ?? 0,
      SuggestStake: 0,
      RecommendType: 0,
      BetID: odds.betId ?? requestItem.BetID ?? null,
      ChoiceValue: requestItem.ChoiceValue ?? odds.choiceValue ?? '',
      BettypeName: bettypeName != null ? String(bettypeName) : 'Tài/Xỉu',
      HomeId: match?.homeid ?? match?.homeId ?? 0,
      AwayId: match?.awayid ?? match?.awayId ?? 0,
      HomeName: homeName,
      AwayName: awayName,
      LeagueName: leagueName,
      Bettype: String(requestItem.Bettype ?? odds.bettype ?? ''),
      ParentBetType: odds.parentBetType ?? odds.ParentBetType ?? 0,
      SportType: match?.sporttype ?? match?.sportType ?? 1,
      SportName: 'Bóng đá',
      GameName: '',
      IsLive: isLive === true,
      IsInPlay: requestItem.IsInPlay ?? false,
      Matchid: matchid ?? requestItem.Matchid,
      ParentMatchid: requestItem.parentMatchId ?? match?.parentMatchid ?? 0,
      MatchCode: match?.matchCode ?? match?.MatchCode ?? null,
      LeagueGroupId: league?.leagueGroupId ?? league?.group ?? 0,
      Code: odds.code ?? 0,
      ErrorCode: 0,
      Message: message,
      isOddsChange: oddsChanged || odds.isOddsChange === true,
      isLineChange: odds.isLineChange ?? false,
      isScoreChange: odds.isScoreChange ?? false,
      AutoAcceptSec: odds.autoAcceptSec ?? odds.AutoAcceptSec ?? null,
      MRPercentage: odds.mrPercentage ?? odds.MRPercentage ?? '',
      OddsInfo: odds.oddsInfo ?? odds.OddsInfo ?? null,
      SrcOddsInfo: odds.srcOddsInfo ?? odds.SrcOddsInfo ?? null,
      OddsStatus: oddsStatus != null ? String(oddsStatus) : 'running',
      UseBonus: 0,
      DisplayTime: displayTime != null ? String(displayTime) : null,
      HasParlay: odds.hasParlay ?? true,
      PriceType: 0,
      BonusID: 0,
      BonusType: 0,
      BetHintMsg: odds.betHintMsg ?? null,
      Common: {
        ErrorCode: odds.commonErrorCode ?? 0,
        ErrorMsg: odds.commonErrorMsg ?? null,
      },
      Nolan: false,
      Tenet: false,
      PDHyalpsiD: hdp1Num !== 0 || hdp2Num !== 0 ? String(lineNum) : null,
      sddOyalpsiD: odds.displayOddsPair ?? odds.DisplayOddsPair ?? null,
      riaPsddOyalpsiD: displayOddsStr,
      BetRecommends: odds.betRecommends ?? [],
      Guid: odds.guid ?? odds.Guid ?? null,
      TicketTime: odds.ticketTime ?? 0,
      IsOfferParlayBoost: false,
      OddsPair: odds.oddsPair ?? 0,
      LeagueId: leagueId != null ? Number(leagueId) : 0,
      LuckyDrawMinBet: odds.luckyDrawMinBet ?? null,
      BetTimeConstraint: odds.betTimeConstraint ?? match?.betTimeConstraint ?? null,
      OddsType: requestItem.OddsType != null ? Number(requestItem.OddsType) : 4,
      IsCashoutEnabled: odds.isCashoutEnabled ?? true,
      ScoreChallenge: odds.scoreChallenge ?? null,
    };
  }
}

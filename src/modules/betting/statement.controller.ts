import { Body, Controller, Post } from '@nestjs/common';
import { Public } from 'src/security/decorators/public.decorator';
import { BettingService } from './betting.service';

/** Optional body for BetListMini (form data: GMT, LicUserName, etc. – GMT ignored). */
interface BetListMiniBody {
  LicUserName?: string;
  GMT?: number | string;
  [key: string]: unknown;
}

@Controller('Statement')
export class StatementController {
  constructor(private readonly bettingService: BettingService) {}

  @Public()
  @Post('BetListMini')
  async betListMini(@Body() body: BetListMiniBody) {
    const licUserName = body?.LicUserName != null ? String(body.LicUserName).trim() : undefined;
    return this.bettingService.getBetListMini(licUserName);
  }

  @Public()
  @Post('VoidBetList')
  voidBetList() {
    return { ErrorCode: 0, Data: { Tickets: [] } };
  }

  @Public()
  @Post('WaitingBetList')
  waitingBetList() {
    return { ErrorCode: 0, Data: { Tickets: [] } };
  }
}

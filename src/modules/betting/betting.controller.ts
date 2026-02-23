import { Body, Controller, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from 'src/security/decorators/public.decorator';
import { BettingService } from './betting.service';
import {
  GetBalanceBodyDto,
  DeductBodyDto,
  SettleBodyDto,
  RollbackBodyDto,
  CancelBodyDto,
  GetTicketsBodyDto,
  ProcessBetBodyDto,
} from 'src/dto';

@Controller('Betting')
export class BettingController {
  constructor(private readonly bettingService: BettingService) {}

  @Public()
  @Post('GetBalance')
  async getBalance(
    @Query('token') token: string,
    @Body() body: GetBalanceBodyDto,
  ) {
    return this.bettingService.getBalance(token, body);
  }

  @Public()
  @Post('Deduct')
  async deduct(@Query('token') token: string, @Body() body: DeductBodyDto) {
    return this.bettingService.deduct(token, body);
  }

  @Public()
  @Post('Settle')
  async settle(@Query('token') token: string, @Body() body: SettleBodyDto) {
    return this.bettingService.settle(token, body);
  }

  @Public()
  @Post('Rollback')
  async rollback(
    @Query('token') token: string,
    @Body() body: RollbackBodyDto,
  ) {
    return this.bettingService.rollback(token, body);
  }

  @Public()
  @Post('Cancel')
  async cancel(@Query('token') token: string, @Body() body: CancelBodyDto) {
    return this.bettingService.cancel(token, body);
  }

  @Public()
  @Post('GetTickets')
  async getTickets(
    @Query('token') token: string,
    @Body() body: GetTicketsBodyDto,
  ) {
    return this.bettingService.getTickets(token, body);
  }

  @Public()
  @Post('ProcessBet')
  async processBet(@Req() req: Request, @Body() body: ProcessBetBodyDto) {
    const token = getTokenFromRequest(req, body);
    return this.bettingService.processBet(token, body);
  }
}

/** Read token from query, body, or Authorization header (same as client might send). */
function getTokenFromRequest(req: Request, body: ProcessBetBodyDto): string {
  const q = req.query as Record<string, string | undefined>;
  const fromQuery = q?.token ?? q?.Token;
  if (fromQuery && String(fromQuery).trim()) return String(fromQuery).trim();

  const b = body as unknown as Record<string, unknown>;
  const fromBody = b?.token ?? b?.Token;
  if (fromBody != null && String(fromBody).trim() !== '') return String(fromBody).trim();

  const auth = req.headers?.authorization;
  if (auth && typeof auth === 'string') {
    const v = auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth.trim();
    if (v) return v;
  }

  return '';
}

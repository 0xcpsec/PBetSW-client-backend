import { Body, Controller, Post } from '@nestjs/common';
import { Public } from 'src/security/decorators/public.decorator';
import { BettingService } from './betting.service';

@Controller('BetList')
export class BetListController {
  constructor(private readonly bettingService: BettingService) {}

  @Public()
  @Post('GetLiveScoreAndTimer')
  async getLiveScoreAndTimer(@Body() body: unknown) {
    return this.bettingService.getLiveScoreAndTimer(body);
  }
}

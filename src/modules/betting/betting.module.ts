import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BettingController } from './betting.controller';
import { BettingService } from './betting.service';
import { StatementController } from './statement.controller';
import { KafkaController } from './kafka.controller';
import { BetListController } from './betlist.controller';

@Module({
  imports: [ConfigModule],
  controllers: [BettingController, StatementController, KafkaController, BetListController],
  providers: [BettingService],
  exports: [BettingService],
})
export class BettingModule {}

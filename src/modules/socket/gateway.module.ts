import { Module, forwardRef } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { Stra188Module } from '../stra188/stra188.module';

@Module({
  imports: [forwardRef(() => Stra188Module)],
  controllers: [],
  providers: [GatewayService],
  exports: [GatewayService],
})
export class GatewayModule {}

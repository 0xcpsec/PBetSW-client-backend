import { Module } from '@nestjs/common';
import { ClientApiController } from './client-api.controller';

@Module({
  controllers: [ClientApiController],
})
export class ClientApiModule {}

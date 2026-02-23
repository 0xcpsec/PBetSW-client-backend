import { Module, NestModule, MiddlewareConsumer, RequestMethod, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { Stra188FetchService } from './stra188-fetch.service';
import { Stra188FetchScheduler } from './stra188-fetch.scheduler';
import { Stra188FetchMiddleware } from './stra188-fetch.middleware';
import { Stra188FetchController } from './stra188-fetch.controller';
import { Stra188Module } from '../stra188/stra188.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    forwardRef(() => Stra188Module),
  ],
  controllers: [Stra188FetchController],
  providers: [Stra188FetchService, Stra188FetchScheduler],
  exports: [Stra188FetchService],
})
export class Stra188FetchModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(Stra188FetchMiddleware)
      .forRoutes(
        { path: 'NewIndex*', method: RequestMethod.ALL },
        { path: 'api*', method: RequestMethod.ALL },
        { path: 'JSResourceApi*', method: RequestMethod.ALL },
        { path: 'licensee*', method: RequestMethod.ALL },
        { path: 'menu*', method: RequestMethod.ALL },
        { path: 'Config*', method: RequestMethod.ALL },
        { path: 'Casino*', method: RequestMethod.ALL },
        { path: 'Message*', method: RequestMethod.ALL },
        { path: 'SpreadSetting*', method: RequestMethod.ALL },
      );
  }
}

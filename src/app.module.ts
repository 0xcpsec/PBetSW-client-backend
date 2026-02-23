import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Stra188Module, Stra188FetchModule, BettingModule, ClientApiModule } from './modules';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017',
        dbName: process.env.MONGODB_DB_NAME ?? 'stra188_adapter_mirror',
      }),
    }),
    Stra188Module,
    Stra188FetchModule,
    BettingModule,
    ClientApiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

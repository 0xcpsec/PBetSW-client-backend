import { Module, forwardRef } from '@nestjs/common';
import { Stra188Service } from './stra188.service';
import { Stra188Controller } from './stra188.controller';
import { Stra188WebSocketService } from './stra188-websocket.service';
import { Stra188ChannelRegistryService } from './stra188-channel-registry.service';
import { GatewayModule } from '../socket/gateway.module';
import { Stra188FetchModule } from '../stra188-fetch/stra188-fetch.module';

@Module({
    imports: [
        forwardRef(() => GatewayModule),
        forwardRef(() => Stra188FetchModule),
    ],
    controllers: [Stra188Controller],
    providers: [Stra188ChannelRegistryService, Stra188Service, Stra188WebSocketService],
    exports: [Stra188ChannelRegistryService, Stra188Service, Stra188WebSocketService],
})
export class Stra188Module {}


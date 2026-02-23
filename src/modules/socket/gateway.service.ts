import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Stra188WebSocketService } from "../stra188/stra188-websocket.service";
import { Stra188ChannelRegistryService } from "../stra188/stra188-channel-registry.service";
import { resolveStableChannelId } from "../stra188/stra188-channel-registry";

@WebSocketGateway({
    cors: {
        origin: true,
        credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
})

@Injectable()
export class GatewayService {
    @WebSocketServer() server: Server;

    constructor(
        @Inject(forwardRef(() => Stra188WebSocketService)) private stra188WsService: Stra188WebSocketService,
        private readonly stra188ChannelRegistryService: Stra188ChannelRegistryService,
    ) {}

    afterInit(server: Server) {
        server.use(async (client: Socket, next: any) => {
            const query = client.handshake.query;
            if (query.gid || query.rid === 'jwt') {
                (client as any).mirrorParams = {
                    gid: query.gid,
                    token: query.token,
                    id: query.id,
                    rid: query.rid,
                };
                console.log(`[Mirror] Client connected: ${client.id}`);
                next();
                return;
            }
            console.log(`[Mirror] Rejecting non-mirror client: ${client.id}`);
            client.disconnect(true);
        });
    }

    async handleDisconnect(client: Socket) {
        this.clientSubscriptions.delete(client.id);
    }

    handleConnection(client: Socket, ...args: any[]) {
        console.log(`Client connected`, client.id);
    }

    @SubscribeMessage("heartbeat")
    heartbeat(client: Socket, data: any): void {
        client.emit("heartbeat", new Date().getTime());
    }

    private clientSubscriptions: Map<string, {
        stableChannelId: string;
        clientChannelId: string;
        serverChannelId: string;
        type: string;
        condition: any;
    }[]> = new Map();

    private serverChannelCounter = 0;

    private generateServerChannelId(): string {
        return `b${this.serverChannelCounter++}`;
    }

    private countSubscriptionsByType(subscriptions: { type: string }[]): Map<string, number> {
        const map = new Map<string, number>();
        for (const s of subscriptions) {
            const t = s.type || 'unknown';
            map.set(t, (map.get(t) ?? 0) + 1);
        }
        return map;
    }

    @SubscribeMessage("subscribe")
    async handleMirrorSubscribe(client: Socket, data: any): Promise<void> {
        try {
            if (!Array.isArray(data)) return;

            let groups: any[] =
                data.length >= 2 && Array.isArray(data[1]) && typeof data[0] === 'string'
                    ? [data]
                    : data;

            const typeOrder: Record<string, number> = { spread: 0, odds: 1, streaming: 2 };
            groups = [...groups].sort((a, b) => {
                const orderA = typeOrder[String(a?.[0])] ?? 3;
                const orderB = typeOrder[String(b?.[0])] ?? 3;
                return orderA - orderB;
            });

            const newSubscriptions: any[] = [];
            const newClientIds = new Set<string>();
            let autoId = 0;

            for (const group of groups) {
                if (!Array.isArray(group) || group.length < 2) continue;
                const type = String(group[0]);
                const items = group[1];
                if (!Array.isArray(items)) continue;

                for (const item of items) {
                    const clientChannelId = item?.id != null ? String(item.id) : `c_${Date.now()}_${autoId++}`;
                    const condition = item?.condition && typeof item.condition === 'object' ? item.condition : {};
                    const registry = this.stra188ChannelRegistryService.getRegistry();
                    let stableChannelId = resolveStableChannelId(registry, type, condition);
                    if (stableChannelId == null) {
                        try {
                            const newDef = await this.stra188ChannelRegistryService.resolveOrAddChannel(type, condition);
                            stableChannelId = newDef.stableId;
                            await this.stra188WsService.addChannelAndSubscribe(newDef);
                        } catch (err: any) {
                            console.error(`[Stra188:subscribe] Failed to add channel: ${err?.message}`);
                            continue;
                        }
                    }
                    const serverChannelId = this.generateServerChannelId();

                    newSubscriptions.push({
                        stableChannelId,
                        clientChannelId,
                        serverChannelId,
                        type,
                        condition,
                    });
                    newClientIds.add(clientChannelId);

                    if (condition.sporttype != null) {
                        client.join(`stra188_sport_${condition.sporttype}`);
                        if (condition.marketid != null) {
                            client.join(`stra188_s${condition.sporttype}_${condition.marketid}`);
                        }
                    }
                }
            }

            if (newSubscriptions.length > 0) {
                client.join('stra188_all');
            }

            const existing = this.clientSubscriptions.get(client.id) || [];
            const filtered = existing.filter((s) => !newClientIds.has(s.clientChannelId));
            this.clientSubscriptions.set(client.id, [...filtered, ...newSubscriptions]);

            const channelsRequested = newSubscriptions.length;
            const byType = this.countSubscriptionsByType(newSubscriptions);
            const typeSummary = [...byType.entries()].map(([t, n]) => `${t}:${n}`).join(', ');
            const stableIds = newSubscriptions.map((s) => s.stableChannelId).join(', ');
            const mapping = newSubscriptions.map((s) => `${s.clientChannelId}->${s.serverChannelId}`).join(', ');
            console.log(`[WS] subscribe client=${client.id} channels_requested=${channelsRequested} by_type={${typeSummary}} total=${filtered.length + newSubscriptions.length}`);
            console.log(`[Stra188:subscribe] client=${client.id} stableChannelIds=[${stableIds}] mapping=[${mapping}]`);
            const channelsReplied = await this.sendInitialDataForSubscriptions(client, newSubscriptions);
            console.log(`[WS] subscribe client=${client.id} channels_replied=${channelsReplied}/${channelsRequested}`);
        } catch (error: any) {
            console.error(`[WS] subscribe error: ${error.message}`);
            client.emit('err', { message: error.message });
        }
    }

    private generateChannelMappingIds(): [string, string] {
        const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)))
            .map(b => b.toString(16).padStart(2, '0')).join('');
        return [
            `${hex(8)}-${hex(2)}`,
            `${hex(16)}-${hex(8)}`,
        ];
    }

    private static readonly SPREAD_MESSAGE = [
        ['f', 0, ['type', 'siteid', '$', 'isPeakHour', 'applydepspread']],
        [0, 'reset'],
        [0, 15, 1, '4252700', 4, 1],
        [0, 14, 3, false, 2, '0Q'],
    ];

    private async sendInitialDataForSubscriptions(client: Socket, subscriptions: any[]): Promise<number> {
        let replied = 0;
        for (const sub of subscriptions) {
            const { type, serverChannelId, clientChannelId, stableChannelId } = sub;
            if (type === 'spread') {
                this.sendSpreadSnapshot(client, clientChannelId, serverChannelId);
                replied++;
            } else if (type === 'odds' || type === 'streaming') {
                const sent = await this.sendChannelSnapshot(client, clientChannelId, serverChannelId, stableChannelId);
                if (sent) replied++;
            }
        }
        return replied;
    }

    private sendSpreadSnapshot(client: Socket, clientChannelId: string, serverChannelId: string) {
        const [id1, id2] = this.generateChannelMappingIds();
        const cLine: any[] = ['c', clientChannelId, id1, id2];
        const fullMessage = [cLine, ...GatewayService.SPREAD_MESSAGE];
        client.emit('m', serverChannelId, fullMessage, Date.now());
        console.log(`[Stra188:snapshot] spread (stableChannelId=0001) client=${client.id} clientCh=${clientChannelId} serverCh=${serverChannelId}`);
    }

    private async sendChannelSnapshot(
        client: Socket,
        clientChannelId: string,
        serverChannelId: string,
        stableChannelId: string
    ): Promise<boolean> {
        try {
            if (!this.stra188WsService) return false;
            const { leagues, matches, odds, message } = await this.stra188WsService.getSnapshotForChannel(stableChannelId);
            if (message.length <= 2) return false;
            const [id1, id2] = this.generateChannelMappingIds();
            const cLine: any[] = ['c', clientChannelId, id1, id2];
            client.emit('m', serverChannelId, [cLine, ...message], Date.now());
            console.log(`[Stra188:snapshot] stableChannelId=${stableChannelId} client=${client.id} clientCh=${clientChannelId} serverCh=${serverChannelId} leagues=${leagues.length} matches=${matches.length} odds=${odds.length}`);
            return true;
        } catch (error: any) {
            console.error(`[WS] snapshot error channel=${stableChannelId}: ${error.message}`);
            return false;
        }
    }

    @SubscribeMessage("unsubscribe")
    handleMirrorUnsubscribe(client: Socket, data: any): void {
        try {
            const existing = this.clientSubscriptions.get(client.id) || [];
            const idsToRemove = new Set<string>();

            if (Array.isArray(data) && data.length >= 1) {
                const first = data[0];
                if (Array.isArray(first) && first.length >= 2 && typeof first[0] === 'string') {
                    const groups: any[] = data;
                    for (const group of groups) {
                        if (!Array.isArray(group) || group.length < 2) continue;
                        const items = group[1];
                        if (!Array.isArray(items)) continue;
                        for (const item of items) {
                            if (item?.id != null) idsToRemove.add(String(item.id));
                        }
                    }
                } else {
                    for (const id of data) {
                        if (id != null) idsToRemove.add(String(id));
                    }
                }
            }

            const toRemove = new Set(existing.filter(s => idsToRemove.has(s.clientChannelId) || idsToRemove.has(s.serverChannelId)));
            for (const sub of toRemove) {
                if (sub.condition?.sporttype) {
                    client.leave(`stra188_sport_${sub.condition.sporttype}`);
                    if (sub.condition?.marketid) client.leave(`stra188_s${sub.condition.sporttype}_${sub.condition.marketid}`);
                }
            }

            const remaining = existing.filter(s => !idsToRemove.has(s.clientChannelId) && !idsToRemove.has(s.serverChannelId));
            this.clientSubscriptions.set(client.id, remaining);

            if (remaining.length === 0) {
                client.leave('stra188_all');
            }

            const removedIds = Array.from(toRemove).flatMap(s => [s.clientChannelId, s.serverChannelId]);
            client.emit('unsubscribed', { ids: [...new Set(removedIds)] });
            console.log(`[WS] unsubscribe client=${client.id} removed=${toRemove.size} remaining=${remaining.length}`);
        } catch (error: any) {
            console.error(`[WS] unsubscribe error: ${error.message}`);
        }
    }

    broadcastRawToChannel(mainJson: any[], timestamp: any, stableChannelId: string): void {
        if (!this.server) return;
        const allRoom = this.server.sockets.adapter.rooms.get('stra188_all');
        if (!allRoom || allRoom.size === 0) return;

        let pushCount = 0;
        for (const socketId of allRoom) {
            const client = this.server.sockets.sockets.get(socketId);
            if (!client) continue;

            const subscriptions = this.clientSubscriptions.get(socketId) || [];
            const subsForChannel = subscriptions.filter((s) => s.stableChannelId === stableChannelId);
            if (subsForChannel.length === 0) continue;

            for (const sub of subsForChannel) {
                const payload = this.replaceChannelIdInPayload(mainJson, sub.clientChannelId, sub.serverChannelId);
                client.emit('m', sub.serverChannelId, payload, timestamp);
                pushCount++;
            }
        }
        if (pushCount > 0) {
            console.log(`[Stra188:push] stableChannelId=${stableChannelId} deliveries=${pushCount} room_size=${allRoom.size}`);
        }
    }

    private replaceChannelIdInPayload(mainJson: any[], clientChannelId: string, serverChannelId: string): any[] {
        const out = mainJson.map((entry: any) => {
            if (Array.isArray(entry) && entry[0] === 'c' && entry.length >= 4) {
                return ['c', clientChannelId, entry[2] ?? '', serverChannelId];
            }
            return entry;
        });
        return out;
    }

    @SubscribeMessage("init")
    handleMirrorInit(client: Socket, _data: any): void {
        client.emit('init', { status: 'ok', serverTime: Date.now() });
    }
}

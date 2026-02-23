import { Injectable, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { io, Socket } from 'socket.io-client';
import { GatewayService } from '../socket/gateway.service';
import {
    channelCollectionPrefix,
    getUpstreamChannels,
} from './stra188-channel-registry';
import { Stra188ChannelDef } from './stra188-channel-registry';
import { Stra188ChannelRegistryService } from './stra188-channel-registry.service';

@Injectable()
export class Stra188WebSocketService implements OnModuleInit, OnModuleDestroy {
    private socket: Socket | null = null;
    private socketBaseUrl: string = '';
    private gid: string = '';
    private token: string = '';
    private id: string = '';
    private isConnected: boolean = false;
    private isInitialized: boolean = false;
    private readonly RECONNECT_INTERVAL = 10000;

    /** Stable channel id -> meta. */
    private channelMapping: Map<string, { channelId: string; type: string; condition: any }> = new Map();

    constructor(
        @InjectConnection() private connection: Connection,
        @Inject(forwardRef(() => GatewayService)) private gatewayService: GatewayService,
        private readonly channelRegistryService: Stra188ChannelRegistryService,
    ) {}

    /** Server channel id (e.g. b1711) -> our stableId (0001, 0002, …). Resolved from the "c" line in the first message. */
    private serverIdToStableId: Map<string, string> = new Map();

    /** Per channel: raw index -> field name (from "f" entries in stream). */
    private channelFieldDefs: Map<string, Map<number, string>> = new Map();

    /** Per channel: processed field defs for building messages (from stream or loaded from DB). */
    private channelProcessedFieldDefs: Map<string, {
        indexToName: Map<number, string>;
        nameToIndex: Map<string, number>;
        rawFieldDefs: any[];
    }> = new Map();
    
    async onModuleInit() {
        await this.channelRegistryService.ensureLoaded();
        const registry = this.channelRegistryService.getRegistry();
        await this.clearCollections(registry);
        await this.ensureCollections(registry);
    }

    /** Clear per-channel collections (matches, odds, leagues, bettypes). Field defs are kept so they persist. */
    private async clearCollections(registry: Stra188ChannelDef[]) {
        const channels = getUpstreamChannels(registry);
        for (const ch of channels) {
            const prefix = channelCollectionPrefix(ch.stableId);
            for (const suffix of ['_matches', '_odds', '_leagues', '_bettypes']) {
                try {
                    await this.connection.collection(prefix + suffix).deleteMany({});
                } catch (e) {}
            }
        }
        console.log(`[Stra188 WS] Cleared ${channels.length} channel collections (field_defs kept)`);
    }

    async onModuleDestroy() {
        this.disconnect();
    }

    /** Create per-channel collections and indexes. */
    private async ensureCollections(registry: Stra188ChannelDef[]) {
        const channels = getUpstreamChannels(registry);
        const dbName = this.connection.db?.databaseName ?? 'unknown';
        for (const ch of channels) {
            await this.ensureCollectionsForChannel(ch);
        }
        console.log(`[Stra188 WS] Ensured per-channel collections in DB "${dbName}" for ${channels.length} channels (ch_XXXX_matches, ch_XXXX_odds, etc.)`);
    }

    /** Ensure collections and indexes for a single channel (e.g. when adding dynamically). */
    async ensureCollectionsForChannel(ch: Stra188ChannelDef): Promise<void> {
        const prefix = channelCollectionPrefix(ch.stableId);
        for (const suffix of ['_matches', '_odds', '_leagues', '_bettypes', '_field_defs']) {
            try { await this.connection.createCollection(prefix + suffix); } catch (e) {}
        }
        const matches = this.connection.collection(prefix + '_matches');
        await matches.createIndex({ matchid: 1 }, { unique: true, sparse: true }).catch(() => {});
        await matches.createIndex({ sporttype: 1, marketid: 1 }).catch(() => {});
        await matches.createIndex({ _lastUpdate: 1 }).catch(() => {});
        const odds = this.connection.collection(prefix + '_odds');
        await odds.createIndex({ matchid: 1, oddsid: 1 }, { sparse: true }).catch(() => {});
        await odds.createIndex({ matchid: 1 }).catch(() => {});
        await odds.createIndex({ _lastUpdate: 1 }).catch(() => {});
        const leagues = this.connection.collection(prefix + '_leagues');
        await leagues.createIndex({ leagueid: 1 }, { unique: true, sparse: true }).catch(() => {});
        await leagues.createIndex({ sporttype: 1 }).catch(() => {});
        const bettypes = this.connection.collection(prefix + '_bettypes');
        await bettypes.createIndex({ bettype: 1 }, { sparse: true }).catch(() => {});
    }

    initialize(socketBaseUrl: string, token: string, id: string, socketGid: string) {
        this.socketBaseUrl = socketBaseUrl;
        this.token = token;
        this.id = id;
        this.gid = socketGid;
        this.connect();
    }

    updateToken(token: string) {
        this.token = token;
    }

    private connect() {
        try {
            let serverUrl = this.socketBaseUrl.trim();
            serverUrl = serverUrl.replace(/\/socket\.io\/?$/i, '').replace(/\/$/, '');
            if (serverUrl.startsWith('ws://')) {
                serverUrl = 'http://' + serverUrl.slice(5);
            } else if (serverUrl.startsWith('wss://')) {
                serverUrl = 'https://' + serverUrl.slice(6);
            } else if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
                serverUrl = 'http://' + serverUrl;
            }
            
            console.log(`[Stra188 WS] Connecting to: ${serverUrl}`);
            
            this.socket = io(serverUrl, {
                transports: ['websocket'],
                reconnection: true,
                reconnectionDelay: this.RECONNECT_INTERVAL,
                reconnectionDelayMax: this.RECONNECT_INTERVAL,
                reconnectionAttempts: Infinity,
                timeout: 20000,
                forceNew: true,
                query: {
                    gid: this.gid,
                    token: this.token,
                    id: this.id,
                    rid: 'jwt',
                    EIO: '3',
                    transport: 'websocket',
                },
            });

            this.socket.on('connect', () => {
                console.log(`[Stra188] connected`);
                this.isConnected = true;
                this.isInitialized = false;
                this.initialSubscribeSent = false;
                this.channelMapping.clear();
                this.channelFieldDefs.clear();
                this.serverIdToStableId.clear();
                this.sendInitMessage();
            });

            this.socket.on('disconnect', (reason) => {
                console.log(`[Stra188] disconnected reason=${reason}`);
                this.isConnected = false;
                this.isInitialized = false;
            });

            this.socket.on('connect_error', (error) => {
                if (!error.message?.includes('429')) {
                    console.error(`[Stra188 WS] Error: ${error.message}`);
                }
            });

            this.socket.on('err', (code) => {
                console.error(`[Stra188 WS] Server error: ${code}`);
            });

            this.socket.on('init', () => {
                console.log(`[Stra188 WS] initialized -> sending subscribe`);
                this.isInitialized = true;
                this.sendSubscribeMessages();
            });

            this.socket.on('m', async (...args) => {
                await this.handleMessage(args);
            });

            this.socket.onAny((event, ...args) => {
                if (!['m', 'err', 'init'].includes(event)) {
                    console.log(`[Stra188] event=${event}`, JSON.stringify(args).slice(0, 200));
                }
            });

        } catch (error: any) {
            console.error(`[Stra188] connection failed: ${error.message}`);
        }
    }

    private sendInitMessage() {
        if (!this.socket || !this.isConnected || this.isInitialized) return;
        this.socket.emit('init', {
            gid: this.gid,
            token: this.token,
            id: this.id,
            rid: 'jwt',
            v: 2,
        });
    }

    private initialSubscribeSent: boolean = false;

    /**
     * Build subscription payload for given channels (for initial subscribe or incremental add).
     */
    private buildSubscriptionPayload(channels: Stra188ChannelDef[]): any[] {
        const byType = new Map<string, any[]>();
        for (const ch of channels) {
            const list = byType.get(ch.type) || [];
            list.push({
                id: ch.stableId,
                rev: '',
                sorting: ch.condition?.marketid === 'E' ? 't' : 'n',
                condition: ch.condition,
            });
            byType.set(ch.type, list);
        }
        const subscriptions: any[] = [];
        if (byType.has('odds')) subscriptions.push(['odds', byType.get('odds')]);
        if (byType.has('streaming')) subscriptions.push(['streaming', byType.get('streaming')]);
        return subscriptions;
    }

    /**
     * Generate subscription from full registry and send to upstream (used on init).
     */
    private generateSubscription(): any[] {
        const registry = this.channelRegistryService.getRegistry();
        const channels = getUpstreamChannels(registry);
        if (!this.initialSubscribeSent) {
            this.channelMapping.clear();
            for (const ch of channels) {
                this.channelMapping.set(ch.stableId, { channelId: ch.stableId, type: ch.type, condition: ch.condition });
            }
        }
        this.initialSubscribeSent = true;
        console.log(`[Stra188 WS] Generated ${channels.length} channels from registry`);
        return this.buildSubscriptionPayload(channels);
    }

    private sendSubscribeMessages() {
        if (!this.socket || !this.isConnected || !this.isInitialized) return;
        const subscriptionData = this.generateSubscription();
        console.log(`[Stra188] subscribe sent channels=${this.channelMapping.size}`);
        this.socket.emit('subscribe', subscriptionData);
    }

    /**
     * Add a single channel to mapping and send incremental subscribe to upstream.
     * Call after registry service has added the channel to DB.
     */
    async addChannelAndSubscribe(def: Stra188ChannelDef): Promise<void> {
        if (def.type === 'spread') return; // spread is static, no upstream subscribe
        this.channelMapping.set(def.stableId, { channelId: def.stableId, type: def.type, condition: def.condition });
        await this.ensureCollectionsForChannel(def);
        if (this.socket && this.isConnected && this.isInitialized) {
            const payload = this.buildSubscriptionPayload([def]);
            if (payload.length > 0) {
                this.socket.emit('subscribe', payload);
                console.log(`[Stra188 WS] Incremental subscribe sent for stableId=${def.stableId} type=${def.type}`);
            }
        }
    }

    /**
     * Resolve server channel id (e.g. b1711) to our stableId using the "c" line in the payload.
     * Server sends ["c", clientId, rev, serverId] so clientId is the id we sent in subscribe (our stableId).
     */
    private resolveServerIdToStableId(serverChannelId: string, mainJson: any[]): string {
        if (!serverChannelId) return serverChannelId;
        const cached = this.serverIdToStableId.get(serverChannelId);
        if (cached) return cached;
        if (Array.isArray(mainJson)) {
            for (const entry of mainJson) {
                if (Array.isArray(entry) && entry[0] === 'c' && entry.length >= 2) {
                    const clientId = String(entry[1]);
                    this.serverIdToStableId.set(serverChannelId, clientId);
                    console.log(`[Stra188 WS] mapped server id ${serverChannelId} -> stableId ${clientId} (from "c" line)`);
                    return clientId;
                }
            }
        }
        return serverChannelId;
    }

    private async handleMessage(args: any[]) {
        try {
            if (!Array.isArray(args) || args.length < 2) return;
            const serverChannelId = args[0];
            const mainJson = args[1];
            const timestamp = args[2];
            if (!Array.isArray(mainJson)) return;
            const channelId = this.resolveServerIdToStableId(serverChannelId, mainJson);

            if (!this.channelFieldDefs.has(channelId)) {
                this.channelFieldDefs.set(channelId, new Map());
            }
            const fieldMap = this.channelFieldDefs.get(channelId)!;
            // ready = true after we see 'reset' OR if we already have field defs for this channel
            // (live updates don't have 'reset' or 'f' lines, they just have data entries)
            let ready = fieldMap.size > 0;
            let hasUpdates = false;
            let dataEntryCount = 0;
            const docsToStore: Record<string, any>[] = [];

            for (const entry of mainJson) {
                if (!Array.isArray(entry) || entry.length < 2) continue;

                if (entry[0] === 'f' && entry.length >= 3) {
                    const startIdx = entry[1] as number;
                    const names = entry[2] as string[];
                    names.forEach((name, i) => fieldMap.set(startIdx + i, name));
                    ready = true;
                    continue;
                }

                if (entry[0] === 0 && entry.length === 2) {
                    if (entry[1] === 'reset') {
                        ready = true;
                        await this.storeChannelFieldDefs(channelId, fieldMap);
                        continue;
                    }
                    if (entry[1] === 'done') break;
                }

                if (entry[0] === 'c') continue; // skip channel mapping line

                if (!ready) continue; // no field defs yet, can't parse

                const doc = this.parseEntry(entry, fieldMap);
                if (!doc || !doc.type) continue;

                doc._channelId = channelId;
                doc._lastUpdate = new Date();
                if (doc.sporttype != null) doc.sporttype = Number(doc.sporttype);
                if (doc.marketid != null) doc.marketid = String(doc.marketid);

                docsToStore.push(doc);
                hasUpdates = true;
                dataEntryCount++;
            }

            if (docsToStore.length > 0) {
                await this.storeBatch(docsToStore);
            }

            if (hasUpdates || mainJson.length > 0) {
                this.forwardToClients(channelId, mainJson, timestamp);
                if (dataEntryCount > 0) {
                    console.log(`[Stra188 WS] message channel=${channelId} entries=${dataEntryCount}`);
                }
            }
        } catch (error: any) {
            console.error(`[Stra188] error: ${error.message}`);
        }
    }

    private parseEntry(entry: any[], fieldMap: Map<number, string>): Record<string, any> | null {
        const doc: Record<string, any> = {};
        if (fieldMap.size > 0) {
            for (let i = 0; i + 1 < entry.length; i += 2) {
                const idx = entry[i];
                const val = entry[i + 1];
                const fieldName = fieldMap.get(idx);
                if (fieldName) doc[fieldName] = val;
            }
        } else {
            if (entry.length >= 2 && typeof entry[1] === 'string') {
                doc.type = entry[1];
                for (let i = 2; i < entry.length; i++) doc[`_p${i}`] = entry[i];
                if (entry.length > 3) doc.matchid = entry[3];
                if (entry.length > 4 && (doc.type === 'o' || doc.type === '-o')) doc.oddsid = entry[4];
            }
        }
        return Object.keys(doc).length > 0 ? doc : null;
    }

    /** Batch store: per-channel collections (matches, odds, leagues, bettypes). */
    private async storeBatch(docs: Record<string, any>[]): Promise<void> {
        type Ops = { match: any[]; odds: any[]; league: any[]; bettype: any[] };
        const byChannel = new Map<string, Ops>();

        const getOps = (channelId: string): Ops => {
            let o = byChannel.get(channelId);
            if (!o) {
                o = { match: [], odds: [], league: [], bettype: [] };
                byChannel.set(channelId, o);
            }
            return o;
        };

        for (const doc of docs) {
            const channelId = (doc._channelId as string) || 'unknown';
            const ops = getOps(channelId);
            const type = doc.type;
            try {
                if (type === 'm') {
                    const matchid = doc.matchid;
                    if (matchid == null) continue;
                    const n = Number(matchid);
                    doc.matchid = n;
                    ops.match.push({ updateOne: { filter: { matchid: n }, update: { $set: doc }, upsert: true } });
                } else if (type === 'o') {
                    const matchid = doc.matchid;
                    if (matchid == null) continue;
                    const n = Number(matchid);
                    const oid = doc.oddsid ?? doc.bettype ?? doc.key ?? 0;
                    const o = typeof oid === 'string' ? oid : Number(oid);
                    doc.matchid = n;
                    doc.oddsid = o;
                    ops.odds.push({ updateOne: { filter: { matchid: n, oddsid: o }, update: { $set: doc }, upsert: true } });
                } else if (type === 'l') {
                    const leagueid = doc.leagueid;
                    if (leagueid == null) continue;
                    const n = Number(leagueid);
                    doc.leagueid = n;
                    const st = doc.sporttype != null ? Number(doc.sporttype) : null;
                    const u = { ...doc };
                    if (st != null) u.sporttype = st;
                    ops.league.push({ updateOne: { filter: { leagueid: n }, update: { $set: u }, upsert: true } });
                } else if (type === 'b') {
                    const bettype = doc.bettype ?? doc.bettypeid;
                    if (bettype == null) continue;
                    const n = Number(bettype);
                    doc.bettype = n;
                    ops.bettype.push({ updateOne: { filter: { bettype: n }, update: { $set: doc }, upsert: true } });
                } else if (type === 'st') {
                    const matchid = doc.matchid;
                    if (matchid == null) continue;
                    const n = Number(matchid);
                    const u = { ...doc };
                    delete u.type;
                    u.matchid = n;
                    u._lastUpdate = new Date();
                    u._statusUpdate = true;
                    ops.match.push({ updateOne: { filter: { matchid: n }, update: { $set: u }, upsert: true } });
                } else if (type === '-m') {
                    const matchid = doc.matchid ?? doc._p3;
                    if (matchid == null) continue;
                    const now = new Date();
                    ops.match.push({ updateOne: { filter: { matchid: Number(matchid) }, update: { $set: { _removedAt: now, _lastUpdate: now } }, upsert: false } });
                } else if (type === '-o') {
                    const matchid = doc.matchid ?? doc._p3;
                    const oddsid = doc.oddsid ?? doc._p4;
                    if (matchid == null) continue;
                    const f: any = { matchid: Number(matchid) };
                    if (oddsid != null) f.oddsid = oddsid;
                    ops.odds.push({ updateMany: { filter: f, update: { $set: { _removedAt: new Date(), _lastUpdate: new Date() } } } });
                } else if (type === '-l') {
                    const leagueid = doc.leagueid ?? doc._p3;
                    if (leagueid == null) continue;
                    const now = new Date();
                    ops.league.push({ updateOne: { filter: { leagueid: Number(leagueid) }, update: { $set: { _removedAt: now, _lastUpdate: now } }, upsert: false } });
                } else if (type === '-b') {
                    const bettype = doc.bettype ?? doc._p3;
                    if (bettype == null) continue;
                    const now = new Date();
                    ops.bettype.push({ updateOne: { filter: { bettype: Number(bettype) }, update: { $set: { _removedAt: now, _lastUpdate: now } }, upsert: false } });
                } else if (type === '-st') {
                    const matchid = doc.matchid;
                    if (matchid == null) continue;
                    const n = Number(matchid);
                    const u = { ...doc };
                    delete u.type;
                    u.matchid = n;
                    u._lastUpdate = new Date();
                    u._statusUpdate = true;
                    ops.match.push({ updateOne: { filter: { matchid: n }, update: { $set: u }, upsert: true } });
                }
            } catch (e: any) {
                console.error(`[Stra188] storeBatch type=${type}: ${e?.message}`);
            }
        }

        const promises: Promise<any>[] = [];
        for (const [channelId, ops] of byChannel) {
            const prefix = channelCollectionPrefix(channelId);
            if (ops.match.length) promises.push(this.connection.collection(prefix + '_matches').bulkWrite(ops.match));
            if (ops.odds.length) promises.push(this.connection.collection(prefix + '_odds').bulkWrite(ops.odds));
            if (ops.league.length) promises.push(this.connection.collection(prefix + '_leagues').bulkWrite(ops.league));
            if (ops.bettype.length) promises.push(this.connection.collection(prefix + '_bettypes').bulkWrite(ops.bettype));
        }
        await Promise.all(promises);
    }

    /**
     * Forward original Stra188 message to gateway. No parsing for client payload –
     * gateway will send the same message to subscribed clients, replacing only the
     * server channel id with the one we assigned to each client.
     */
    private forwardToClients(stableChannelId: string, mainJson: any[], timestamp: any): void {
        if (!this.gatewayService) return;
        this.gatewayService.broadcastRawToChannel(mainJson, timestamp, stableChannelId);
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            this.isInitialized = false;
        }
    }

    isReady(): boolean {
        return this.isConnected && this.socket !== null;
    }

    getChannelMapping(): Map<string, any> {
        return this.channelMapping;
    }

    /** Build indexToName/nameToIndex from rawFieldDefs (array of ['f', startIdx, names[]]). */
    private buildFieldDefMaps(rawFieldDefs: any[]): { indexToName: Map<number, string>; nameToIndex: Map<string, number> } {
        const indexToName = new Map<number, string>();
        const nameToIndex = new Map<string, number>();
        for (const entry of rawFieldDefs) {
            if (!Array.isArray(entry) || entry[0] !== 'f' || entry.length < 3) continue;
            const start = Number(entry[1]);
            const names = entry[2] as string[];
            names.forEach((name, i) => {
                indexToName.set(start + i, name);
                nameToIndex.set(name, start + i);
            });
        }
        return { indexToName, nameToIndex };
    }

    /** Store channel-specific field definitions (in memory and in DB ch_*_field_defs). */
    private async storeChannelFieldDefs(channelId: string, fieldMap: Map<number, string>) {
        if (fieldMap.size === 0) return;
        const CHUNK_SIZE = 20;
        const indexToName = new Map<number, string>();
        const nameToIndex = new Map<string, number>();
        const rawFieldDefs: any[] = [];
        const sortedEntries = [...fieldMap.entries()].sort((a, b) => a[0] - b[0]);
        for (const [idx, name] of sortedEntries) {
            indexToName.set(idx, name);
            nameToIndex.set(name, idx);
        }
        let currentStart = -1;
        let currentNames: string[] = [];
        for (const [idx, name] of sortedEntries) {
            if (currentStart === -1 || idx !== currentStart + currentNames.length || currentNames.length >= CHUNK_SIZE) {
                if (currentNames.length > 0) rawFieldDefs.push(['f', currentStart, currentNames]);
                currentStart = idx;
                currentNames = [name];
            } else currentNames.push(name);
        }
        if (currentNames.length > 0) rawFieldDefs.push(['f', currentStart, currentNames]);
        this.channelProcessedFieldDefs.set(channelId, { indexToName, nameToIndex, rawFieldDefs });
        const prefix = channelCollectionPrefix(channelId);
        try {
            await this.connection.collection(prefix + '_field_defs').replaceOne(
                { key: 'def' },
                { key: 'def', channelId, rawFieldDefs },
                { upsert: true }
            );
        } catch (e: any) {
            console.error(`[Stra188] failed to persist field defs channel=${channelId}: ${e?.message}`);
        }
        console.log(`[Stra188] field defs stored channel=${channelId} fields=${indexToName.size}`);
    }

    /** Load channel field defs from DB into memory. Returns true if loaded. */
    private async loadChannelFieldDefsFromDb(channelId: string): Promise<boolean> {
        if (this.channelProcessedFieldDefs.has(channelId)) return true;
        const prefix = channelCollectionPrefix(channelId);
        try {
            const doc = await this.connection.collection(prefix + '_field_defs').findOne({ key: 'def' });
            if (!doc?.rawFieldDefs || !Array.isArray(doc.rawFieldDefs)) return false;
            const { indexToName, nameToIndex } = this.buildFieldDefMaps(doc.rawFieldDefs);
            this.channelProcessedFieldDefs.set(channelId, {
                indexToName,
                nameToIndex,
                rawFieldDefs: doc.rawFieldDefs,
            });
            const fieldMap = this.channelFieldDefs.get(channelId) ?? new Map();
            indexToName.forEach((name, idx) => fieldMap.set(idx, name));
            this.channelFieldDefs.set(channelId, fieldMap);
            return true;
        } catch {
            return false;
        }
    }

    getRawFieldDefinitions(channelId: string): any[] {
        const fieldDef = this.channelProcessedFieldDefs.get(channelId);
        return fieldDef?.rawFieldDefs || [];
    }

    reconstructEntry(doc: Record<string, any>, channelId: string): any[] | null {
        const fieldDef = this.channelProcessedFieldDefs.get(channelId);
        if (!fieldDef || fieldDef.nameToIndex.size === 0) return null;
        const pairs: [number, any][] = [];
        for (const [fieldName, value] of Object.entries(doc)) {
            if (fieldName.startsWith('_')) continue;
            const idx = fieldDef.nameToIndex.get(fieldName);
            if (idx !== undefined) pairs.push([idx, value]);
        }
        pairs.sort((a, b) => a[0] - b[0]);
        const flat = pairs.flat();
        return flat.length <= 2 ? null : flat;
    }

    /** Build message for one channel using that channel's field defs. No [0,'done'] - original Stra188 doesn't use it. */
    buildClientMessage(docs: Record<string, any>[], channelId: string): any[] {
        const entries: any[] = [...this.getRawFieldDefinitions(channelId), [0, 'reset']];
        for (const doc of docs) {
            const entry = this.reconstructEntry(doc, channelId);
            if (entry?.length) entries.push(entry);
        }
        return entries;
    }

    /**
     * Get snapshot for one channel (from that channel's collections and field defs).
     * Used by gateway for initial snapshot when client subscribes by channelId.
     */
    async getSnapshotForChannel(channelId: string): Promise<{
        leagues: any[];
        matches: any[];
        odds: any[];
        message: any[];
    }> {
        const prefix = channelCollectionPrefix(channelId);
        const matchQuery = { _removedAt: { $exists: false } };
        const leagueQuery = { _removedAt: { $exists: false } };
        const [matches, leagues] = await Promise.all([
            this.connection.collection(prefix + '_matches').find(matchQuery).toArray(),
            this.connection.collection(prefix + '_leagues').find(leagueQuery).toArray(),
        ]).catch(() => [[], []]);
        const matchIds = matches.map((m: any) => m.matchid).filter((id: any) => id != null);
        const odds = matchIds.length > 0
            ? await this.connection.collection(prefix + '_odds').find({ matchid: { $in: matchIds }, _removedAt: { $exists: false } }).toArray()
            : [];
        const allDocs = [...leagues, ...matches, ...odds];
        await this.loadChannelFieldDefsFromDb(channelId);
        const message = this.channelProcessedFieldDefs.has(channelId)
            ? this.buildClientMessage(allDocs, channelId)
            : [[0, 'reset']];
        return { leagues, matches, odds, message };
    }

    /** Per-subscription-type channel counts. */
    getSubscriptionTypesSummary(): Record<string, number> {
        const summary: Record<string, number> = {};
        for (const meta of this.channelMapping.values()) {
            const t = meta.type || 'unknown';
            summary[t] = (summary[t] ?? 0) + 1;
        }
        return summary;
    }

    getStats() {
        return {
            connected: this.isConnected,
            initialized: this.isInitialized,
            channelCount: this.channelMapping.size,
            subscriptionTypes: this.getSubscriptionTypesSummary(),
            fieldDefsCount: this.channelFieldDefs.size,
        };
    }
}

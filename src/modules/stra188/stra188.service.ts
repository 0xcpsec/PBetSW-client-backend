import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Stra188WebSocketService } from './stra188-websocket.service';
import { Stra188ChannelRegistryService } from './stra188-channel-registry.service';
import { channelCollectionPrefix, getUpstreamChannels } from './stra188-channel-registry';
import * as stra188Client from '../../utils/stra188-client';

@Injectable()
export class Stra188Service implements OnModuleInit {
    private sessionId: string;
    private sportsUrl = process.env.PASER_SERVER_URL ?? 'http://127.0.0.1:5000';
    private newIndexUrl: string = '';
    private socketUrl: string;
    private rt: string;
    private at: string;
    private id: string;
    private GUID: string;
    private isInitialized = false;

    constructor(
        @InjectConnection() private connection: Connection,
        private readonly webSocketService: Stra188WebSocketService,
        private readonly channelRegistryService: Stra188ChannelRegistryService,
    ) {}

    async onModuleInit() {
        await this.initialize();
    }

    async initialize() {
        try {
            console.log('[Stra188] Initializing Client Backend connection...');

            this.rt = '1234567890';
            this.at = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGFpbXMiOiJwMUN5K0ZNNElkZ2NHN2huOWlGYlVvNXU4U3J5SmFqVUtLWXVqemZRRHRtQ1RzY3d3L0xPM25YYkdsOWh6VFpaU1BHT1E5ZW5oaWFPdU9DYVJhb200NTA1bXFSdVphTWJCdzZYTjM2U29QSjh3SzJkaHpnd0NodldlMlZ1NmRLZTVFYUxxaTJTdGluRkl6dk9wcWV3STZmeWtqRkZaWFNCRFZ0bEN5bnRzd0kzaUdYOUF5Ujc4WHczNTcrOGJ5WU9KWk10NVdNUmsvZnFvcEZ0cVBPOEE2aDF2ZXdxV0ZOYUNiaU5qaDQwelBldEplYmVadVIrNW9YTE1YUUVQcXVpIiwibmJmIjoxNzcwMjUzNDEyLCJleHAiOjE3NzAyNTU0NTIsImlhdCI6MTc3MDI1MzQ3MiwiaXNzIjoiT3JjYSIsImF1ZCI6IkFjY291bnRSZWxhdGlvbiJ9.Kd46oenrVw1L-SR08ZuPCRReCiWSQxcfIbm3AybaAEMW0PCWa6_ghzFDyaaEdlqmbsmnNvyoDCpe-KjkxG3Fx8LAX1r-KkxTyCQPonBx9WTfdfy2sSiRUHxgi8HA-aHRdmI5ZLFSzKOj4z7xPbFN7FsGxUDe_9UyASvcU5RnqHQ';
            this.id = 'Tesqedixac11e15884e1406399bf155fc85ef7f6';
            this.socketUrl = `${process.env.PARSER_SERVER_URL ?? 'http://127.0.0.1:5000'}/socket.io/`;
            
            console.log('[Stra188] Initialization complete');

            // Initialize WebSocket connection for real-time updates
            const socketGid = stra188Client.getWebSocketGid();
            this.webSocketService.initialize(this.socketUrl as string, this.at, this.id, socketGid);

            this.isInitialized = true;
        } catch (error) {
            console.error('[Stra188] Initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Reinitialize the connection (restart login process)
     * Called when 401 Unauthorized is detected (e.g. by Stra188FetchModule)
     */
    async reinitialize() {
        try {
            console.log('[Stra188] Reinitializing connection due to authentication failure...');
            this.isInitialized = false;
            
            // Disconnect WebSocket if connected
            if (this.webSocketService.isReady()) {
                this.webSocketService.disconnect();
            }
            
            // Clear existing tokens
            this.sessionId = '';
            this.rt = '';
            this.at = '';
            this.id = '';
            this.GUID = '';
            this.sportsUrl = '';
            this.newIndexUrl = '';
            
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Reinitialize
            await this.initialize();
        } catch (error: any) {
            console.error('[Stra188] Error during reinitialization:', error.message);
            // Retry after 10 seconds
            setTimeout(() => this.reinitialize(), 10000);
        }
    }

    isReady() {
        return this.isInitialized;
    }

    /**
     * Get matches from per-channel collections (primary channel: 0002)
     * Field names are lowercase as received from WebSocket
     */
    async getMatches(filters?: {
        sportType?: number;
        marketId?: string;
        leagueId?: number;
        limit?: number;
    }) {
        const query: any = { _removedAt: { $exists: false } };
        if (filters?.sportType) query.sporttype = filters.sportType;
        if (filters?.marketId) query.marketid = filters.marketId;
        if (filters?.leagueId) query.leagueid = filters.leagueId;

        const prefix = channelCollectionPrefix('0002');
        return await this.connection.collection(prefix + '_matches')
            .find(query)
            .sort({ _lastUpdate: -1 })
            .limit(filters?.limit || 100)
            .toArray();
    }

    /**
     * Get single match by ID
     */
    async getMatch(matchId: number) {
        const channels = getUpstreamChannels(this.channelRegistryService.getRegistry());
        for (const ch of channels) {
            const m = await this.connection.collection(channelCollectionPrefix(ch.stableId) + '_matches')
                .findOne({ matchid: matchId });
            if (m) return m;
        }
        return null;
    }

    /**
     * Get odds for a match
     */
    async getMatchOdds(matchId: number) {
        const channels = getUpstreamChannels(this.channelRegistryService.getRegistry());
        const all: any[] = [];
        for (const ch of channels) {
            const odds = await this.connection.collection(channelCollectionPrefix(ch.stableId) + '_odds')
                .find({ matchid: matchId, _removedAt: { $exists: false } }).toArray();
            all.push(...odds);
        }
        return all;
    }

    /**
     * Get leagues
     */
    async getLeagues(sportType?: number) {
        const query: any = { _removedAt: { $exists: false } };
        if (sportType) query.sporttype = sportType;
        const prefix = channelCollectionPrefix('0002');
        return await this.connection.collection(prefix + '_leagues')
            .find(query).sort({ _lastUpdate: -1 }).toArray();
    }

    /**
     * Get bet types
     */
    async getBetTypes(sportType?: number) {
        const query: any = { _removedAt: { $exists: false } };
        if (sportType) query.sporttype = sportType;
        const prefix = channelCollectionPrefix('0002');
        return await this.connection.collection(prefix + '_bettypes').find(query).toArray();
    }

    getWebSocketStatus() {
        return {
            connected: this.webSocketService.isReady(),
            initialized: this.isInitialized,
            stats: this.webSocketService.getStats(),
        };
    }

    /**
     * Get statistics about stored data (aggregated across per-channel collections)
     */
    async getDataStats() {
        const channels = getUpstreamChannels(this.channelRegistryService.getRegistry());
        let matches = 0, odds = 0, leagues = 0, betTypes = 0;
        for (const ch of channels) {
            const prefix = channelCollectionPrefix(ch.stableId);
            const [m, o, l, b] = await Promise.all([
                this.connection.collection(prefix + '_matches').countDocuments({ _removedAt: { $exists: false } }).catch(() => 0),
                this.connection.collection(prefix + '_odds').countDocuments({ _removedAt: { $exists: false } }).catch(() => 0),
                this.connection.collection(prefix + '_leagues').countDocuments().catch(() => 0),
                this.connection.collection(prefix + '_bettypes').countDocuments().catch(() => 0),
            ]);
            matches += m; odds += o; leagues += l; betTypes += b;
        }
        return { matches, odds, leagues, betTypes };
    }
}


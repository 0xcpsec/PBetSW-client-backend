import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import {
    Stra188ChannelDef,
    DEFAULT_STRA188_CHANNEL_REGISTRY,
    resolveStableChannelId,
} from './stra188-channel-registry';

const REGISTRY_COLLECTION = 'stra188_channel_registry';

@Injectable()
export class Stra188ChannelRegistryService implements OnModuleInit {
    private registry: Stra188ChannelDef[] = [...DEFAULT_STRA188_CHANNEL_REGISTRY];
    private loaded = false;

    constructor(@InjectConnection() private connection: Connection) {}

    async onModuleInit() {
        await this.ensureLoaded();
    }

    /**
     * Ensure the registry collection exists and is loaded.
     * Client does not seed channels – no subscription to upstream channels.
     */
    async ensureLoaded(): Promise<void> {
        if (this.loaded) return;
        try {
            await this.connection.createCollection(REGISTRY_COLLECTION);
        } catch (_) {
        }
        await this.seedChannelRegistry();
        await this.ensureIndexes();
        this.loaded = true;
        console.log(`[Stra188] Channel registry ready: ${this.registry.length} channels`);
    }

    /** In-memory registry (loaded from DB on init and updated when adding channels). */
    getRegistry(): Stra188ChannelDef[] {
        return this.registry;
    }


    /** Seed from DEFAULT_STRA188_CHANNEL_REGISTRY. */
    async seedChannelRegistry(): Promise<void> {
        const coll = this.connection.collection(REGISTRY_COLLECTION);
        const count = await coll.countDocuments();
        if (count > 0) return;

        const toInsert = DEFAULT_STRA188_CHANNEL_REGISTRY.map((ch) => ({
            stableId: ch.stableId,
            type: ch.type,
            condition: ch.condition,
            createdAt: new Date(),
        }));
        await coll.insertMany(toInsert);
        console.log(`[Stra188] Channel registry seeded with ${toInsert.length} default channels`);
    }

    /** Ensure unique stableId (call after ensureLoaded). */
    async ensureIndexes(): Promise<void> {
        const coll = this.connection.collection(REGISTRY_COLLECTION);
        await coll.createIndex({ stableId: 1 }, { unique: true }).catch(() => {});
    }

    /**
     * Resolve (type, condition) to an existing stableId, or create a new channel in DB and return it.
     * Call this from the gateway when a client subscribes with a type/condition not yet in the registry.
     */
    async resolveOrAddChannel(type: string, condition: Record<string, any>): Promise<Stra188ChannelDef> {
        const normalized = condition ?? {};
        const existingId = resolveStableChannelId(this.registry, type, normalized);
        if (existingId != null) {
            const def = this.registry.find((ch) => ch.stableId === existingId)!;
            return def;
        }

        const stableId = await this.nextStableId();
        const def: Stra188ChannelDef = { stableId, type, condition: normalized };
        const coll = this.connection.collection(REGISTRY_COLLECTION);
        await coll.insertOne({
            stableId: def.stableId,
            type: def.type,
            condition: def.condition,
            createdAt: new Date(),
        });
        this.registry.push(def);
        console.log(`[Stra188] New channel added to registry: stableId=${stableId} type=${type}`);
        return def;
    }

    private async nextStableId(): Promise<string> {
        const coll = this.connection.collection(REGISTRY_COLLECTION);
        const docs = await coll.find({}, { projection: { stableId: 1 } }).toArray();
        let max = 0;
        for (const d of docs) {
            const n = parseInt(String(d.stableId), 10);
            if (!Number.isNaN(n) && n > max) max = n;
        }
        const next = max + 1;
        return next.toString().padStart(4, '0');
    }
}

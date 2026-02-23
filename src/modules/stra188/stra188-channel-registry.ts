/**
 * Unified channel identity and registry for Stra188.
 * One entry per unique (type, condition). Client/server channel ids (c0, b0, …) are dynamic
 * and not part of the registry. Backend and gateway use stableId for storage, routing, and push.
 */

/** One channel definition: stable id + type + condition. No client/server channel ids. */
export interface Stra188ChannelDef {
  /** Stable unique channel id. Used in DB collections, gateway routing, push. */
  stableId: string;
  /** Wire type: "spread" | "odds" | "streaming" | ... */
  type: string;
  /** Subscription condition (sporttype, marketid, bettype, etc.). */
  condition: Record<string, any>;
}

/**
 * If the id echoed by upstream is a known stableId, return it; otherwise return echoedId as-is.
 */
export function resolveEchoedIdToStableId(
  registry: Stra188ChannelDef[],
  echoedId: string
): string {
  if (!echoedId) return echoedId;
  const known = registry.find((ch) => ch.stableId === echoedId);
  return known ? known.stableId : echoedId;
}

/**
 * Resolve (type, condition) from client subscribe to the registry's stable channel id.
 * Returns the first registry channel whose type and condition match (deep-equal).
 * Use this in the gateway when a client subscribes; then use returned stableId everywhere.
 */
export function resolveStableChannelId(
  registry: Stra188ChannelDef[],
  type: string,
  condition: Record<string, any>
): string | null {
  const normalized = condition ?? {};
  for (const ch of registry) {
    if (ch.type !== type) continue;
    if (conditionEquals(ch.condition, normalized)) return ch.stableId;
  }
  return null;
}

function conditionEquals(a: Record<string, any>, b: Record<string, any>): boolean {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) return false;
    const va = a[keysA[i]];
    const vb = b[keysB[i]];
    if (Array.isArray(va) && Array.isArray(vb)) {
      if (va.length !== vb.length) return false;
      for (let j = 0; j < va.length; j++) if (va[j] !== vb[j]) return false;
    } else if (va !== vb) return false;
  }
  return true;
}

/**
 * Safe MongoDB collection name from channelId (e.g. "odds:c1" -> "odds_c1").
 */
export function sanitizeChannelIdForCollection(channelId: string): string {
  return channelId.replace(/[^a-zA-Z0-9_]/g, '_');
}

/** Collection name prefix for a channel (e.g. "ch_odds1_matches"). No stra188_ prefix. */
export function channelCollectionPrefix(channelId: string): string {
  return `ch_${sanitizeChannelIdForCollection(channelId)}`;
}

/**
 * Default channel registry: one entry per unique (type, condition). No duplication.
 * stableId is zero-padded numeric (0001, 0002, …) so it scales to hundreds/thousands of channels.
 */
export const DEFAULT_STRA188_CHANNEL_REGISTRY: Stra188ChannelDef[] = [
  { stableId: '0001', type: 'spread', condition: {} },
  { stableId: '0002', type: 'odds', condition: { sporttype: 1, no_stream: true, source: 'hotleaguewall', mini: 1, bettype: [1, 3] } },
  { stableId: '0003', type: 'odds', condition: { sporttype: 1, marketid: 'L', no_stream: true, bettype: [16], source: null } },
  { stableId: '0004', type: 'odds', condition: { sporttype: 1, marketid: 'T', no_stream: true, bettype: [16], source: null } },
  { stableId: '0005', type: 'streaming', condition: { sporttype: 1 } },
  {
    stableId: '0006',
    type: 'odds',
    condition: {
      sporttype: 1,
      marketid: 'E',
      no_stream: true,
      bettype: [1, 2, 3, 5, 7, 8, 15, 22, 301, 302, 303, 304, 394, 396, 400, 470, 471, 461, 462, 24, 448, 393, 390, 381, 382, 482, 483, 413],
      source: null,
    },
  },
  {
    stableId: '0007',
    type: 'odds',
    condition: {
      sporttype: 1,
      marketid: 'L',
      no_stream: true,
      bettype: [1, 2, 3, 5, 7, 8, 15, 22, 301, 302, 303, 304, 394, 396, 400, 470, 471, 461, 462, 24, 448, 393, 390, 381, 382, 482, 483, 413],
      source: null,
    },
  },
  {
    stableId: '0008',
    type: 'odds',
    condition: {
      sporttype: 1,
      marketid: 'T',
      no_stream: true,
      bettype: [1, 2, 3, 5, 7, 8, 15, 22, 301, 302, 303, 304, 394, 396, 400, 470, 471, 461, 462, 24, 448, 393, 390, 381, 382, 482, 483, 413],
      source: null,
    },
  },
];

/** Channels that are subscribed to upstream (exclude spread). */
export function getUpstreamChannels(registry: Stra188ChannelDef[]): Stra188ChannelDef[] {
  return registry.filter((ch) => ch.type !== 'spread');
}

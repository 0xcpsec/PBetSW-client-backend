# Stra188 Integration Guide

## Understanding the Data Structure

### 1. Desktop Menu Response (Market Groups)

The `callDesktopMenu()` response contains **market group aggregations** - these are collections of betting markets organized by type:

```json
{
    "Key": "m0.E.1.HDPOU1",
    "Mode": "m0",           // Mode: m0 = prematch, m1 = inplay
    "MarketId": "E",         // Market identifier
    "SportType": 1,         // 1 = Soccer/Football, 2 = Basketball, etc.
    "BetTypeGroup": "HDPOU1", // Bet type: HDPOU1 = Handicap + Over/Under
    "Count": 589,           // Number of fixtures/matches in this group
    "Streaming": false      // Whether live streaming is available
}
```

**Key Format Breakdown: `m0.E.1.HDPOU1`**
- `m0` = Mode (prematch)
- `E` = Market ID
- `1` = Sport Type (Soccer)
- `HDPOU1` = Bet Type Group

**Common Bet Type Groups:**
- `HDPOU1` = Handicap + Over/Under (Asian Handicap + Total Goals)
- `MP` = Match Result (1X2 - Win/Draw/Win)
- `OR` = Outright (Winner of tournament/league)
- `ALL` = All markets combined
- `OE` = Odd/Even (Total goals odd or even)
- `TG` = Total Goals

### 2. GetMoneyLineMappingOddsList Response

This is **odds adjustment/mapping configuration** - it defines how to adjust moneyline (1X2) odds based on favoritism:

```json
{
    "mainFavor": 0.01,  // Main favorite adjustment (1% = 0.01)
    "mnl": 8,          // Moneyline number/level
    "favor": 0.01,     // Favorite team adjustment
    "under": -0.03     // Underdog adjustment (negative = reduce odds)
}
```

**What it means:**
- When a team is heavily favored, odds are adjusted using these multipliers
- `mainFavor` = base adjustment for favorite
- `favor` = additional adjustment for favorite side
- `under` = adjustment for underdog (negative = reduces payout)
- `mnl` = mapping level identifier

This is used to **normalize or adjust odds** across different betting providers to maintain consistent margins.

## Integration Strategy

### Option 1: Minimal Changes (Recommended for Quick Start)

Keep existing schema, add Stra188-specific fields:

1. **Market Groups** → Store as separate collection or add to existing Market entity
2. **Odds Mapping** → Store as configuration/reference data
3. **Fixtures** → Use existing Fixture structure, populate from Stra188 API calls

### Option 2: Unified Schema (Better for Long-term)

Create adapter layer that normalizes both LSports and Stra188 data into common format.

## Next Steps

1. Create Stra188 service module
2. Add new entities for market groups and odds mapping
3. Create API endpoints
4. Add WebSocket support for real-time updates


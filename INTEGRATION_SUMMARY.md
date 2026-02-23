# Stra188 Integration Summary

## What I've Created

### 1. **New Entities** (Database Schemas)
- `Stra188MarketGroup` - Stores market group aggregations from desktop menu
- `Stra188OddsMapping` - Stores moneyline odds mapping configuration

### 2. **New Service Module**
- `Stra188Service` - Handles authentication, data fetching, and storage
- `Stra188Controller` - REST API endpoints for partners
- `Stra188Module` - NestJS module configuration

### 3. **Client Library**
- `stra188-client.ts` - TypeScript wrapper for your data fetching script

## Understanding Your Data

### Desktop Menu Response (Market Groups)

The `callDesktopMenu()` returns **market group aggregations** - these are collections of betting markets organized by type:

**Key Format: `m0.E.1.HDPOU1`**
- `m0` = Mode (prematch), `m1` = inplay
- `E` = Market ID
- `1` = Sport Type (1 = Soccer/Football)
- `HDPOU1` = Bet Type Group

**Common Bet Type Groups:**
- `HDPOU1` = Handicap + Over/Under (Asian Handicap + Total Goals)
- `MP` = Match Result (1X2 - Win/Draw/Win)
- `OR` = Outright (Tournament/League Winner)
- `ALL` = All markets combined
- `OE` = Odd/Even (Total goals odd or even)
- `TG` = Total Goals

**What `Count` means:** Number of fixtures/matches available in this market group.

### GetMoneyLineMappingOddsList

This is **odds adjustment/mapping configuration** used to normalize moneyline (1X2) odds:

```json
{
    "mainFavor": 0.01,  // Base adjustment for favorite (1%)
    "mnl": 8,          // Moneyline level identifier
    "favor": 0.01,     // Additional favorite adjustment
    "under": -0.03     // Underdog adjustment (negative = reduces payout)
}
```

**Purpose:** Adjusts odds to maintain consistent profit margins across different betting scenarios. When a team is heavily favored, these multipliers adjust the displayed odds.

## How to Use

### 1. Environment Variables

Add to your `.env` file:
```
SITE_USERNAME=your_username
SITE_PASSWORD=your_password
SITE_CAPTCHA_CODE=your_captcha_code
```

### 2. API Endpoints

Once running, you'll have these endpoints:

**Get Market Groups:**
```
GET /stra188/market-groups?mode=m0&sportType=1&betTypeGroup=HDPOU1
```

**Get Odds Mapping:**
```
GET /stra188/odds-mapping
```

**Check Status:**
```
GET /stra188/status
```

### 3. Data Flow

1. **On Startup:** Service automatically logs in and initializes connection
2. **Every 60s:** Refreshes `rt` and `at` tokens
3. **Every 30s:** Fetches desktop menu and saves market groups to database
4. **On Demand:** Partners can query market groups via API

## Next Steps

### To Complete Integration:

1. **Implement GetMoneyLineMappingOddsList**
   - Find the actual API endpoint for this
   - Add it to `stra188-client.ts`
   - Uncomment the code in `stra188.service.ts`

2. **Fetch Actual Fixture Data**
   - The desktop menu gives you market groups, but you need to fetch actual fixtures
   - You'll likely need additional API calls to get fixture details for each market group
   - Consider creating a `Stra188Fixture` entity similar to `Prematch`/`Inplay`

3. **Add WebSocket Support**
   - Similar to how LSports uses WebSocket for real-time updates
   - You may need to poll or subscribe to updates for market groups

4. **Normalize Data Structure**
   - Consider creating an adapter layer that converts Stra188 format to match your existing Fixture structure
   - This allows partners to use the same API format regardless of data source

## Serving Data to Partners

The current implementation stores market groups. To serve complete betting data:

1. **Market Groups** → Use existing endpoints (`/stra188/market-groups`)
2. **Fixtures** → You'll need to fetch fixture details for each market group key
3. **Odds** → Fetch odds for each fixture/market combination

**Recommended Approach:**
- Use market group `Key` (e.g., "m0.E.1.HDPOU1") to fetch fixture lists
- For each fixture, fetch detailed odds
- Store in a normalized format similar to your existing `Fixture` structure
- Serve via unified API endpoints

## Questions to Answer

1. **How do you get fixture details?** 
   - Is there an API endpoint that takes a market group `Key` and returns fixtures?
   - Or do you need to query by sport/league/date?

2. **How do you get odds for each fixture?**
   - Is there a separate endpoint for odds?
   - Or are odds included in fixture details?

3. **Real-time updates?**
   - Does Stra188 provide WebSocket/SSE for live updates?
   - Or do you need to poll periodically?

Once you have answers to these, I can help complete the integration!


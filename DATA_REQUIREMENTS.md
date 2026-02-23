# Data Requirements Analysis - What You Need vs What You Have

## What the Screenshot Shows (What Partners Need)

### 1. **Match/Fixture Data** ✅ MISSING
- Team names (Necaxa vs. Monterrey)
- Current scores (0-2)
- Match status/time (1H 41', 2H 37')
- League/Competition name (GIẢI VÔ ĐỊCH QUỐC GIA MEXICO)
- Match ID (to track updates)

### 2. **Detailed Betting Markets with Odds** ✅ MISSING
- **Handicap (Cược Chấp)**: Necaxa (0/0.5) 1.03, Monterrey 0.84
- **Over/Under (Tài Xỉu)**: Over 3.5/4 0.98, Under 0.87
- **1X2 (Match Result)**: Necaxa 17.00, Monterrey 1.15, Draw 6.50
- **Next Goal**: Home 1.92, Away 2.45, No Goal 5.00
- **Odd/Even**: Odd 0.97, Even 0.88
- **Half Time markets**: Separate odds for 1st half
- **Corner Kicks markets**: Special market type
- And many more market types...

### 3. **Real-time Updates** ✅ MISSING
- Score changes (live updates)
- Odds movements (green up arrow ↑, red down arrow ↓)
- Time progression
- Market status changes (suspended, closed, etc.)

## What You Currently Have (Desktop Menu)

The desktop menu only provides:
- **Market Group Keys**: "m0.E.1.HDPOU1" (aggregation identifiers)
- **Count**: Number of fixtures in each group (e.g., 299, 138, 77)
- **Bet Type Groups**: HDPOU1, MP, OR, OE, TG, etc.
- **Mode**: m0 (prematch) or m1 (inplay)

**This is like having a table of contents, but not the actual book pages.**

## What You Need to Fetch

### Step 1: Get Fixture List for Each Market Group

You need an API endpoint that takes a market group `Key` (e.g., "m0.E.1.HDPOU1") and returns:
- List of fixtures/matches in that group
- Basic match info (teams, league, start time, status)

**Example API call needed:**
```
GET /api/fixtures?marketGroupKey=m0.E.1.HDPOU1
```

**Expected response structure:**
```json
{
  "fixtures": [
    {
      "fixtureId": 12345,
      "homeTeam": "Necaxa",
      "awayTeam": "Monterrey",
      "league": "GIẢI VÔ ĐỊCH QUỐC GIA MEXICO",
      "startTime": "2024-01-15T20:00:00Z",
      "status": "1H 41'",
      "score": { "home": 0, "away": 2 },
      "currentPeriod": 1,
      "currentTime": 41
    },
    ...
  ]
}
```

### Step 2: Get Detailed Odds for Each Fixture

You need an API endpoint that takes a `fixtureId` and returns:
- All available markets for that fixture
- Odds for each bet option
- Market status (open, suspended, closed)
- Handicap/line values (0/0.5, 3.5/4, etc.)

**Example API call needed:**
```
GET /api/fixtures/12345/odds?marketGroupKey=m0.E.1.HDPOU1
```

**Expected response structure:**
```json
{
  "fixtureId": 12345,
  "markets": [
    {
      "marketType": "HANDICAP",
      "marketName": "Cược Chấp Toàn Trận",
      "bets": [
        {
          "name": "Necaxa",
          "line": "0/0.5",
          "odds": 1.03,
          "status": "open",
          "priceMovement": "up" // or "down" or null
        },
        {
          "name": "Monterrey",
          "line": "",
          "odds": 0.84,
          "status": "open"
        }
      ]
    },
    {
      "marketType": "OVER_UNDER",
      "marketName": "Tài Xỉu Toàn Trận",
      "bets": [
        {
          "name": "Over",
          "line": "3.5/4",
          "odds": 0.98,
          "status": "open",
          "priceMovement": "up"
        },
        {
          "name": "Under",
          "line": "3.5/4",
          "odds": 0.87,
          "status": "open",
          "priceMovement": "down"
        }
      ]
    },
    {
      "marketType": "1X2",
      "marketName": "1X2 Toàn Trận",
      "bets": [
        { "name": "1", "odds": 17.00, "status": "open" },
        { "name": "X", "odds": 6.50, "status": "open" },
        { "name": "2", "odds": 1.15, "status": "open" }
      ]
    },
    // ... more markets
  ]
}
```

### Step 3: Real-time Updates (WebSocket or Polling)

You need either:
- **WebSocket connection** for live updates (scores, odds changes)
- **Polling endpoint** to check for updates periodically

**WebSocket message structure:**
```json
{
  "type": "ODDS_UPDATE",
  "fixtureId": 12345,
  "marketId": "HANDICAP",
  "betId": "home",
  "newOdds": 1.05,
  "priceMovement": "up",
  "timestamp": "2024-01-15T20:41:00Z"
}
```

## Current Status

❌ **Desktop Menu Only = NOT ENOUGH**

You can only show:
- How many matches exist in each category
- Which bet types are available
- But NOT the actual matches, teams, scores, or odds

## Next Steps

1. **Find the API endpoints** in Stra188 documentation or by inspecting network requests:
   - Endpoint to get fixtures for a market group key
   - Endpoint to get odds for a fixture
   - WebSocket URL or polling endpoint for updates

2. **Implement fixture fetching**:
   - Use market group keys to fetch fixture lists
   - Store fixtures in database (similar to your existing Fixture structure)

3. **Implement odds fetching**:
   - Fetch odds for each fixture
   - Store in database with market structure

4. **Implement real-time updates**:
   - WebSocket connection or polling mechanism
   - Update database and broadcast to partners

## Recommendation

**You need to find these Stra188 API endpoints:**
1. `GET /api/fixtures?marketGroupKey={key}` - Get fixture list
2. `GET /api/fixtures/{fixtureId}/odds` - Get detailed odds
3. `WS /api/live` or polling endpoint - Real-time updates

Once you have these, I can help you integrate them into the service!


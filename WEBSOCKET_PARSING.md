# WebSocket Message Parsing Guide

## Message Format

Stra188 uses Socket.IO with a specific message format:

```
42["m","b143",[[0,"o",2,925645176,5,1.079,20,2.35,21,1.53],...],"21xi9Y"]
```

**Breakdown:**
- `42` = Socket.IO message type (4 = MESSAGE, 2 = EVENT)
- `["m","b143",[...data...],"timestamp"]` = Event payload
  - `"m"` = Event name (message)
  - `"b143"` = Channel ID
  - `[...data...]` = Array of update messages
  - `"21xi9Y"` = Timestamp/sequence ID

## Data Array Structure

Each item in the data array follows this pattern:

### Odds Update: `[0,"o",2,fixtureId,marketId,key1,value1,key2,value2,...]`
- `0` = Message type indicator
- `"o"` = Action (odds update)
- `2` = Version
- `fixtureId` = Match/Fixture ID
- `marketId` = Market identifier
- `key,value` pairs = Odds data

**Example:**
```
[0,"o",2,925645176,5,1.079,20,2.35,21,1.53]
```
- Fixture: 925645176
- Market: 5
- Key 1.079 = some odds value
- Key 20 = 2.35
- Key 21 = 1.53

### Match Update: `[0,"m",version,sportType,matchId,...matchData...]`
- `0` = Message type indicator
- `"m"` = Action (match update)
- `version` = Data version (90, 1, etc.)
- `sportType` = Sport type (2 = football)
- `matchId` = Match identifier
- `...matchData...` = Key-value pairs of match data

**Example:**
```
[0,"m",90,2,1,120361610,42,161073,91,"T",80,"PPSM22174591",...]
```
- Version: 90
- Sport: 2 (football)
- Match: 120361610
- Key 42 = 161073
- Key 91 = "T"
- Key 80 = "PPSM22174591"
- etc.

### Remove Odds: `[0,"-o",2,fixtureId,marketId?]`
- `"-o"` = Remove odds action
- `fixtureId` = Match to remove odds from
- `marketId` = Optional specific market

### Remove Match: `[0,"-m",1,matchId]`
- `"-m"` = Remove match action
- `matchId` = Match to remove

## Key Mappings (Discovered So Far)

Based on the match update example, here are some key mappings:

- `80` = Match number/ID
- `82` = Home team ID
- `85` = Start time (timestamp)
- `86` = Current time (timestamp)
- `87` = Home team name ID
- `92` = Match status ("running", "finished", etc.)
- `99` = Home team name
- `100` = Away team name
- `40` = Home score
- `43` = Away score
- `56` = League ID
- `91` = Match type ("T" = ?)
- `98` = Some status flag
- `118-145` = Team names in different languages

## Odds Key Mappings

For odds updates, common keys appear to be:
- `5` = Some odds value
- `6` = Over odds or handicap value
- `7` = Under odds or handicap value
- `20` = Home team odds
- `21` = Away team odds
- `22` = Line/handicap value
- `37` = Draw odds (1X2)
- `38` = Away win odds (1X2)
- `39` = Home win odds (1X2)
- `127-166` = Various market-specific odds

## Next Steps

1. **Monitor WebSocket messages** to discover more key mappings
2. **Test with different match types** to understand data structure variations
3. **Map keys to readable field names** in the database
4. **Handle different message versions** (version 90 vs version 1)

## Testing

To test the parsing:
1. Connect to WebSocket
2. Log all incoming messages
3. Compare parsed data with actual UI
4. Refine key mappings based on observations


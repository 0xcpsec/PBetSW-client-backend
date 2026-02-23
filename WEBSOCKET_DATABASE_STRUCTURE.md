# WebSocket Data – Database Structure Recommendation

## Overview

WebSocket messages (`42["m", batchId, MainJSON]`) contain:

- **`b`** – Bet types (field definitions, e.g. Handicap, Over/Under)
- **`l`** – Leagues (leagueid, sporttype, names, etc.)
- **`m`** – Matches/fixtures (matchid, leagueid, teams, start time, status, scores)
- **`o`** – Odds (matchid, market, bet type, odds payload)
- **`st`** – Status updates (matchid, status, sporttype, etc.)

## Recommended Collections (MongoDB)

### 1. **stra188_fixtures** (existing)

- **Use:** Matches + nested odds.
- **Key fields:** `FixtureId`, `LeagueId`, `SportType`, `HomeTeamName`, `AwayTeamName`, `Status`, `ScoreHome`, `ScoreAway`, `StartTime`, `Markets` (map of marketId → odds payload), `LastUpdate`.
- **Feed:** CRUD/APIs on fixtures; consumers query by sport, league, date, status.

### 2. **stra188_leagues** (new)

- **Use:** Leagues from `l` entries.
- **Key fields:** `LeagueId`, `SportType`, `LeagueNameEn`, `LeagueNameVn`, `CountryCode`, `Outright`, etc. (from “f” field names).
- **Feed:** League list APIs; join or reference when serving fixtures.

### 3. **stra188_bet_types** (new)

- **Use:** Bet types from `b` entries.
- **Key fields:** `BetType`, `LicSpreadBetTypeGroupId`, `TypeNameEn`, `TypeNameVn`, etc.
- **Feed:** Bet-type metadata for odds presentation.

### 4. **stra188_feed_entries** (optional – raw store)

- **Use:** Store each parsed `b` / `l` / `m` / `o` / `st` as a generic document for replay, debugging, or downstream workers.
- **Key fields:** `batchId`, `type` (`b`|`l`|`m`|`o`|`st`), `timestamp`, `payload` (flexible key-value).
- **Feed:** Async processors, replay pipelines, or audits.

## Suggested Setup

| Collection           | Purpose                    | Feed to others                          |
|----------------------|----------------------------|-----------------------------------------|
| `stra188_fixtures`   | Matches + odds             | Fixture APIs, trading, UIs              |
| `stra188_leagues`    | League metadata            | Filters, dropdowns, league-based APIs   |
| `stra188_bet_types`  | Bet-type metadata          | Odds display, market config             |
| `stra188_feed_entries` | Raw feed (optional)      | Replay, workers, analytics              |

## Implementation status

- **Parser:** Rewritten per WebSocket Data Structure doc (field map from `"f"`, `[0,"reset"]` / `[0,"done"]`, index–value pairs, type `b`/`l`/`m`/`o`/`st`).
- **Persistence:** `m` → `stra188_fixtures`, `o` → `Markets` on fixture, `st` → fixture status update. `b` and `l` handlers are stubbed (TODO: add `stra188_bet_types`, `stra188_leagues` and persist).

## Unknown-type logging

Messages whose **type is not** one of the basic 5 (**b**, **l**, **m**, **o**, **st**) are logged to **`logs/stra188-unknown-types.jsonl`** for analysis. Use this to discover new types (e.g. `"x"`, `"-m"`, `"-o"`) and add handling logic.

Each line: `{ timestamp, batchId, optionalId, kind, record, rawEntry }`. **`kind`** is the unknown type or `"missing"` if there is no type. **`record`** and **`rawEntry`** are the parsed map and raw array. The `logs/` directory is gitignored.

## Next steps

1. Add `Stra188League` and `Stra188BetType` entities/schemas.
2. Implement `handleLeague` / `handleBetType` to upsert into those collections.
3. Optionally add `Stra188FeedEntry` and push every parsed `b`/`l`/`m`/`o`/`st` for replay or downstream consumers.
4. Review `logs/stra188-unknown-types.jsonl` and add handlers for newly observed types.

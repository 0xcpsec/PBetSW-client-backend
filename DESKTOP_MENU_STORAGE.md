# Desktop Menu Storage - How It Works

## Current Implementation (Optimized)

The desktop menu data is **NOT** added to the collection every time. It's optimized to only save what's changed.

### How It Works:

1. **Fetch existing data** (one query):
   ```typescript
   const existingGroups = await this.marketGroupModel.find({ 
       Key: { $in: marketGroups.map(g => g.Key) } 
   });
   ```
   - Fetches only the groups that exist in the current response
   - Uses indexed `Key` field for fast lookup

2. **Compare and categorize**:
   - **New groups** → Added to `groupsToInsert` array
   - **Changed groups** → Added to `keysToUpdate` array  
   - **Unchanged groups** → Skipped entirely (no DB operation)

3. **Batch operations**:
   - **New groups**: `insertMany(groupsToInsert)` - one bulk insert
   - **Changed groups**: `bulkWrite(bulkOps)` - one bulk update
   - **Unchanged groups**: Nothing (no DB write)

### Example Scenario (300 items every 30s):

**First time:**
- 300 new groups → 1 `insertMany()` call with 300 items

**Subsequent times (typical):**
- 0-5 new groups → 1 `insertMany()` with 0-5 items
- 10-50 changed groups (Count changed) → 1 `bulkWrite()` with 10-50 updates
- 245-290 unchanged groups → **0 DB operations** (skipped)

**Result:** Instead of 300 writes every 30s, you get:
- ~5-50 writes (only new + changed)
- ~250-295 skipped (no DB operation)

## Database Schema

The `Key` field is:
- `unique: true` - Prevents duplicates
- `index: true` - Fast lookups

This ensures:
- No duplicate entries
- Fast comparison queries
- Efficient updates

## What Gets Updated

The code checks if these fields changed:
- `Count` - Number of fixtures (most likely to change)
- `Streaming` - Streaming status
- `Mode` - Prematch/Inplay
- `MarketId` - Market identifier
- `SportType` - Sport type
- `BetTypeGroup` - Bet type group

If any of these change, the record is updated. Otherwise, it's skipped.

## Performance

**Efficient because:**
1. ✅ Only one query to fetch existing data (indexed)
2. ✅ In-memory comparison (Map lookup - O(1))
3. ✅ Batch operations (not individual writes)
4. ✅ Skips unchanged items (no DB write)

**Not efficient if:**
- All 300 items were inserted every time (but they're not!)
- Individual updates instead of batch (but it uses batch!)

## Monitoring

The logs show:
```
[Stra188] Desktop menu processed: 5 new, 12 updated, 283 unchanged, 0 removed
```

This tells you exactly what happened:
- 5 new groups inserted
- 12 groups updated (data changed)
- 283 groups unchanged (skipped - no DB write)
- 0 groups removed

## Conclusion

**The current implementation is already optimized!** 

It does NOT add all 300 items every time. It only:
- Inserts new groups (first time only, or when new market groups appear)
- Updates changed groups (when Count or other fields change)
- Skips unchanged groups (most of them, most of the time)

This is the most efficient approach for this use case.


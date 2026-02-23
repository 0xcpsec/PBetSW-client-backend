# GetMoneyLineMappingOddsList - Do You Need It?

## What It Does

`GetMoneyLineMappingOddsList` returns **odds adjustment/mapping configuration** for moneyline (1X2) bets. It's used to:

1. **Normalize odds** across different scenarios
2. **Adjust odds based on favoritism** (mainFavor, favor, under)
3. **Maintain consistent profit margins** regardless of which team is favored

## Example Response

```json
{
    "errorCode": 0,
    "errorMsg": "",
    "data": {
        "moneyLineOddsList": [
            {
                "mainFavor": 0.01,  // 1% base adjustment for favorite
                "mnl": 8,           // Moneyline level identifier
                "favor": 0.01,      // Additional favorite adjustment
                "under": -0.03      // Underdog adjustment (negative = reduces payout)
            },
            ...
        ]
    }
}
```

## Do You Need It?

### ✅ **YES, if you:**
- Need to **adjust/normalize odds** before serving to partners
- Want to **apply your own profit margins** to Stra188 odds
- Need to **standardize odds format** across different providers
- Want to **modify odds** based on favoritism levels

### ❌ **NO, if you:**
- Are just **passing through odds** from Stra188 as-is
- Don't need to **adjust or normalize** the odds
- Partners are **happy with Stra188's original odds**
- You're just **aggregating and serving** the data without modification

## Recommendation

**For most use cases: You DON'T need it.**

Since you're building an adapter to serve Stra188 data to partners, you typically just need to:
1. Fetch market groups (desktop menu) ✅
2. Fetch fixture details (when you have the endpoint)
3. Fetch odds for each fixture (when you have the endpoint)
4. Serve the data as-is to partners

**Only fetch GetMoneyLineMappingOddsList if:**
- Your partners require adjusted/normalized odds
- You need to apply your own margins
- You're building a betting platform that modifies odds

## Implementation

If you decide you need it, you'll need to:
1. Find the actual API endpoint URL
2. Implement it in `stra188-client.ts`
3. Call it periodically (maybe once per hour or on startup)
4. Store it in the database
5. Apply the adjustments when serving odds to partners

For now, it's commented out and can be enabled later if needed.


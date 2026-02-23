# Dependency Cleanup Summary

## Removed Dependencies

These dependencies were removed as they're not used in the Stra188-only project:

1. **amqplib** - RabbitMQ client (was only used for LSports)
2. **mysql** - MySQL client (not used)
3. **request** - HTTP client (replaced by axios)

## Kept Dependencies (Still Used)

1. **telegraf** - Used for Telegram notifications (`src/utils/general.ts`)
2. **winston** - May be used for logging (check if actually used)
3. **socket.io-client** - Used for Stra188 WebSocket connection
4. **axios** - Used for HTTP requests
5. **mongoose** - Used for MongoDB
6. **@nestjs/** packages - Core NestJS framework

## Optional: Further Cleanup

If you want to remove more dependencies, check if these are actually used:
- `winston` / `winston-daily-rotate-file` - Only if you're using Winston for logging
- `nest-winston` - Only if using Winston with NestJS
- `geoip-lite` - Only if doing IP geolocation
- `telesignsdk` - Only if using Telesign services
- `paystack-nestjs` - Only if using Paystack payments
- `translate-google` - Only if doing translation
- `xlsx` - Only if processing Excel files

## Queue Processing

The desktop menu queue is now properly processed:
- Queue processor runs every 5 seconds
- Processes desktop menu data to extract fixture info
- Can trigger additional API calls or WebSocket subscriptions
- Prevents concurrent processing with `isProcessingQueue` flag


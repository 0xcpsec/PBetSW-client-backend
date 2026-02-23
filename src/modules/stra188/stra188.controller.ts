import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { Stra188Service } from './stra188.service';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Public } from 'src/security/decorators/public.decorator';

@ApiTags('Stra188')
@Controller('stra188')
export class Stra188Controller {
    constructor(private readonly stra188Service: Stra188Service) {}

    @Get('/status')
    @Public()
    @ApiOperation({ summary: 'Get connection status and statistics' })
    async getStatus() {
        const [dataStats] = await Promise.all([
            this.stra188Service.getDataStats(),
        ]);
        
        return {
            ready: this.stra188Service.isReady(),
            websocket: this.stra188Service.getWebSocketStatus(),
            data: dataStats,
        };
    }

    @Get('/matches')
    @Public()
    @ApiOperation({ summary: 'Get matches from WebSocket data' })
    @ApiQuery({ name: 'sportType', required: false, description: 'Sport type (1=Soccer, 2=Basketball, etc.)' })
    @ApiQuery({ name: 'marketId', required: false, description: 'Market ID (L=Live, T=Today, E=Early)' })
    @ApiQuery({ name: 'limit', required: false, description: 'Max results (default 100)' })
    async getMatches(
        @Query('sportType') sportType?: string,
        @Query('marketId') marketId?: string,
        @Query('leagueId') leagueId?: string,
        @Query('limit') limit?: string,
    ) {
        const filters: any = {};
        if (sportType) filters.sportType = parseInt(sportType);
        if (marketId) filters.marketId = marketId;
        if (leagueId) filters.leagueId = parseInt(leagueId);
        if (limit) filters.limit = parseInt(limit);

        const matches = await this.stra188Service.getMatches(filters);
        return { Body: matches, Count: matches.length };
    }

    @Get('/matches/:matchId')
    @Public()
    @ApiOperation({ summary: 'Get single match by ID' })
    async getMatch(@Param('matchId') matchId: string) {
        const match = await this.stra188Service.getMatch(parseInt(matchId));
        const odds = await this.stra188Service.getMatchOdds(parseInt(matchId));
        return { match, odds };
    }

    @Get('/leagues')
    @Public()
    @ApiOperation({ summary: 'Get leagues' })
    async getLeagues(@Query('sportType') sportType?: string) {
        const leagues = await this.stra188Service.getLeagues(
            sportType ? parseInt(sportType) : undefined
        );
        return { Body: leagues, Count: leagues.length };
    }

    @Get('/bettypes')
    @Public()
    @ApiOperation({ summary: 'Get bet types' })
    async getBetTypes(@Query('sportType') sportType?: string) {
        const betTypes = await this.stra188Service.getBetTypes(
            sportType ? parseInt(sportType) : undefined
        );
        return { Body: betTypes, Count: betTypes.length };
    }

    @Get('/config')
    @Public()
    @ApiOperation({ summary: 'Get subscription info (channel registry)' })
    getConfig() {
        return {
            message: 'Subscriptions use channel registry. See stra188-channel-registry.ts for channels.',
            websocket: this.stra188Service.getWebSocketStatus(),
        };
    }
}


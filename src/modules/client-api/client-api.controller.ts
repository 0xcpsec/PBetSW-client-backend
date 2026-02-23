import { Controller, Get } from '@nestjs/common';
import { Public } from 'src/security/decorators/public.decorator';

@Controller()
export class ClientApiController {
  @Public()
  @Get('Favorites')
  getFavorites() {
    return {
      ErrorCode: 0,
      ErrorMsg: '',
      Data: {
        LeagueLimit: 0,
        TeamLimit: 100,
        Ldata: [],
        Mdata: [],
        Teams: [],
      },
    };
  }

  @Public()
  @Get('Favorites/GetMyLeague')
  getMyLeague() {
    return {
      ErrorCode: 0,
      ErrorMsg: '',
      Data: ['0'],
    };
  }

  @Public()
  @Get('Customer/GetIsGoodCustomer')
  getIsGoodCustomer() {
    return {
      IsGoodCustomer: false,
      Group: 0,
    };
  }

  @Public()
  @Get('Search/GetSearchHistory')
  getSearchHistory() {
    return {
      ErrorCode: 0,
      ErrorMsg: '',
      Data: {
        DeleteStatus: 'False',
        HistoryStatus: 0,
        History: [],
      },
    };
  }
}

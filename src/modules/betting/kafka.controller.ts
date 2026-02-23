import { Body, Controller, Post } from '@nestjs/common';
import { Public } from 'src/security/decorators/public.decorator';

@Controller('Kafka')
export class KafkaController {
  @Public()
  @Post('BetTracking')
  async betTracking(@Body() _body: unknown): Promise<boolean> {
    return true;
  }
}

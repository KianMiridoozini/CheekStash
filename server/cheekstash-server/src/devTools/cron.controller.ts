// cron.controller.ts
import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CronService } from './cron.service';

@ApiTags('Start Cron Jobs')
@Controller('cron')
export class CronController {
  constructor(private readonly cronService: CronService) {}

  @Get('start-cron')
  @ApiOperation({
    summary: 'Starts the cron job that keeps render alive',
    description: 'Starts the cron job that keeps render alive',
  })
  @ApiResponse({
    status: 200,
    description: 'Response from the cron job',
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  startCron(): { message: string } {
    try {
      this.cronService.startCron();
      return { message: 'Started cron-job from active route call' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

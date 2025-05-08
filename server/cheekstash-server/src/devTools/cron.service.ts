// cron.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as cron from 'node-cron';
import https from 'https';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  private counter: number;
  private task: cron.ScheduledTask;

  // Configuration
  private readonly TOTAL_DURATION_MINUTES = 120;
  private readonly MINUTES_DELTA = 5;
  private readonly URL = 'https://cheekstash.onrender.com/';
  private readonly cronPattern = `*/${this.MINUTES_DELTA} * * * *`;

  private pingServer(): void {
    https.get(this.URL, () => {
      this.counter -= this.MINUTES_DELTA;
      this.logger.log('Pinged the server');
      this.logger.log(`Minutes Left: ${this.counter}`);
    });
  }

  private stopPingingServer(): void {
    if (this.task) {
      this.task.stop();
      this.logger.log('Stopped the cron job due to inactivity');
    }
  }

  startCron(): void {
    this.counter = this.TOTAL_DURATION_MINUTES;
    this.task = cron.schedule(this.cronPattern, () => this.pingServer(), { scheduled: false });
    this.task.start();

    // Automatically stop after the total duration
    setTimeout(() => this.stopPingingServer(), this.TOTAL_DURATION_MINUTES * 60 * 1000);
  }
}

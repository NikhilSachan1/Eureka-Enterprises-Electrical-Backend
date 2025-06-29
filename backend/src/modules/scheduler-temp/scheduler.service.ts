import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly httpService: HttpService) {}

  @Cron('*/10 * * * *') // Runs every 10 minutes
  async handleCronJob() {
    this.logger.log('Cron job started - Running every 10 minutes');

    try {
      // Replace with your actual API endpoint
      const apiUrl = 'https://european-union.onrender.com/api/v1/countries'; // Example API

      const response = await firstValueFrom(
        this.httpService.get(apiUrl, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 seconds timeout
        }),
      );

      this.logger.log(
        `Cron job completed successfully. Response: ${JSON.stringify(response.data)}`,
      );

      // You can process the response data here
      return {
        success: true,
        data: response.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Cron job failed: ${error.message}`, error.stack);

      // You can implement retry logic or error handling here
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Manual trigger method for testing
  async triggerManually() {
    this.logger.log('Manual trigger initiated');
    return await this.handleCronJob();
  }
}

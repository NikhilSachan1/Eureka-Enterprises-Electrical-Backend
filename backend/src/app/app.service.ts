import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): { message: string } {
    return {
      message: 'Hello, I am Eureka PeopleOps. Feeling great, and so is your system',
    };
  }
}

import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): { message: string } {
    return {
      message: 'Hello, I am RealQualified. Feeling great, and so is your system',
    };
  }
}

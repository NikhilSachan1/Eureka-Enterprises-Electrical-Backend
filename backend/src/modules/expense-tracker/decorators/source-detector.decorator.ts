import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { EntrySourceType } from 'src/utils/master-constants/master-constants';

export const DetectSource = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): EntrySourceType => {
    const request = ctx.switchToHttp().getRequest();
    const headers = request.headers;

    const customSource = headers['x-source-type'] || headers['x-client-type'];
    if (customSource) {
      return customSource.toLowerCase() === 'app' ? EntrySourceType.APP : EntrySourceType.WEB;
    }

    return EntrySourceType.WEB;
  },
);

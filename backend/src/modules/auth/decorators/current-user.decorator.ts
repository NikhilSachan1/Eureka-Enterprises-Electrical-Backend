import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserFromRequest } from '../auth.types';

export const CurrentUser = createParamDecorator(
  (data: keyof UserFromRequest | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: UserFromRequest = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);

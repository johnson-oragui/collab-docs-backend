import { createParamDecorator } from '@nestjs/common';
import { AuthenticatedRequest } from '../commons/http/request.interface';

export const CurrentUser = createParamDecorator((_, ctx) => {
  const user = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;

  return user;
});

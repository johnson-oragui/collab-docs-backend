import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class UserAgentGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req =
      ctx.getType<GqlContextType>() === 'graphql'
        ? GqlExecutionContext.create(ctx).getContext<{ req: Request }>().req
        : ctx.switchToHttp().getRequest<Request>();
    const userAgent = req.headers['user-agent'];
    if (userAgent === null || !userAgent || userAgent?.trim() === '') {
      throw new HttpException({ message: 'Forbidden', statusCode: 403 }, 403);
    }
    return true;
  }
}

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class UserAgentGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const userAgent = req.headers['user-agent'];
    if (userAgent === null || !userAgent || userAgent?.trim() === '') {
      throw new HttpException({ message: 'Forbidden', statusCode: 403 }, 403);
    }
    return true;
  }
}

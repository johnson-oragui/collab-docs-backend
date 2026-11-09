import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CustomJwtService } from '../../jwt-service/jwt.service';
import { UserRepository } from '../../user/user.repository';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { UserSessionService } from '@/user_sessions/user-session.service';

@Injectable()
export class CustomJwtAuthGuard implements CanActivate {
  constructor(
    private readonly customJwtService: CustomJwtService,
    private readonly userRepository: UserRepository,
    private readonly configService: ConfigService,
    private readonly userSessionService: UserSessionService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const authHeader = req.headers['authorization'];

    const authCookieName = this.configService.get<string>(
      'AUTH_COOKIE_NAME',
      '',
    );

    const cookie = req.cookies?.[authCookieName];

    if (!cookie && !authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    if (authHeader && !authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = cookie ?? authHeader?.substring(7);
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }
    const payload = this.customJwtService.verify(token);
    if (
      !payload.sub ||
      !payload.id ||
      payload.sub !== payload.id ||
      !payload.sid ||
      !payload.jti
    ) {
      throw new UnauthorizedException('Invalid access token payload');
    }

    const isSessionActive = await this.userSessionService.isSessionActive(
      payload.sub,
      payload.sid,
    );

    if (!isSessionActive) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    // const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

    // if (WRITE_METHODS.includes(req.method)) {
    //   const user = await this.userRepository.findById(payload.sub as string);

    //   if (!user) {
    //     throw new UnauthorizedException();
    //   }

    //   req.user = user;
    // }

    const user = await this.userRepository.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException();
    }

    req.user = user;

    req.decodedUser = payload;
    req.authType = 'ACCESS_TOKEN';
    return true;
  }
}

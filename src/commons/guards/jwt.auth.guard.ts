import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CustomJwtService } from '../../jwt-service/jwt.service';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { UserSessionService } from '@/user_sessions/user-session.service';
import { Repository } from 'typeorm';
import { UserEntity } from '@/user/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { GqlExecutionContext, GqlContextType } from '@nestjs/graphql';
import { OrganisationApiKeysService } from '@/organisation-api-key/organisation-api-key.service';

@Injectable()
export class CustomJwtAuthGuard implements CanActivate {
  constructor(
    private readonly customJwtService: CustomJwtService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly configService: ConfigService,
    private readonly userSessionService: UserSessionService,
    private readonly apiKeysService: OrganisationApiKeysService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req =
      ctx.getType<GqlContextType>() === 'graphql'
        ? GqlExecutionContext.create(ctx).getContext<{ req: Request }>().req
        : ctx.switchToHttp().getRequest<Request>();

    const authHeader = req.headers['authorization'];

    const authCookieName = this.configService.get<string>(
      'AUTH_COOKIE_NAME',
      '',
    );

    const apiKeyHeader = req.headers['x-api-key'];
    if (apiKeyHeader) {
      const apiKeyEntity = await this.apiKeysService.validateApiKey(
        apiKeyHeader as string,
      );

      if (!apiKeyEntity) {
        throw new HttpException(
          { message: 'Invalid or expired API key', success: false },
          401,
        );
      }
      const forwardedFor = req.headers['x-forwarded-for'];
      const clientIp =
        typeof forwardedFor === 'string'
          ? forwardedFor.split(',')[0].trim()
          : req.ip || req.connection?.remoteAddress || '0.0.0.0';

      // Validate against whitelisted IPs
      if (!this.apiKeysService.isIpAllowed(clientIp, apiKeyEntity.allowedIps)) {
        throw new HttpException(
          {
            message: `Access denied: IP address ${clientIp} is not authorized for this API key.`,
            success: false,
          },
          401,
        );
      }

      req.user = apiKeyEntity.user;
      req.organisation = apiKeyEntity.organisation;
      req.authType = 'API_KEY';

      return true;
    }

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

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    req.user = user;

    req.decodedUser = payload;
    req.authType = 'ACCESS_TOKEN';
    return true;
  }
}

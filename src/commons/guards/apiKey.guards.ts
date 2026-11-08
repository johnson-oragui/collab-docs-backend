import { OrganisationApiKeysService } from '@/organisation-api-key/organisation-api-key.service';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
} from '@nestjs/common';
import { Request } from 'express';

export type TAuthType = 'API_KEY' | 'ACCESS_TOKEN';

@Injectable()
export class OrganisationApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: OrganisationApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKeyHeader = request.headers['x-api-key'];

    if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
      throw new HttpException(
        { message: 'Missing API key in request headers', success: false },
        401,
      );
    }

    const apiKeyEntity = await this.apiKeysService.validateApiKey(apiKeyHeader);

    if (!apiKeyEntity) {
      throw new HttpException(
        { message: 'Invalid or expired API key', success: false },
        401,
      );
    }

    const forwardedFor = request.headers['x-forwarded-for'];
    const clientIp =
      typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0].trim()
        : request.ip || request.connection?.remoteAddress || '0.0.0.0';

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

    request.user = apiKeyEntity.user;
    request.organisation = apiKeyEntity.organisation;
    request.authType = 'API_KEY';

    return true;
  }
}

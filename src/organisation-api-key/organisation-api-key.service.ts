import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { UserEntity } from '../user/user.entity';
import { OrganisationApiKeyEntity } from './organisation-api-key.entity';
import { PasswordService } from '@/password/password.service';
import { Address4, Address6 } from 'ip-address';
import { OrganisationApiKeyStatusEnum } from '@/database/database.enums';

@Injectable()
export class OrganisationApiKeysService {
  constructor(
    @InjectRepository(OrganisationApiKeyEntity)
    private readonly apiKeyRepository: Repository<OrganisationApiKeyEntity>,
    private readonly passwordService: PasswordService,
  ) {}

  async createApiKey(user: UserEntity, name: string, organisationId?: string) {
    const rawSecret = crypto.randomBytes(32).toString('hex');
    const prefix = 'cd_' + rawSecret.substring(0, 6);
    const fullKey = `${prefix}_${rawSecret}`;

    const keyHash = await this.passwordService.hash(fullKey);

    const apiKey = this.apiKeyRepository.create({
      name,
      keyHash,
      prefix,
      user,
      organisation: organisationId ? ({ id: organisationId } as any) : null,
    });

    await this.apiKeyRepository.save(apiKey);

    // Return the full plaintext key to the user
    // they must store it securely
    return {
      apiKey: fullKey,
      name: apiKey.name,
      prefix: apiKey.prefix,
      createdAt: apiKey.createdAt,
    };
  }

  /**
   * Validates an incoming API key string against stored hashes.
   */
  async validateApiKey(
    fullKey: string,
  ): Promise<OrganisationApiKeyEntity | null> {
    const prefix = fullKey.split('_').slice(0, 2).join('_'); // Extract prefix (e.g., cd_9x...)

    if (!prefix) return null;

    const candidateKeys = await this.apiKeyRepository.find({
      where: { prefix, status: OrganisationApiKeyStatusEnum.ACTIVE },
      relations: { organisation: true, user: true },
    });

    for (const apiKey of candidateKeys) {
      // Check expiration
      if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
        continue;
      }

      const isMatch = await this.passwordService.verify(
        apiKey.keyHash,
        fullKey,
      );
      if (isMatch) {
        // Update last used timestamp asynchronously
        await this.apiKeyRepository.update(apiKey.id, {
          lastUsedAt: new Date(),
        });
        return apiKey;
      }
    }

    return null;
  }

  isIpAllowed(clientIp: string, allowedList: string[] | null): boolean {
    if (!allowedList || allowedList.length === 0) {
      return true; // If no restriction is configured, allow all IPs
    }

    // Clean up IPv6 mapped IPv4 addresses (e.g., ::ffff:192.168.1.1 -> 192.168.1.1)
    const cleanClientIp = clientIp.replace(/^.*:/, '');

    for (const rule of allowedList) {
      const trimmedRule = rule.trim();

      // Exact match
      if (trimmedRule === cleanClientIp) {
        return true;
      }

      // CIDR Range match (e.g., "192.168.1.0/24")
      if (trimmedRule.includes('/')) {
        try {
          if (cleanClientIp.includes('.')) {
            const address = new Address4(cleanClientIp);
            const isInSubnet = address.isInSubnet(new Address4(trimmedRule));
            if (isInSubnet) return true;
          } else if (cleanClientIp.includes(':')) {
            const address = new Address6(cleanClientIp);
            const isInSubnet = address.isInSubnet(new Address6(trimmedRule));
            if (isInSubnet) return true;
          }
        } catch (e) {
          // Invalid CIDR format in rule, skip
        }
      }
    }

    return false;
  }
}

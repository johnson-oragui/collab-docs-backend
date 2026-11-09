import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  private readonly client: RedisClientType;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.getOrThrow<string>('REDIS_URL');

    this.client = createClient({ url });

    this.client.on('error', (error) => {
      this.logger.error('Redis connection error', error);
    });

    this.client.on('connect', () => {
      this.logger.log('Connecting to Redis...');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis connection established.');
    });

    this.client.on('reconnecting', () => {
      this.logger.warn('Reconnecting to Redis...');
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }

  getClient(): RedisClientType {
    return this.client;
  }
}

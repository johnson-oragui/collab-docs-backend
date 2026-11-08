import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  NODE_ENV: string;
  constructor(private readonly configService: ConfigService) {
    this.NODE_ENV = this.configService.get<string>('NODE_ENV', 'development');
  }
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, {
      type: argon2.argon2id,
      memoryCost: ['development', 'test'].includes(this.NODE_ENV)
        ? 2 ** 12
        : 2 ** 16, //64 mb
      timeCost: ['development', 'test'].includes(this.NODE_ENV) ? 1 : 3,
      parallelism: 1,
    });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}

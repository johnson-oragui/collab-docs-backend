/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import jwt, { SignOptions } from 'jsonwebtoken';

type StringValue =
  | `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}`
  | `${number}`;

@Injectable()
export class CustomJwtService {
  secret: string;
  expiresIn: string;
  issuer: string;
  audience: string;
  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.get<string>('JWT_SECRET', 'ede');
    this.expiresIn = this.configService.get<string>('JWT_EXPIRY', '15m');
    this.issuer = this.configService.get<string>('JWT_ISSUER', 'collabocs');
    this.audience = this.configService.get<string>(
      'JWT_AUDIENCE',
      'collabdocs client',
    );
  }

  sign(payload: Record<string, any>): string {
    const options: SignOptions = {
      expiresIn: this.expiresIn as StringValue,
      issuer: this.issuer,
      audience: this.audience,
      subject: (payload['_id'] || payload['id']) as string,
    };

    const token = jwt.sign(payload, this.secret, options);

    return token;
  }

  verify(token: string): jwt.JwtPayload {
    try {
      return jwt.verify(token, this.secret, {
        issuer: this.issuer,
        audience: this.audience,
      }) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
  decodeToken(token: string): jwt.JwtPayload {
    try {
      return jwt.decode(token) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

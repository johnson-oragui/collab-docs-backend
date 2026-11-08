/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger/logger.wiston';
import { asyncStore } from '../storage/async-storage';
import { uuidv7 } from 'uuidv7';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = uuidv7();
    asyncStore.run({ requestId }, () => {
      const userAgent: string | undefined = req.headers['user-agent'];

      const xForwardedFor = req.headers['x-forwarded-for'];
      const requestData: Record<string, any> = {
        timestamp: new Date().toISOString(),
        userAgent,
        userIp: req.ip,
        xForwardedFor: this.getForwardedFor(xForwardedFor),
        path: req.path,
        params: req.query,
        method: req.method,
        body: req.body ? JSON.stringify(this.obfuscate(req.body)) : {},
        requestId,
      };
      res.setHeader('x-request-id', requestId);

      logger.info('InBound Request ✅✅✅✅✅✅✅✅✅', requestData);

      res.on('finish', () => {
        const responseData: Record<string, any> = {
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
          userId: (req['user'] as Record<string, string>)?._id || 'Guest',
          role: (req['user'] as Record<string, string>)?.role || null,
          requestId,
        };
        logger.info('OutBound Response ⏩⏩⏩⏩⏩⏩⏩⏩⏩⏩⏩⏩', responseData);
      });

      next();
    });
  }

  private obfuscate(body: unknown) {
    // if (JSON.stringify(maskedBody).length > 1000) { ... }
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = [
      'password',
      'token',
      'refreshToken',
      'secret',
      'creditCard',
      'confirmPassword',
    ];

    const newBody = { ...body };

    for (const key of Object.keys(newBody)) {
      if (sensitiveFields.includes(key)) {
        newBody[key] = '*************';
      } else if (typeof newBody[key] === 'object') {
        newBody[key] = this.obfuscate(newBody[key]);
      }
    }

    return newBody;
  }

  private getForwardedFor(forwardedFor: string | string[] | null | undefined) {
    if (!forwardedFor) return forwardedFor;

    if (typeof forwardedFor === 'object' && Array.isArray(forwardedFor)) {
      const flen = forwardedFor.length;

      return flen > 0 ? forwardedFor[flen - 1] : null;
    }

    const forwardedFors = forwardedFor.split(',');

    return forwardedFors.length > 0
      ? forwardedFors[forwardedFors.length - 1]
      : null;
  }
}

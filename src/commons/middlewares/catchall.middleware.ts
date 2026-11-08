import { HttpException, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CatchAllMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const userAgent = req.headers['user-agent'];
    if (userAgent === null || !userAgent || userAgent?.trim() === '') {
      throw new HttpException({ message: 'Forbidden', statusCode: 403 }, 403);
    }
    if (
      req.path.startsWith('/api') ||
      ['/favicon.ico', '/'].includes(req.path)
    ) {
      return next();
    }

    res.status(403).json({
      statusCode: 403,
      error: 'Forbidden',
      message: `Access to ${req.method} ${req.path} is forbidden`,
    });
  }
}

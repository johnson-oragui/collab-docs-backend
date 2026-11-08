/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { logger } from '../logger/logger.wiston';
import { asyncStore } from '../storage/async-storage';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const res =
      exception instanceof HttpException
        ? {
            ...(exception.getResponse() as Record<string, any>),
            success: false,
            message:
              (exception.getResponse() as Record<string, any>)?.message ??
              'Error',
          }
        : {
            message: 'Internal Server Error',
            success: false,
          };

    const store = asyncStore.getStore();

    logger.error('Unhandled exception', {
      path: req.originalUrl,
      method: req.method,
      status,
      error: exception instanceof Error ? exception.message : String(exception),
      requestId: store?.requestId,
    });

    // console.log('res: ', res);
    if (store?.requestId) {
      response.setHeader('x-request-id', store.requestId);
    }

    response.status(status).json(res);
  }
}

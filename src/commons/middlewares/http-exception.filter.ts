import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { Request, Response } from 'express';

import { logger } from '../logger/logger.wiston';
import { asyncStore } from '../storage/async-storage';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const isGraphQL = host.getType<GqlContextType>() === 'graphql';

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const responseObject =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? exceptionResponse
        : {};

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : ((responseObject as { message?: string | string[] }).message ??
          (status >= 500 ? 'Internal Server Error' : 'Error'));

    const store = asyncStore.getStore();

    let req: Request;
    let response: Response | undefined;

    if (isGraphQL) {
      const gqlContext = GqlExecutionContext.create(host as any).getContext<{
        req: Request;
        res: Response;
      }>();

      req = gqlContext.req ?? {};
      response = gqlContext.res;
    } else {
      const httpContext = host.switchToHttp();

      req = httpContext.getRequest<Request>();
      response = httpContext.getResponse<Response>();
    }

    const requestId = store?.requestId;

    logger.error('Unhandled exception', {
      path: req?.originalUrl,
      method: req?.method,
      status,
      error: exception instanceof Error ? exception.message : String(exception),
      requestId,
    });

    if (requestId) {
      response?.setHeader('x-request-id', requestId);
    }

    if (isGraphQL) {
      return new GraphQLError(
        Array.isArray(message) ? message.join(', ') : message,
        {
          extensions: {
            code: this.getGraphQLErrorCode(status),
            statusCode: status,
            success: false,
            requestId,
          },
        },
      );
    }

    const errorResponse = {
      ...responseObject,
      success: false,
      message,
    };

    response?.status(status).json(errorResponse);
  }

  private getGraphQLErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHENTICATED';

      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';

      case HttpStatus.BAD_REQUEST:
        return 'BAD_USER_INPUT';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';

      default:
        return status >= 500 ? 'INTERNAL_SERVER_ERROR' : `HTTP_${status}`;
    }
  }
}

import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import type { ApiErrorPayload } from '@customer-support/types';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      // Log the real error (with stack) internally; the client only ever sees a
      // generic message so raw Prisma/runtime details are never disclosed.
      this.logger.error({
        event: 'request.unhandled_error',
        path: request.url,
        error: exception instanceof Error ? exception.stack : String(exception),
      });
    }

    const message = this.extractMessage(exception, status);

    const payload: ApiErrorPayload = {
      code:
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'INTERNAL_SERVER_ERROR'
          : 'REQUEST_ERROR',
      message,
      path: request.url,
      statusCode: status,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(payload);
  }

  private extractMessage(exception: unknown, status: number) {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return response;
      }

      if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response
      ) {
        const value = response.message;
        return Array.isArray(value) ? value.join(', ') : String(value);
      }

      return exception.message;
    }

    // Never surface raw messages from unexpected (non-HttpException) errors:
    // they can leak Prisma constraint names, file paths, or internal details.
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      return 'An unexpected error occurred.';
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'An unexpected error occurred.';
  }
}

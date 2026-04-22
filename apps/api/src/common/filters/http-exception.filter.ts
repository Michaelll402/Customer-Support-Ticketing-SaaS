import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import type { ApiErrorPayload } from '@customer-support/types';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.extractMessage(exception);

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

  private extractMessage(exception: unknown) {
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

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'An unexpected error occurred.';
  }
}

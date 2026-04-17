import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter — catches every thrown exception and:
 *
 * 1. Logs it clearly at the right severity level:
 *    - WARN  -> 4xx client errors (bad input, not found, forbidden)
 *    - ERROR -> 5xx server errors (DB failures, unhandled exceptions)
 *
 * 2. Returns a standardised JSON error envelope to the client:
 *    { success: false, error: { code, message, statusCode } }
 *
 * Log format includes: method, url, status, error code, request body, error details.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const { method, url, body } = request;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as any;
        message = resp.message || exception.message;
        code = resp.error || this.getErrorCode(status);
      }

      // 4xx -> WARN  |  5xx -> ERROR
      if (status >= 500) {
        this.logger.error(
          `[${method}] ${url} \u2192 ${status} ${code} | Body: ${this.safeStringify(body)} | Error: ${this.safeStringify(message)}`,
        );
      } else {
        this.logger.warn(
          `[${method}] ${url} \u2192 ${status} ${code} | Body: ${this.safeStringify(body)} | Error: ${this.safeStringify(message)}`,
        );
      }
    } else if (exception instanceof Error) {
      // Unhandled errors — always ERROR severity with stack trace
      this.logger.error(
        `[${method}] ${url} \u2192 500 INTERNAL_ERROR | Body: ${this.safeStringify(body)} | Error: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error(
        `[${method}] ${url} \u2192 500 UNKNOWN_ERROR | Exception: ${this.safeStringify(exception)}`,
      );
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        statusCode: status,
      },
    });
  }

  private getErrorCode(status: number): string {
    const codeMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
    };
    return codeMap[status] || 'INTERNAL_ERROR';
  }

  /** Safely stringify — never throw from a logger. Redacts sensitive fields. */
  private safeStringify(value: unknown): string {
    try {
      if (value && typeof value === 'object') {
        const redacted = { ...(value as Record<string, unknown>) };
        const sensitiveKeys = ['password', 'token', 'secret'];
        for (const key of sensitiveKeys) {
          if (key in redacted) redacted[key] = '***';
        }
        return JSON.stringify(redacted);
      }
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}

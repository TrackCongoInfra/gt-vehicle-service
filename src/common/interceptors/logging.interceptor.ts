import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          this.logger.log(
            `${method} ${url} ${response.statusCode} - ${Date.now() - now}ms`,
          );
        },
        error: (err) => {
          const status = err?.status || err?.getStatus?.() || 500;
          if (status >= 500) {
            this.logger.error(
              `${method} ${url} ${status} - ${Date.now() - now}ms`,
            );
          } else {
            this.logger.warn(
              `${method} ${url} ${status} - ${Date.now() - now}ms`,
            );
          }
        },
      }),
    );
  }
}

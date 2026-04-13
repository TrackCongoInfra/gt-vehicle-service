import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface SuccessResponse<T> {
  success: boolean;
  data: T;
  meta?: any;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, SuccessResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponse<T>> {
    return next.handle().pipe(
      map((responseData) => {
        // If the response already has a success property, pass through
        if (responseData && typeof responseData === 'object' && 'success' in responseData) {
          return responseData;
        }

        // If the response has data and meta (paginated), wrap accordingly
        if (responseData && typeof responseData === 'object' && 'data' in responseData && 'meta' in responseData) {
          return {
            success: true,
            data: responseData.data,
            meta: responseData.meta,
          };
        }

        return {
          success: true,
          data: responseData,
        };
      }),
    );
  }
}

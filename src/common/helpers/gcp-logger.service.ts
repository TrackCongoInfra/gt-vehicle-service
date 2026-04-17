import { LoggerService, LogLevel } from '@nestjs/common';

/**
 * GCP-compatible structured JSON logger.
 *
 * Cloud Run parses JSON lines with a `severity` field and displays them
 * correctly in Cloud Logging with proper severity icons:
 *   - INFO  (blue "i")  -> successful requests, startup messages
 *   - WARNING (yellow "!")  -> 4xx client errors (400, 401, 403, 404, 409)
 *   - ERROR (red "!!")  -> 5xx server errors, unhandled exceptions
 *
 * Output format per line:
 *   {"severity":"INFO","message":"...","context":"...","timestamp":"..."}
 */
export class GcpLoggerService implements LoggerService {
  private readonly minLevel: number;

  private static readonly LEVELS: Record<string, number> = {
    debug: 0,
    verbose: 1,
    log: 2,
    warn: 3,
    error: 4,
  };

  constructor(minLevel: LogLevel = 'log') {
    this.minLevel = GcpLoggerService.LEVELS[minLevel] ?? 2;
  }

  log(message: any, context?: string): void {
    if (GcpLoggerService.LEVELS['log'] < this.minLevel) return;
    this.write('INFO', message, context);
  }

  warn(message: any, context?: string): void {
    if (GcpLoggerService.LEVELS['warn'] < this.minLevel) return;
    this.write('WARNING', message, context);
  }

  error(message: any, stackOrContext?: string, context?: string): void {
    if (GcpLoggerService.LEVELS['error'] < this.minLevel) return;
    const entry: Record<string, unknown> = {
      severity: 'ERROR',
      message:
        typeof message === 'object' ? JSON.stringify(message) : String(message),
      timestamp: new Date().toISOString(),
    };

    // NestJS Logger.error(msg, stack) or Logger.error(msg, stack, context)
    if (context) {
      entry.context = context;
      entry.stack = stackOrContext;
    } else if (stackOrContext && stackOrContext.includes('\n')) {
      entry.stack = stackOrContext;
    } else if (stackOrContext) {
      entry.context = stackOrContext;
    }

    process.stderr.write(JSON.stringify(entry) + '\n');
  }

  debug(message: any, context?: string): void {
    if (GcpLoggerService.LEVELS['debug'] < this.minLevel) return;
    this.write('DEBUG', message, context);
  }

  verbose(message: any, context?: string): void {
    if (GcpLoggerService.LEVELS['verbose'] < this.minLevel) return;
    this.write('DEBUG', message, context);
  }

  private write(severity: string, message: any, context?: string): void {
    const entry: Record<string, unknown> = {
      severity,
      message:
        typeof message === 'object' ? JSON.stringify(message) : String(message),
      timestamp: new Date().toISOString(),
    };
    if (context) entry.context = context;

    const stream = severity === 'ERROR' ? process.stderr : process.stdout;
    stream.write(JSON.stringify(entry) + '\n');
  }
}

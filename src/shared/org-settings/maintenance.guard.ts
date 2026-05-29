import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { OrgSettingsReaderService } from './org-settings-reader.service';

/**
 * Blocks write operations when `organization_settings.maintenance_mode.enabled`
 * is true for the caller's org.
 *
 * Rules:
 *   - GET / HEAD / OPTIONS: always pass (read-safe). The settings layer
 *     distinguishes `allowReads` so this guard is intentionally narrower than
 *     a full freeze — read-only health UIs keep working during the window.
 *   - system_admin (per `isSystemAdmin` flag): bypass — ops need to undo the
 *     maintenance window from this same control plane.
 *   - Settings PATCH itself (path matches `/settings/maintenance-mode`):
 *     would only be reached if system_admin OR you forgot to apply this
 *     guard on the org-service settings controller; bypass via path check
 *     for safety either way.
 *   - When `enabled === false` OR settings read fails: pass-through.
 *
 * Returns 503 ServiceUnavailable with the configured reason so the UI can
 * surface "We're in maintenance — try again later" to users instead of a
 * generic 500.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  private readonly logger = new Logger(MaintenanceGuard.name);

  constructor(private readonly orgSettings: OrgSettingsReaderService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { user?: { isSystemAdmin?: boolean; orgId?: string } }
    >();

    // Read methods pass without consulting settings — saves a DB hit per GET.
    const method = (req.method || '').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true;
    }

    // Safety hatch — never block the path that lets ops turn maintenance off.
    const path = req.path || req.url || '';
    if (path.includes('/settings/maintenance-mode')) return true;

    // system_admin operates above the freeze.
    if (req.user?.isSystemAdmin) return true;

    const orgId = req.user?.orgId;
    if (!orgId) {
      // No org context = unauthenticated or misrouted; let the auth layer 401.
      return true;
    }

    let state: { enabled?: boolean; reason?: string | null };
    try {
      state = await this.orgSettings.getMaintenanceMode(orgId);
    } catch (err) {
      // Fail-open: a settings read failure shouldn't block legitimate writes.
      this.logger.warn(
        `MaintenanceGuard read failed for org=${orgId}: ${
          err instanceof Error ? err.message : String(err)
        } — allowing write through.`,
      );
      return true;
    }

    if (!state?.enabled) return true;

    throw new HttpException(
      {
        success: false,
        error: {
          code: 'MaintenanceMode',
          message:
            state.reason ??
            'This organization is currently in maintenance — write operations are temporarily blocked.',
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        },
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

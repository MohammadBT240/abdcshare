import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { type Observable, tap } from 'rxjs';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { AuditService } from './audit.service';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Records a best-effort activity-log row for every successful mutation by an
 * authenticated user. Coarse but zero-touch: no service needs to change. Auth
 * routes are skipped so credentials/tokens are never captured.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const method = req.method?.toUpperCase();
    const user = req.user;
    const path = (req.route?.path as string | undefined) ?? req.originalUrl?.split('?')[0] ?? req.url;

    const shouldLog = !!user && MUTATING.has(method) && !path.includes('/auth/');

    return next.handle().pipe(
      tap(() => {
        if (!shouldLog) return;
        const segments = path.split('/').filter((s) => s && s !== 'api');
        const entityType = segments[0] ?? 'unknown';
        const rawId = (req.params?.id as string | undefined) ?? null;
        const entityId = rawId && UUID_RE.test(rawId) ? rawId : null; // column is uuid
        void this.audit.record({
          actorId: user!.userId,
          action: `${method} ${path}`,
          entityType,
          entityId,
          ipAddress: req.ip ?? null,
          metadata: Object.keys(req.params ?? {}).length ? { params: req.params } : null,
        });
      }),
    );
  }
}

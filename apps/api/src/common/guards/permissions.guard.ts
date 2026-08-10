import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission, type Permission } from '@abdcshare/shared';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../interfaces/authenticated-user';
import { PartnerReportAccessService } from '../../modules/partner-reports/partner-report-access.service';

/** Roles that gain report submit/view only when on the Chairman's roster. */
const ROSTER_ALLOWLIST_ROLES = new Set(['Staff', 'Client']);
const ROSTER_ALLOWLIST_PERMS: Permission[] = ['partner-report:submit', 'partner-report:view'];

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly partnerReportAccess: PartnerReportAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredAll = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredAny = this.reflector.getAllAndOverride<Permission[]>(ANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if ((!requiredAll || requiredAll.length === 0) && (!requiredAny || requiredAny.length === 0)) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    if (requiredAll?.length) {
      const okAll = (
        await Promise.all(requiredAll.map((p) => this.check(user, p)))
      ).every(Boolean);
      if (!okAll) throw new ForbiddenException('Insufficient permissions');
    }
    if (requiredAny?.length) {
      const results = await Promise.all(requiredAny.map((p) => this.check(user, p)));
      if (!results.some(Boolean)) throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }

  private async check(user: AuthenticatedUser, permission: Permission): Promise<boolean> {
    if (hasPermission(user.role, permission, user.partnerDesignation)) return true;
    if (ROSTER_ALLOWLIST_ROLES.has(user.role) && ROSTER_ALLOWLIST_PERMS.includes(permission)) {
      return this.partnerReportAccess.isAllowedReporter(user.userId);
    }
    return false;
  }
}

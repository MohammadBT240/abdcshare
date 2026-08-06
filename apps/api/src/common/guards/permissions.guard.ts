import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission, type Permission } from '@abdcshare/shared';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../interfaces/authenticated-user';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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
      const okAll = requiredAll.every((p) =>
        hasPermission(user.role, p, user.partnerDesignation),
      );
      if (!okAll) throw new ForbiddenException('Insufficient permissions');
    }
    if (requiredAny?.length) {
      const okAny = requiredAny.some((p) =>
        hasPermission(user.role, p, user.partnerDesignation),
      );
      if (!okAny) throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}

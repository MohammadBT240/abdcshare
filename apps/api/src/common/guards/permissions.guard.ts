import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission, type Permission } from '@abdcshare/shared';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../interfaces/authenticated-user';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    const ok = required.every((p) => hasPermission(user.role, p, user.partnerDesignation));
    if (!ok) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}

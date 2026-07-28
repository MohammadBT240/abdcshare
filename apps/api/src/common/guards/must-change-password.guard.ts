import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedUser } from '../interfaces/authenticated-user';

/** Routes a user may still reach while `mustChangePassword` is true. */
const ALLOWED = [/\/auth\/change-password$/, /\/auth\/logout$/, /\/auth\/me$/];

/**
 * Blocks every non-public route until a user with `mustChangePassword` has
 * changed it — so an invited Guest (or any first-login user) must set a real
 * password before doing anything else. Runs after JwtAuthGuard.
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user || !user.mustChangePassword) return true;

    const path = (req.route?.path as string | undefined) ?? req.originalUrl?.split('?')[0] ?? req.url;
    if (ALLOWED.some((re) => re.test(path))) return true;

    throw new ForbiddenException('You must change your password before continuing');
  }
}

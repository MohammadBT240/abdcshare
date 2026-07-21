import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedUser } from "../interfaces/authenticated-user";

/** Injects the authenticated user (or one of its fields) into a handler param. */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    return field ? req.user?.[field] : req.user;
  },
);

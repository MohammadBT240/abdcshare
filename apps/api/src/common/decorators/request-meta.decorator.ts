import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/** Client IP (honours `trust proxy`) and a truncated user agent, for activity logs. */
export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export const ReqMeta = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestMeta => {
  const req = ctx.switchToHttp().getRequest<{ ip?: string; headers?: Record<string, string | string[] | undefined> }>();
  const ua = req.headers?.['user-agent'];
  const userAgent = (Array.isArray(ua) ? ua[0] : ua) ?? null;
  return { ip: req.ip?.slice(0, 64) ?? null, userAgent: userAgent ? userAgent.slice(0, 300) : null };
});

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ERROR_CODE, type ApiErrorBody, type ErrorCode } from '@abdcshare/shared';

function httpExceptionMessage(exception: HttpException): string {
  const r = exception.getResponse();
  if (typeof r === 'string') return r;
  const msg = (r as { message?: string | string[] }).message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string') return msg;
  return exception.message;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ERROR_CODE.Internal;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = httpExceptionMessage(exception);
      code = STATUS_CODE_MAP[status] ?? ERROR_CODE.Internal;
    } else {
      this.logger.error(exception);
    }

    // `error` is the shared ApiErrorBody field; `message` mirrors Nest/BFF clients.
    const body: ApiErrorBody & { message: string } = { error: message, message, code };
    res.status(status).json(body);
  }
}

const STATUS_CODE_MAP: Record<number, ErrorCode> = {
  [HttpStatus.BAD_REQUEST]: ERROR_CODE.Validation,
  [HttpStatus.UNAUTHORIZED]: ERROR_CODE.Unauthorized,
  [HttpStatus.FORBIDDEN]: ERROR_CODE.Forbidden,
  [HttpStatus.NOT_FOUND]: ERROR_CODE.NotFound,
  [HttpStatus.CONFLICT]: ERROR_CODE.Conflict,
};

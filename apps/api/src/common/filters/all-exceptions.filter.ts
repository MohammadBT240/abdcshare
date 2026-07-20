import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ERROR_CODE, type ApiErrorBody, type ErrorCode } from '@abdcshare/shared';

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
      const r = exception.getResponse();
      message = typeof r === 'string' ? r : ((r as { message?: string }).message ?? exception.message);
      code = STATUS_CODE_MAP[status] ?? ERROR_CODE.Internal;
    } else {
      this.logger.error(exception);
    }

    const body: ApiErrorBody = { error: message, code };
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

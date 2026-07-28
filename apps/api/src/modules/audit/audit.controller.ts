import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuditService } from './audit.service';
import { AuditListQueryDto, AuditListResponseDto } from './presentation/dto/audit.dto';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('audit:view')
  list(@Query() query: AuditListQueryDto): Promise<AuditListResponseDto> {
    return this.audit.list(query);
  }
}

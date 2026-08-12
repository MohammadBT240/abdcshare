import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProduces, ApiTags } from '@nestjs/swagger';
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

  @Get('export')
  @RequirePermission('audit:view')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="activity-log.csv"')
  @ApiProduces('text/csv')
  exportCsv(@Query() query: AuditListQueryDto): Promise<string> {
    return this.audit.exportCsv(query);
  }
}

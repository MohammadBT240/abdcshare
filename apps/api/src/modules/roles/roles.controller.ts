import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RolesService } from './roles.service';
import { RoleResponseDto } from './presentation/dto/role.dto';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermission('user:view')
  @ApiOkResponse({ type: [RoleResponseDto] })
  list(): Promise<RoleResponseDto[]> {
    return this.roles.list();
  }
}

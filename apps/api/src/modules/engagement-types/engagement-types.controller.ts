import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { hasPermission } from '@abdcshare/shared';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { EngagementTypesService } from './engagement-types.service';
import {
  CreateEngagementTypeDto,
  EngagementTypeListQueryDto,
  EngagementTypeListResponseDto,
  EngagementTypeResponseDto,
  SetAllowedRequestClassesDto,
  UpdateEngagementTypeDto,
} from './presentation/dto/engagement-type.dto';

@ApiTags('engagement-types')
@ApiBearerAuth()
@Controller('engagement-types')
export class EngagementTypesController {
  constructor(private readonly engagementTypes: EngagementTypesService) {}

  /**
   * Create an engagement type. Allowed for catalogue:manage (admin) or engagement:create
   * (inline create from the create-engagement dialog).
   */
  @Post()
  create(
    @Body() dto: CreateEngagementTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EngagementTypeResponseDto> {
    const can =
      hasPermission(user.role, 'catalogue:manage', user.partnerDesignation) ||
      hasPermission(user.role, 'engagement:create', user.partnerDesignation);
    if (!can) throw new ForbiddenException('Insufficient permissions');
    return this.engagementTypes.create(dto);
  }

  @Get()
  @RequirePermission('catalogue:view')
  list(@Query() query: EngagementTypeListQueryDto): Promise<EngagementTypeListResponseDto> {
    return this.engagementTypes.list(query);
  }

  @Get(':id')
  @RequirePermission('catalogue:view')
  getOne(@Param('id', ParseIntPipe) id: number): Promise<EngagementTypeResponseDto> {
    return this.engagementTypes.getOne(id);
  }

  @Patch(':id')
  @RequirePermission('catalogue:manage')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEngagementTypeDto,
  ): Promise<EngagementTypeResponseDto> {
    return this.engagementTypes.update(id, dto);
  }

  /** Replace suggested request-class defaults (empty ⇒ no suggestions; any class may still be scoped on an engagement). */
  @Put(':id/request-classes')
  @RequirePermission('catalogue:manage')
  setAllowedRequestClasses(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetAllowedRequestClassesDto,
  ): Promise<EngagementTypeResponseDto> {
    return this.engagementTypes.setAllowedRequestClasses(id, dto.requestClassIds);
  }

  @Post(':id/deactivate')
  @RequirePermission('catalogue:manage')
  deactivate(@Param('id', ParseIntPipe) id: number): Promise<EngagementTypeResponseDto> {
    return this.engagementTypes.deactivate(id);
  }
}

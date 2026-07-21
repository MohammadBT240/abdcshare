import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
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

  @Post()
  @RequirePermission('catalogue:manage')
  create(@Body() dto: CreateEngagementTypeDto): Promise<EngagementTypeResponseDto> {
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

  /** Replace the allowed request-class set (empty ⇒ all request classes allowed). */
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

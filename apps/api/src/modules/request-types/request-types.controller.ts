import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  RequireAnyPermission,
  RequirePermission,
} from '../../common/decorators/require-permission.decorator';
import { RequestTypesService } from './request-types.service';
import {
  CreateRequestTypeDto,
  RequestTypeListQueryDto,
  RequestTypeListResponseDto,
  RequestTypeResponseDto,
  UpdateRequestTypeDto,
} from './presentation/dto/request-type.dto';

@ApiTags('request-types')
@ApiBearerAuth()
@Controller('request-types')
export class RequestTypesController {
  constructor(private readonly requestTypes: RequestTypesService) {}

  /**
   * Create a request type. Allowed for catalogue:manage (admin) or request:create
   * (inline create from the create-request dialog).
   */
  @Post()
  @RequireAnyPermission('catalogue:manage', 'request:create')
  create(@Body() dto: CreateRequestTypeDto): Promise<RequestTypeResponseDto> {
    return this.requestTypes.create(dto);
  }

  @Get()
  @RequireAnyPermission('catalogue:view', 'request:create')
  list(@Query() query: RequestTypeListQueryDto): Promise<RequestTypeListResponseDto> {
    return this.requestTypes.list(query);
  }

  @Get(':id')
  @RequireAnyPermission('catalogue:view', 'request:create')
  getOne(@Param('id', ParseIntPipe) id: number): Promise<RequestTypeResponseDto> {
    return this.requestTypes.getOne(id);
  }

  @Patch(':id')
  @RequirePermission('catalogue:manage')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRequestTypeDto,
  ): Promise<RequestTypeResponseDto> {
    return this.requestTypes.update(id, dto);
  }

  @Post(':id/deactivate')
  @RequirePermission('catalogue:manage')
  deactivate(@Param('id', ParseIntPipe) id: number): Promise<RequestTypeResponseDto> {
    return this.requestTypes.deactivate(id);
  }
}

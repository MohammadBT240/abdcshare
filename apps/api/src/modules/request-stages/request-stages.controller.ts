import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequireAnyPermission, RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  OrderedCreateDto,
  OrderedListQueryDto,
  OrderedListResponseDto,
  OrderedResponseDto,
  OrderedUpdateDto,
} from '../../common/catalogue/ordered-catalogue.dto';
import { RequestStagesService } from './request-stages.service';

@ApiTags('request-stages')
@ApiBearerAuth()
@Controller('request-stages')
export class RequestStagesController {
  constructor(private readonly stages: RequestStagesService) {}

  @Post()
  @RequirePermission('catalogue:manage')
  create(@Body() dto: OrderedCreateDto): Promise<OrderedResponseDto> {
    return this.stages.create(dto);
  }

  @Get()
  // Staff read these for request filters and the status picker.
  @RequireAnyPermission('catalogue:view', 'request:create')
  list(@Query() query: OrderedListQueryDto): Promise<OrderedListResponseDto> {
    return this.stages.list(query);
  }

  @Get(':id')
  // Staff read these for request filters and the status picker.
  @RequireAnyPermission('catalogue:view', 'request:create')
  getOne(@Param('id', ParseIntPipe) id: number): Promise<OrderedResponseDto> {
    return this.stages.getOne(id);
  }

  @Patch(':id')
  @RequirePermission('catalogue:manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: OrderedUpdateDto): Promise<OrderedResponseDto> {
    return this.stages.update(id, dto);
  }

  @Post(':id/deactivate')
  @RequirePermission('catalogue:manage')
  deactivate(@Param('id', ParseIntPipe) id: number): Promise<OrderedResponseDto> {
    return this.stages.deactivate(id);
  }
}

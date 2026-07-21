import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  OrderedCreateDto,
  OrderedListQueryDto,
  OrderedListResponseDto,
  OrderedResponseDto,
  OrderedUpdateDto,
} from '../../common/catalogue/ordered-catalogue.dto';
import { RequestStatusesService } from './request-statuses.service';

@ApiTags('request-statuses')
@ApiBearerAuth()
@Controller('request-statuses')
export class RequestStatusesController {
  constructor(private readonly statuses: RequestStatusesService) {}

  @Post()
  @RequirePermission('catalogue:manage')
  create(@Body() dto: OrderedCreateDto): Promise<OrderedResponseDto> {
    return this.statuses.create(dto);
  }

  @Get()
  @RequirePermission('catalogue:view')
  list(@Query() query: OrderedListQueryDto): Promise<OrderedListResponseDto> {
    return this.statuses.list(query);
  }

  @Get(':id')
  @RequirePermission('catalogue:view')
  getOne(@Param('id', ParseIntPipe) id: number): Promise<OrderedResponseDto> {
    return this.statuses.getOne(id);
  }

  @Patch(':id')
  @RequirePermission('catalogue:manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: OrderedUpdateDto): Promise<OrderedResponseDto> {
    return this.statuses.update(id, dto);
  }

  @Post(':id/deactivate')
  @RequirePermission('catalogue:manage')
  deactivate(@Param('id', ParseIntPipe) id: number): Promise<OrderedResponseDto> {
    return this.statuses.deactivate(id);
  }
}

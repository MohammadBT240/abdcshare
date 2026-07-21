import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequestClassesService } from './request-classes.service';
import {
  CreateRequestClassDto,
  RequestClassListQueryDto,
  RequestClassListResponseDto,
  RequestClassResponseDto,
  UpdateRequestClassDto,
} from './presentation/dto/request-class.dto';

@ApiTags('request-classes')
@ApiBearerAuth()
@Controller('request-classes')
export class RequestClassesController {
  constructor(private readonly requestClasses: RequestClassesService) {}

  @Post()
  @RequirePermission('catalogue:manage')
  create(@Body() dto: CreateRequestClassDto): Promise<RequestClassResponseDto> {
    return this.requestClasses.create(dto);
  }

  @Get()
  @RequirePermission('catalogue:view')
  list(@Query() query: RequestClassListQueryDto): Promise<RequestClassListResponseDto> {
    return this.requestClasses.list(query);
  }

  @Get(':id')
  @RequirePermission('catalogue:view')
  getOne(@Param('id', ParseIntPipe) id: number): Promise<RequestClassResponseDto> {
    return this.requestClasses.getOne(id);
  }

  @Patch(':id')
  @RequirePermission('catalogue:manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRequestClassDto): Promise<RequestClassResponseDto> {
    return this.requestClasses.update(id, dto);
  }

  @Post(':id/deactivate')
  @RequirePermission('catalogue:manage')
  deactivate(@Param('id', ParseIntPipe) id: number): Promise<RequestClassResponseDto> {
    return this.requestClasses.deactivate(id);
  }
}
